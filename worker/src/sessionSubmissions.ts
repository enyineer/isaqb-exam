/**
 * Session submission handlers — submit exam results, list submissions, compute stats.
 * Server-side scoring: participants send raw answers, worker scores via shared scoreExam().
 */

import type { Env } from './types.ts'
import type { Question } from '../../src/data/schema.ts'
import type { Answers } from '../../src/utils/scoring.ts'
import type { ExamSession, SessionSubmission, SessionStats, QuestionStats } from '../../src/data/sessionSchema.ts'
import { sessionSubmitSchema } from '../../src/data/sessionSchema.ts'
import { scoreExam } from '../../src/utils/scoring.ts'
import { fetchQuestionsAtCommit } from './questions.ts'
import { getSession } from './auth.ts'
import { resolveSession } from './sessions.ts'
import { z } from 'zod'

// ─── KV Helpers ──────────────────────────────────────────────────────

function submissionsKey(sessionId: string): string {
  return `session:${sessionId}:submissions`
}

async function readSubmissions(kv: KVNamespace, sessionId: string): Promise<SessionSubmission[]> {
  return await kv.get<SessionSubmission[]>(submissionsKey(sessionId), 'json') ?? []
}

async function writeSubmissions(kv: KVNamespace, sessionId: string, submissions: SessionSubmission[]): Promise<void> {
  await kv.put(submissionsKey(sessionId), JSON.stringify(submissions))
}

// ─── Stats Computation ───────────────────────────────────────────────

/** Compute the value at a given percentile from a sorted array */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

function computeStats(submissions: SessionSubmission[], questions: Question[]): SessionStats {
  const totalSubmissions = submissions.length
  const totalPercentage = submissions.reduce((sum, s) => sum + s.percentage, 0)
  const passCount = submissions.filter(s => s.passed).length

  const questionStats: QuestionStats[] = questions.map(q => {
    const answerDistribution: Record<string, number> = {}
    const categoryDistribution: Record<string, Record<string, number>> = {}
    const times: number[] = []

    for (const sub of submissions) {
      // Time tracking
      const timeForQ = sub.questionTimes[q.id]
      if (timeForQ != null) times.push(timeForQ)

      const answer = sub.answers[q.id]
      if (q.type === 'pick') {
        const selected = Array.isArray(answer) ? answer : []
        for (const optionId of selected) {
          answerDistribution[optionId] = (answerDistribution[optionId] ?? 0) + 1
        }
      } else {
        const assignments = (answer && typeof answer === 'object' && !Array.isArray(answer))
          ? answer as Record<string, string>
          : {}
        for (const [stmtId, catLabel] of Object.entries(assignments)) {
          if (!categoryDistribution[stmtId]) categoryDistribution[stmtId] = {}
          categoryDistribution[stmtId][catLabel] = (categoryDistribution[stmtId][catLabel] ?? 0) + 1
        }
      }
    }

    const sorted = [...times].sort((a, b) => a - b)
    const avg = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 0

    return {
      questionId: q.id,
      answerDistribution,
      categoryDistribution,
      timePercentiles: {
        p10: percentile(sorted, 10),
        p25: percentile(sorted, 25),
        p50: percentile(sorted, 50),
        p75: percentile(sorted, 75),
        p90: percentile(sorted, 90),
      },
      averageTimeMs: Math.round(avg),
    }
  })

  return {
    totalSubmissions,
    averagePercentage: totalSubmissions > 0 ? Math.round((totalPercentage / totalSubmissions) * 10) / 10 : 0,
    passRate: totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 1000) / 10 : 0,
    questionStats,
  }
}

// ─── Route Handlers ──────────────────────────────────────────────────

