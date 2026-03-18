import { describe, it, expect, beforeEach } from 'bun:test'
import {
  checkIsAdmin, adminFetchEntries, adminDeleteEntry, adminFetchBlocked,
  adminBlockUser, adminUnblockUser, adminFetchAdmins, adminAddAdmin, adminRemoveAdmin,
  type AdminLeaderboardEntry,
} from '../src/utils/admin'
import type { LeaderboardEntry } from '../src/utils/leaderboard'
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

const makeAdminEntry = (overrides: Partial<AdminLeaderboardEntry> = {}): AdminLeaderboardEntry => ({
  id: 'github:123',
  ...makeEntry(),
  ...overrides,
})

// ─── checkIsAdmin ────────────────────────────────────────────────────

describe('checkIsAdmin', () => {
  it('returns true when API confirms admin', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    mockFetch(() => Response.json({ isAdmin: true }))
    expect(await checkIsAdmin()).toBe(true)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/admin/check`)
  })

  it('returns false when API denies admin', async () => {
    storage.set('isaqb-auth-token', 'user-jwt')
    mockFetch(() => Response.json({ isAdmin: false }))
    expect(await checkIsAdmin()).toBe(false)
  })

  it('returns false on network error', async () => {
    storage.set('isaqb-auth-token', 'user-jwt')
    mockFetch(() => { throw new Error('network') })
    expect(await checkIsAdmin()).toBe(false)
  })
})

// ─── adminFetchEntries ───────────────────────────────────────────────

describe('adminFetchEntries', () => {
  it('fetches all entries from admin endpoint', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    const entries = [makeAdminEntry(), makeAdminEntry({ id: 'google:456' })]
    mockFetch(() => Response.json({ entries }))
    const result = await adminFetchEntries()
    expect(result).toEqual(entries)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/admin/leaderboard/entries`)
  })
})

// ─── adminDeleteEntry ────────────────────────────────────────────────

describe('adminDeleteEntry', () => {
  it('sends DELETE with userId and commitSha', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    mockFetch(() => Response.json({ ok: true, remaining: 0 }))
    await adminDeleteEntry('github:123', 'abc')
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/admin/leaderboard/entry`)
    expect(fetchCalls[0].init?.method).toBe('DELETE')
    const body = JSON.parse(fetchCalls[0].init?.body as string)
    expect(body).toEqual({ userId: 'github:123', commitSha: 'abc' })
  })
})

// ─── Blocked Users ───────────────────────────────────────────────────

describe('adminFetchBlocked', () => {
  it('fetches blocked user list', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    mockFetch(() => Response.json({ blocked: ['github:999'] }))
    const result = await adminFetchBlocked()
    expect(result).toEqual(['github:999'])
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/admin/leaderboard/blocked`)
  })
})

describe('adminBlockUser', () => {
  it('sends POST with userId to block', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    mockFetch(() => Response.json({ ok: true, blocked: ['github:999'] }))
    await adminBlockUser('github:999')
    expect(fetchCalls[0].init?.method).toBe('POST')
    const body = JSON.parse(fetchCalls[0].init?.body as string)
    expect(body).toEqual({ userId: 'github:999' })
  })
})

describe('adminUnblockUser', () => {
  it('sends DELETE with userId to unblock', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    mockFetch(() => Response.json({ ok: true, blocked: [] }))
    await adminUnblockUser('github:999')
    expect(fetchCalls[0].init?.method).toBe('DELETE')
    const body = JSON.parse(fetchCalls[0].init?.body as string)
    expect(body).toEqual({ userId: 'github:999' })
  })
})

// ─── Admin Management ────────────────────────────────────────────────

describe('adminFetchAdmins', () => {
  it('returns seed and dynamic admin lists', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    const adminData = { seedAdmins: ['github:1'], dynamicAdmins: [{ id: 'google:2', name: 'Alice' }] }
    mockFetch(() => Response.json(adminData))
    const result = await adminFetchAdmins()
    expect(result).toEqual(adminData)
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/admin/admins`)
  })
})

describe('adminAddAdmin', () => {
  it('sends POST with userId to add admin', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    mockFetch(() => Response.json({ ok: true, dynamicAdmins: [{ id: 'google:2', name: 'Test Admin' }] }))
    await adminAddAdmin('google:2', 'Test Admin')
    expect(fetchCalls[0].init?.method).toBe('POST')
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/admin/admins`)
  })
})

describe('adminRemoveAdmin', () => {
  it('sends DELETE with userId to remove admin', async () => {
    storage.set('isaqb-auth-token', 'admin-jwt')
    mockFetch(() => Response.json({ ok: true, dynamicAdmins: [] }))
    await adminRemoveAdmin('google:2')
    expect(fetchCalls[0].init?.method).toBe('DELETE')
    expect(fetchCalls[0].url).toBe(`${WORKER_BASE_URL}/api/admin/admins`)
    const body = JSON.parse(fetchCalls[0].init?.body as string)
    expect(body).toEqual({ userId: 'google:2' })
  })
})
