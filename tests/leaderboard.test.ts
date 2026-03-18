import { describe, it, expect, beforeEach } from 'bun:test'
import { fetchLeaderboard, submitToLeaderboard, fetchAuthStatus, getLoginUrl, logout, type LeaderboardEntry } from '../src/utils/leaderboard'
import { WORKER_BASE_URL } from '../src/utils/leaderboardConfig'

// Mock localStorage
const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
}
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true })

// Track fetch calls
let fetchCalls: Array<{ url: string; init?: RequestInit }> = []
const originalFetch = globalThis.fetch

beforeEach(() => {
  storage.clear()
  fetchCalls = []
  globalThis.fetch = originalFetch
})

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const mockFn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    fetchCalls.push({ url, init })
    return handler(url, init)
  }
  // Bun adds a `preconnect` property to the fetch type
  ;(mockFn as any).preconnect = () => {}
  globalThis.fetch = mockFn as typeof fetch
}

// ─── Test Data ───────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  id: 'github:123',
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
      makeEntry({ id: 'google:456', provider: 'google', displayName: 'Bob', percentage: 50, passed: false }),
    ]

    mockFetch(() => Response.json({ entries }))
    const result = await fetchLeaderboard(testSha)
    expect(result.entries).toEqual(entries)
    expect(result.fromCache).toBe(false)
    expect(result.fetchedAt).toBeGreaterThan(0)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/leaderboard?commitSha=${testSha}`)
  })

  it('returns cached data when TTL is valid', async () => {
    const entries = [makeEntry({ id: 'cached:1', displayName: 'Cached' })]
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
    const oldEntries = [makeEntry({ id: 'old:1', displayName: 'Old' })]
    storage.set(cacheKey, JSON.stringify({
      entries: oldEntries,
      fetchedAt: Date.now(),
    }))

    const newEntries = [makeEntry({ id: 'new:1', displayName: 'New', percentage: 100 })]
    mockFetch(() => Response.json({ entries: newEntries }))
    const result = await fetchLeaderboard(testSha, true)
    expect(result.entries).toEqual(newEntries)
    expect(result.fromCache).toBe(false)
  })

  it('returns stale cache on fetch failure', async () => {
    const staleEntries = [makeEntry({ id: 'stale:1', displayName: 'Stale' })]
    storage.set(cacheKey, JSON.stringify({
      entries: staleEntries,
      fetchedAt: Date.now() - 10 * 60 * 1000, // Expired TTL
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

// ─── Auth helpers ────────────────────────────────────────────────────

describe('fetchAuthStatus', () => {
  it('returns authenticated user info', async () => {
    // Need a token in storage for fetchAuthStatus to make the request
    storage.set('isaqb-auth-token', 'test-jwt-token')
    mockFetch(() => Response.json({ authenticated: true, user: { id: 'github:1', provider: 'github', name: 'Alice', avatar: 'https://example.com/alice.png' } }))
    const status = await fetchAuthStatus()
    expect(status.authenticated).toBe(true)
    if (status.authenticated) {
      expect(status.user.name).toBe('Alice')
    }
    // Verify Authorization header was sent
    expect(fetchCalls[0].init?.headers).toBeDefined()
  })

  it('returns unauthenticated when no token exists', async () => {
    // No token in storage — should not make a fetch call
    const status = await fetchAuthStatus()
    expect(status.authenticated).toBe(false)
    expect(fetchCalls).toHaveLength(0)
  })
})

describe('getLoginUrl', () => {
  it('returns GitHub login URL with returnTo param', () => {
    expect(getLoginUrl('github', 'https://example.com')).toBe(`${WORKER_BASE_URL}/auth/github?returnTo=${encodeURIComponent('https://example.com')}`)
  })

  it('returns Google login URL with explicit returnTo', () => {
    expect(getLoginUrl('google', 'https://example.com/results')).toBe(`${WORKER_BASE_URL}/auth/google?returnTo=${encodeURIComponent('https://example.com/results')}`)
  })
})

describe('logout', () => {
  it('clears the auth token from localStorage', async () => {
    storage.set('isaqb-auth-token', 'some-jwt')
    await logout()
    expect(storage.has('isaqb-auth-token')).toBe(false)
  })
})
