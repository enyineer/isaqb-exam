/**
 * Tests for the session API client functions (src/utils/sessions.ts).
 * Follows the same mock fetch pattern as auth.test.ts and leaderboard.test.ts.
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import {
  createSession,
  fetchSessions,
  fetchSession,
  updateSession,
  deleteSession,
  submitSessionExam,
  fetchSessionSubmissions,
  fetchSessionStats,
  getSessionLink,
} from '../src/utils/sessions'
import { WORKER_BASE_URL } from '../src/utils/leaderboardConfig'
import { storage, fetchCalls, mockFetch, resetMocks } from './helpers'
import type { ExamSession } from '../src/data/sessionSchema'

const mockSession: ExamSession = {
  id: 'test-session-id',
  slug: 'test-slug',
  creatorId: 'github:1',
  creatorName: 'Alice',
  title: 'Test Session',
  description: 'A test session',
  startTime: '2026-03-20T10:00:00.000Z',
  endTime: '2026-03-20T12:00:00.000Z',
  commitSha: 'abc123',
  createdAt: '2026-03-19T10:00:00.000Z',
  updatedAt: '2026-03-19T10:00:00.000Z',
}

beforeEach(() => resetMocks())

// ─── createSession ──────────────────────────────────────────────────

describe('createSession', () => {
  it('sends POST with correct body and returns created session', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({ session: mockSession }, { status: 201 }))

    const result = await createSession({
      title: 'Test Session',
      description: 'A test session',
      slug: 'test-slug',
      startTime: '2026-03-20T10:00:00.000Z',
      endTime: '2026-03-20T12:00:00.000Z',
      commitSha: 'abc123',
    })

    expect(result.session.id).toBe('test-session-id')
    expect(result.session.slug).toBe('test-slug')
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions`)
    expect(fetchCalls[0].init?.method).toBe('POST')
    expect(fetchCalls[0].init?.headers).toHaveProperty('Authorization')
  })

  it('throws AUTH_REQUIRED on 401', async () => {
    storage.set('isaqb-auth-token', 'expired')
    mockFetch(() => new Response(null, { status: 401 }))
    await expect(createSession({
      title: 'X', startTime: 'x', endTime: 'x', commitSha: 'x',
    })).rejects.toThrow('AUTH_REQUIRED')
  })

  it('throws on 409 slug conflict', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({ error: 'This slug is already taken.' }, { status: 409 }))
    await expect(createSession({
      title: 'X', slug: 'taken', startTime: 'x', endTime: 'x', commitSha: 'x',
    })).rejects.toThrow('slug is already taken')
  })
})

// ─── fetchSessions ──────────────────────────────────────────────────

describe('fetchSessions', () => {
  it('fetches user sessions with auth header', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({ sessions: [mockSession] }))

    const result = await fetchSessions()
    expect(result.sessions).toHaveLength(1)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions`)
    expect(fetchCalls[0].init?.headers).toHaveProperty('Authorization')
  })

  it('handles empty sessions list', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({ sessions: [] }))
    const result = await fetchSessions()
    expect(result.sessions).toHaveLength(0)
  })
})

// ─── fetchSession ───────────────────────────────────────────────────

describe('fetchSession', () => {
  it('fetches session by ID (public, no auth required)', async () => {
    mockFetch(() => Response.json({ session: mockSession }))
    const result = await fetchSession('test-session-id')
    expect(result.session.title).toBe('Test Session')
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions/test-session-id`)
  })

  it('fetches session by slug', async () => {
    mockFetch(() => Response.json({ session: mockSession }))
    const result = await fetchSession('test-slug')
    expect(result.session.slug).toBe('test-slug')
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions/test-slug`)
  })

  it('throws SESSION_NOT_FOUND on 404', async () => {
    mockFetch(() => new Response(null, { status: 404 }))
    await expect(fetchSession('nonexistent')).rejects.toThrow('SESSION_NOT_FOUND')
  })
})

// ─── updateSession ──────────────────────────────────────────────────

describe('updateSession', () => {
  it('sends PUT with partial update body', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({ session: { ...mockSession, title: 'Updated' } }))

    const result = await updateSession('test-session-id', { title: 'Updated' })
    expect(result.session.title).toBe('Updated')
    expect(fetchCalls[0].init?.method).toBe('PUT')
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions/test-session-id`)
  })
})

// ─── deleteSession ──────────────────────────────────────────────────

describe('deleteSession', () => {
  it('sends DELETE request', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({ ok: true }))

    await deleteSession('test-session-id')
    expect(fetchCalls[0].init?.method).toBe('DELETE')
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions/test-session-id`)
  })
})

// ─── submitSessionExam ──────────────────────────────────────────────

describe('submitSessionExam', () => {
  it('sends POST with answers and auth', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json(
      { submission: { score: 10, maxScore: 20, percentage: 50, passed: false } },
      { status: 201 },
    ))

    const result = await submitSessionExam('test-slug', {
      answers: { q1: ['a'] },
      questionTimes: { q1: 5000 },
      questionNotes: { q1: 'my note' },
      elapsedMs: 30000,
    })

    expect(result.submission.percentage).toBe(50)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions/test-slug/submit`)
    expect(fetchCalls[0].init?.method).toBe('POST')
  })

  it('sends X-Participant-Nickname for guest participants', async () => {
    mockFetch(() => Response.json(
      { submission: { score: 15, maxScore: 20, percentage: 75, passed: true } },
      { status: 201 },
    ))

    await submitSessionExam('test-slug', {
      answers: { q1: ['a'] },
      questionTimes: { q1: 5000 },
      questionNotes: {},
      elapsedMs: 20000,
    }, 'Bob')

    expect(fetchCalls[0].init?.headers).toHaveProperty('X-Participant-Nickname', 'Bob')
  })
})

// ─── fetchSessionSubmissions ────────────────────────────────────────

describe('fetchSessionSubmissions', () => {
  it('fetches submissions with auth', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({ submissions: [] }))

    const result = await fetchSessionSubmissions('test-session-id')
    expect(result.submissions).toHaveLength(0)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions/test-session-id/submissions`)
  })
})

// ─── fetchSessionStats ──────────────────────────────────────────────

describe('fetchSessionStats', () => {
  it('fetches stats with auth', async () => {
    storage.set('isaqb-auth-token', 'jwt')
    mockFetch(() => Response.json({
      stats: {
        totalSubmissions: 5,
        averagePercentage: 65,
        passRate: 60,
        questionStats: [],
      },
    }))

    const result = await fetchSessionStats('test-session-id')
    expect(result.stats.totalSubmissions).toBe(5)
    expect(result.stats.passRate).toBe(60)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/sessions/test-session-id/stats`)
  })
})

// ─── getSessionLink ─────────────────────────────────────────────────

describe('getSessionLink', () => {
  // Mock window.location for test environment
  const originalWindow = globalThis.window
  beforeEach(() => {
    globalThis.window = { location: { origin: 'https://example.com', pathname: '/app/' } } as any
  })

  it('uses slug when available', () => {
    const link = getSessionLink(mockSession)
    expect(link).toContain('#/session/test-slug')
    expect(link).not.toContain('test-session-id')
  })

  it('falls back to ID when no slug', () => {
    const noSlugSession = { ...mockSession, slug: null }
    const link = getSessionLink(noSlugSession)
    expect(link).toContain('#/session/test-session-id')
  })
})
