import { describe, it, expect, beforeEach } from 'bun:test'
import { fetchAuthStatus, getLoginUrl, logout } from '../src/utils/auth'
import { WORKER_BASE_URL } from '../src/utils/config'
import { storage, fetchCalls, mockFetch, resetMocks } from './helpers'

beforeEach(() => resetMocks())

// ─── fetchAuthStatus ─────────────────────────────────────────────────

describe('fetchAuthStatus', () => {
  it('returns authenticated user info', async () => {
    storage.set('isaqb-auth-token', 'test-jwt-token')
    mockFetch(() => Response.json({ authenticated: true, user: { id: 'github:1', provider: 'github', name: 'Alice', avatar: 'https://example.com/alice.png' } }))
    const status = await fetchAuthStatus()
    expect(status.authenticated).toBe(true)
    if (status.authenticated) {
      expect(status.user.name).toBe('Alice')
    }
    expect(fetchCalls[0].init?.headers).toBeDefined()
  })

  it('returns unauthenticated when no token exists', async () => {
    const status = await fetchAuthStatus()
    expect(status.authenticated).toBe(false)
    expect(fetchCalls).toHaveLength(0)
  })
})

// ─── getLoginUrl ─────────────────────────────────────────────────────

describe('getLoginUrl', () => {
  it('returns GitHub login URL with returnTo param', () => {
    expect(getLoginUrl('github', 'https://example.com')).toBe(`${WORKER_BASE_URL}/auth/github?returnTo=${encodeURIComponent('https://example.com')}`)
  })

  it('returns Google login URL with explicit returnTo', () => {
    expect(getLoginUrl('google', 'https://example.com/results')).toBe(`${WORKER_BASE_URL}/auth/google?returnTo=${encodeURIComponent('https://example.com/results')}`)
  })
})

// ─── logout ──────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears the auth token from localStorage', async () => {
    storage.set('isaqb-auth-token', 'some-jwt')
    await logout()
    expect(storage.has('isaqb-auth-token')).toBe(false)
  })
})
