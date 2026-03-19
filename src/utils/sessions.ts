/**
 * Frontend API client for exam sessions.
 * Follows the same patterns as leaderboard.ts (DRY).
 */

import { WORKER_BASE_URL } from './leaderboardConfig'
import { authHeaders, clearToken } from './auth'
import type { ExamSession, SessionSubmission, SessionStats } from '../data/sessionSchema'
import type { Answers } from './scoring'

// ─── Session CRUD ────────────────────────────────────────────────────

/** Create a new exam session */
export async function createSession(data: {
  title: string
  description?: string
  slug?: string | null
  startTime: string
  endTime: string
  commitSha: string
}): Promise<{ session: ExamSession }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (res.status === 401) { clearToken(); throw new Error('AUTH_REQUIRED') }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** Fetch all sessions created by the authenticated user */
export async function fetchSessions(): Promise<{ sessions: ExamSession[] }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/sessions`, {
    headers: authHeaders(),
  })
  if (res.status === 401) { clearToken(); throw new Error('AUTH_REQUIRED') }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Fetch a single session by ID or slug (public) */
export async function fetchSession(idOrSlug: string): Promise<{ session: ExamSession }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/sessions/${encodeURIComponent(idOrSlug)}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('SESSION_NOT_FOUND')
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json()
}

/** Update an existing session (owner only) */
export async function updateSession(id: string, data: {
  title?: string
  description?: string
  slug?: string | null
  startTime?: string
  endTime?: string
}): Promise<{ session: ExamSession }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (res.status === 401) { clearToken(); throw new Error('AUTH_REQUIRED') }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** Delete a session (owner only) */
export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE_URL}/api/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (res.status === 401) { clearToken(); throw new Error('AUTH_REQUIRED') }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

// ─── Session Submissions ─────────────────────────────────────────────

/** Submit exam results to a session (server-side scoring) */
export async function submitSessionExam(
  idOrSlug: string,
  data: {
    answers: Answers
    questionTimes: Record<string, number>
    questionNotes: Record<string, string>
    elapsedMs: number
  },
  nickname?: string,
): Promise<{ submission: { score: number; maxScore: number; percentage: number; passed: boolean } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
  }
  if (nickname) {
    headers['X-Participant-Nickname'] = nickname
  }

  const res = await fetch(`${WORKER_BASE_URL}/api/sessions/${encodeURIComponent(idOrSlug)}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** Fetch all submissions for a session (owner only) */
export async function fetchSessionSubmissions(id: string): Promise<{ submissions: SessionSubmission[] }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/sessions/${encodeURIComponent(id)}/submissions`, {
    headers: authHeaders(),
  })
  if (res.status === 401) { clearToken(); throw new Error('AUTH_REQUIRED') }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Fetch aggregated stats for a session (owner only) */
export async function fetchSessionStats(id: string): Promise<{ stats: SessionStats }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/sessions/${encodeURIComponent(id)}/stats`, {
    headers: authHeaders(),
  })
  if (res.status === 401) { clearToken(); throw new Error('AUTH_REQUIRED') }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Build the shareable session link (uses slug if available, otherwise ID) */
export function getSessionLink(session: ExamSession): string {
  const baseUrl = window.location.origin + window.location.pathname
  const identifier = session.slug ?? session.id
  return `${baseUrl}#/session/${identifier}`
}
