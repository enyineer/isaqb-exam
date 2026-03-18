import { describe, it, expect, beforeEach } from 'bun:test'
import {
  fetchLeaderboard, submitToLeaderboard,
  type LeaderboardEntry,
} from '../src/utils/leaderboard'
import { WORKER_BASE_URL } from '../src/utils/leaderboardConfig'
import { storage, fetchCalls, mockFetch, resetMocks } from './helpers'

beforeEach(() => resetMocks())

// ─── Test Data ───────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  provider: 'github' as const,
  displayName: 'Alice',
  avatarUrl: 'https://example.com/alice.png',
  score: 30,
  maxScore: 40,
  percentage: 75,
  passed: true,
  timeMs: 60000,
  commitSha: 'abc',
  submittedAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

// ─── fetchLeaderboard ────────────────────────────────────────────────

describe('fetchLeaderboard', () => {
  const testSha = 'abc123'
  const cacheKey = `isaqb-leaderboard-cache:${testSha}`

  it('fetches entries from the Worker API', async () => {
    const entries = [
      makeEntry(),
      makeEntry({ provider: 'google', displayName: 'Bob', percentage: 50, passed: false }),
    ]

    mockFetch(() => Response.json({ entries }))
    const result = await fetchLeaderboard(testSha)
    expect(result.entries).toEqual(entries)
    expect(result.fromCache).toBe(false)
    expect(result.fetchedAt).toBeGreaterThan(0)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/leaderboard?commitSha=${testSha}`)
  })

  it('returns cached data when TTL is valid', async () => {
    const entries = [makeEntry({ displayName: 'Cached' })]
    storage.set(cacheKey, JSON.stringify({
      entries,
      fetchedAt: Date.now(),
    }))

    mockFetch(() => { throw new Error('should not fetch') })
    const result = await fetchLeaderboard(testSha)
    expect(result.entries).toEqual(entries)
    expect(result.fromCache).toBe(true)
    expect(fetchCalls).toHaveLength(0)
  })

  it('skips cache when forceRefresh is true', async () => {
    const oldEntries = [makeEntry({ displayName: 'Old' })]
    storage.set(cacheKey, JSON.stringify({
      entries: oldEntries,
      fetchedAt: Date.now(),
    }))

    const newEntries = [makeEntry({ displayName: 'New', percentage: 100 })]
    mockFetch(() => Response.json({ entries: newEntries }))
    const result = await fetchLeaderboard(testSha, true)
    expect(result.entries).toEqual(newEntries)
    expect(result.fromCache).toBe(false)
  })

  it('returns stale cache on fetch failure', async () => {
    const staleEntries = [makeEntry({ displayName: 'Stale' })]
    storage.set(cacheKey, JSON.stringify({
      entries: staleEntries,
      fetchedAt: Date.now() - 10 * 60 * 1000,
    }))

    mockFetch(() => new Response(null, { status: 500 }))
    const result = await fetchLeaderboard(testSha)
    expect(result.entries).toEqual(staleEntries)
    expect(result.fromCache).toBe(true)
  })

  it('throws when fetch fails and no cache exists', async () => {
    mockFetch(() => new Response(null, { status: 500 }))
    await expect(fetchLeaderboard(testSha)).rejects.toThrow('Failed to fetch leaderboard')
  })
})

// ─── submitToLeaderboard ─────────────────────────────────────────────

describe('submitToLeaderboard', () => {
  it('posts submission to the Worker API', async () => {
    const entry = makeEntry()
    mockFetch(() => new Response(JSON.stringify({ entry }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    const result = await submitToLeaderboard('abc', { q1: ['a'] }, 60000)
    expect(result.entry).toEqual(entry)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/leaderboard`)
    expect(fetchCalls[0].init?.method).toBe('POST')
  })

  it('throws AUTH_REQUIRED on 401', async () => {
    mockFetch(() => new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }))
    await expect(submitToLeaderboard('abc', {}, 1000)).rejects.toThrow('AUTH_REQUIRED')
  })

  it('clears cache on successful submit', async () => {
    const sha = 'x'
    storage.set(`isaqb-leaderboard-cache:${sha}`, JSON.stringify({ entries: [], fetchedAt: Date.now() }))
    const entry = makeEntry()
    mockFetch(() => new Response(JSON.stringify({ entry }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    await submitToLeaderboard(sha, {}, 1000)
    expect(storage.has(`isaqb-leaderboard-cache:${sha}`)).toBe(false)
  })
})
