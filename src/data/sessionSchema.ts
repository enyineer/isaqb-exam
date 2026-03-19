/**
 * Shared session schemas — used by both frontend and worker.
 * Follows the same pattern as schema.ts (shared question schemas).
 */

import { z } from 'zod'
import type { Answers } from '../utils/scoring'

// ─── Slug ────────────────────────────────────────────────────────────

export const sessionSlugSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g. "my-session")')

// ─── Create / Update Schemas ─────────────────────────────────────────

export const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  slug: sessionSlugSchema.nullable().optional(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  commitSha: z.string().min(1),
}).refine(d => new Date(d.startTime) < new Date(d.endTime), {
  message: 'Start time must be before end time',
  path: ['endTime'],
})

export const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  slug: sessionSlugSchema.nullable().optional(),
  startTime: z.iso.datetime().optional(),
  endTime: z.iso.datetime().optional(),
})

// ─── Session Submission (participant → worker) ───────────────────────

export const sessionSubmitSchema = z.object({
  answers: z.record(
    z.string(),
    z.union([z.array(z.string()), z.record(z.string(), z.string())]),
  ),
  questionTimes: z.record(z.string(), z.number().nonnegative()),
  questionNotes: z.record(z.string(), z.string()).default({}),
  elapsedMs: z.number().int().nonnegative(),
})

// ─── Types ───────────────────────────────────────────────────────────

export interface ExamSession {
  id: string
  slug: string | null
  creatorId: string
  creatorName: string
  title: string
  description: string
  startTime: string
  endTime: string
  commitSha: string
  createdAt: string
  updatedAt: string
}

export interface SessionSubmission {
  participantId: string
  participantName: string
  participantAvatar: string
  authMethod: 'github' | 'google' | 'nickname'
  answers: Answers
  questionTimes: Record<string, number>
  questionNotes: Record<string, string>
  score: number
  maxScore: number
  percentage: number
  passed: boolean
  elapsedMs: number
  submittedAt: string
}

export interface QuestionStats {
  questionId: string
  /** For pick questions: option ID → count */
  answerDistribution: Record<string, number>
  /** For category questions: statement ID → { category label → count } */
  categoryDistribution: Record<string, Record<string, number>>
  /** Number of submissions that selected more options than allowed (pick questions only) */
  invalidCount: number
  /** Time percentiles in ms */
  timePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
  averageTimeMs: number
}

export interface SessionStats {
  totalSubmissions: number
  averagePercentage: number
  passRate: number
  questionStats: QuestionStats[]
}

/** Session status derived from time window */
export type SessionStatus = 'upcoming' | 'active' | 'ended'

export function getSessionStatus(session: ExamSession, now = Date.now()): SessionStatus {
  const start = new Date(session.startTime).getTime()
  const end = new Date(session.endTime).getTime()
  if (now < start) return 'upcoming'
  if (now > end) return 'ended'
  return 'active'
}
