/**
 * Leaderboard API — submit scores and read entries from KV.
 *
 * Entries are sharded by commit SHA: one KV key per question version.
 * Key format: `leaderboard:{commitSha}`
 * Each key holds an array of entries for that question set.
 *
 * Shares scoring logic from the frontend via direct import (DRY).
 */

import type { Env, StoredLeaderboardEntry } from './types.ts'
import type { Question } from '../../src/data/schema.ts'
import type { Answers } from '../../src/utils/scoring.ts'
import { scoreExam } from '../../src/utils/scoring.ts'
import { fetchQuestionsAtCommit } from './questions.ts'
import { getSession } from './auth.ts'
import { z } from 'zod'

/** Zod schema for leaderboard submission body */
const submissionSchema = z.object({
  commitSha: z.string().min(1),
  answers: z.record(
    z.string(),
    z.union([z.array(z.string()), z.record(z.string(), z.string())]),
  ),
  elapsedMs: z.number().int().nonnegative(),
})

// ─── Helpers ─────────────────────────────────────────────────────────

/** KV key for a specific commit SHA's leaderboard */
function kvKey(commitSha: string): string {
  return `leaderboard:${commitSha}`
}

async function readEntries(kv: KVNamespace, commitSha: string): Promise<StoredLeaderboardEntry[]> {
  const data = await kv.get<StoredLeaderboardEntry[]>(kvKey(commitSha), 'json')
  return data ?? []
}

async function writeEntries(kv: KVNamespace, commitSha: string, entries: StoredLeaderboardEntry[]): Promise<void> {
  await kv.put(kvKey(commitSha), JSON.stringify(entries))
}

function sortEntries(entries: StoredLeaderboardEntry[]): StoredLeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage
    return a.timeMs - b.timeMs
  })
}

// ─── Route Handlers ──────────────────────────────────────────────────

/** GET /api/leaderboard?commitSha=... — Return leaderboard entries, optionally filtered by commit SHA */
export async function handleGetLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const commitSha = url.searchParams.get('commitSha')

  if (commitSha) {
    // Specific version
    const entries = await readEntries(env.LEADERBOARD, commitSha)
    return Response.json({ entries: sortEntries(entries) })
  }

  // All versions — list all leaderboard KV keys and merge entries
  const allEntries: StoredLeaderboardEntry[] = []
  let cursor: string | undefined
  do {
    const list = await env.LEADERBOARD.list({ prefix: 'leaderboard:', cursor })
    for (const key of list.keys) {
      const data = await env.LEADERBOARD.get<StoredLeaderboardEntry[]>(key.name, 'json')
      if (data) allEntries.push(...data)
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)

  return Response.json({ entries: sortEntries(allEntries) })
}

/** GET /api/leaderboard/versions — List available commit SHAs with entry counts */
export async function handleGetLeaderboardVersions(env: Env): Promise<Response> {
  const versions: Array<{ commitSha: string; entryCount: number }> = []
  let cursor: string | undefined
  do {
    const list = await env.LEADERBOARD.list({ prefix: 'leaderboard:', cursor })
    for (const key of list.keys) {
      const sha = key.name.replace('leaderboard:', '')
      const data = await env.LEADERBOARD.get<StoredLeaderboardEntry[]>(key.name, 'json')
      versions.push({ commitSha: sha, entryCount: data?.length ?? 0 })
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)

  return Response.json({ versions })
}

/** POST /api/leaderboard — Submit a new leaderboard entry (requires auth) */
export async function handleSubmitScore(request: Request, env: Env): Promise<Response> {
  // Verify authentication
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Parse and validate request body
  const parsed = submissionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i: z.ZodIssue) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return Response.json({ error: msg }, { status: 400 })
  }
  const body = parsed.data

  // Fetch questions at the given commit and re-score
  let questions: Question[]
  try {
    questions = await fetchQuestionsAtCommit(body.commitSha, env.GITHUB_TOKEN) as Question[]
  } catch (err) {
    return Response.json(
      { error: `Could not fetch questions at commit ${body.commitSha.slice(0, 7)}: ${(err as Error).message}` },
      { status: 400 },
    )
  }

  // Server-side scoring
  const result = scoreExam(questions, body.answers as Answers)

  // Build the entry
  const entry: StoredLeaderboardEntry = {
    id: session.sub,
    provider: session.provider,
    displayName: session.name,
    avatarUrl: session.avatar,
    score: Math.round(result.totalScore * 100) / 100,
    maxScore: result.totalPossible,
    percentage: Math.round(result.percentage * 1000) / 10,
    passed: result.passed,
    timeMs: body.elapsedMs,
    commitSha: body.commitSha,
    submittedAt: new Date().toISOString(),
  }

  // Upsert: one entry per user per commit SHA
  const entries = await readEntries(env.LEADERBOARD, body.commitSha)
  const filtered = entries.filter(e => e.id !== entry.id)
  filtered.push(entry)
  await writeEntries(env.LEADERBOARD, body.commitSha, filtered)

  return Response.json({ entry }, { status: 201 })
}