/** POST /api/sessions/:idOrSlug/submit — Submit exam results (server-side scoring) */
export async function handleSessionSubmit(idOrSlug: string, request: Request, env: Env): Promise<Response> {
  // Resolve session
  const examSession = await resolveSession(env.EXAM_SESSIONS, idOrSlug)
  if (!examSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  // Check time window
  const now = Date.now()
  const start = new Date(examSession.startTime).getTime()
  const end = new Date(examSession.endTime).getTime()
  if (now < start) {
    return Response.json({ error: 'Session has not started yet' }, { status: 403 })
  }
  if (now > end) {
    return Response.json({ error: 'Session has ended' }, { status: 403 })
  }

  // Resolve participant identity — JWT or nickname
  let participantId: string
  let participantName: string
  let participantAvatar = ''
  let authMethod: 'github' | 'google' | 'nickname'

  const jwtSession = await getSession(request, env)
  const nickname = request.headers.get('X-Participant-Nickname')?.trim()

  if (jwtSession) {
    participantId = jwtSession.sub
    participantName = jwtSession.name
    participantAvatar = jwtSession.avatar
    authMethod = jwtSession.provider
  } else if (nickname && nickname.length >= 1 && nickname.length <= 50) {
    participantId = `nickname:${nickname}`
    participantName = nickname
    authMethod = 'nickname'
  } else {
    return Response.json({ error: 'Authentication required. Sign in or provide a nickname.' }, { status: 401 })
  }

  // Parse and validate request body
  const parsed = sessionSubmitSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i: z.ZodIssue) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return Response.json({ error: msg }, { status: 400 })
  }
  const body = parsed.data

  // Check for duplicate submission
  const submissions = await readSubmissions(env.EXAM_SESSIONS, examSession.id)
  if (submissions.some(s => s.participantId === participantId)) {
    return Response.json({ error: 'You have already submitted to this session' }, { status: 409 })
  }

  // Server-side scoring — fetch questions at the session's commit and score
  let questions: Question[]
  try {
    questions = await fetchQuestionsAtCommit(examSession.commitSha, env.GITHUB_TOKEN) as Question[]
  } catch (err) {
    return Response.json(
      { error: `Could not score submission: ${(err as Error).message}` },
      { status: 500 },
    )
  }

  const result = scoreExam(questions, body.answers as Answers)

  const submission: SessionSubmission = {
    participantId,
    participantName,
    participantAvatar,
    authMethod,
    answers: body.answers as Answers,
    questionTimes: body.questionTimes,
    questionNotes: body.questionNotes,
    score: Math.round(result.totalScore * 100) / 100,
    maxScore: result.totalPossible,
    percentage: Math.round(result.percentage * 1000) / 10,
    passed: result.passed,
    elapsedMs: body.elapsedMs,
    submittedAt: new Date().toISOString(),
  }

  submissions.push(submission)
  await writeSubmissions(env.EXAM_SESSIONS, examSession.id, submissions)

  return Response.json({ submission: { score: submission.score, maxScore: submission.maxScore, percentage: submission.percentage, passed: submission.passed } }, { status: 201 })
}

/** GET /api/sessions/:id/submissions — List all submissions (owner only) */
export async function handleGetSubmissions(id: string, request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const examSession = await env.EXAM_SESSIONS.get<ExamSession>(`session:${id}`, 'json')
  if (!examSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  if (examSession.creatorId !== session.sub) {
    return Response.json({ error: 'Only the session creator can view submissions' }, { status: 403 })
  }

  const submissions = await readSubmissions(env.EXAM_SESSIONS, id)
  return Response.json({ submissions })
}

/** GET /api/sessions/:id/stats — Aggregated per-question stats (owner only) */
export async function handleGetSessionStats(id: string, request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const examSession = await env.EXAM_SESSIONS.get<ExamSession>(`session:${id}`, 'json')
  if (!examSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  if (examSession.creatorId !== session.sub) {
    return Response.json({ error: 'Only the session creator can view stats' }, { status: 403 })
  }

  const submissions = await readSubmissions(env.EXAM_SESSIONS, id)

  // Fetch questions to build stats
  let questions: Question[]
  try {
    questions = await fetchQuestionsAtCommit(examSession.commitSha, env.GITHUB_TOKEN) as Question[]
  } catch (err) {
    return Response.json(
      { error: `Could not compute stats: ${(err as Error).message}` },
      { status: 500 },
    )
  }

  const stats = computeStats(submissions, questions)
  return Response.json({ stats })
}
