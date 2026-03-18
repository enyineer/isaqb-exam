import { WORKER_BASE_URL } from './leaderboardConfig'
import type { Answers } from './scoring'

// ─── Types ───────────────────────────────────────────────────────────

/** A single leaderboard entry */
export interface LeaderboardEntry {
  /** Unique user ID (provider:userId) */
  id: string
  /** OAuth provider */
  provider: 'github' | 'google'
  /** Display name */
  displayName: string
  /** Avatar URL */
  avatarUrl: string
  /** Verified score (points earned) */
  score: number
  /** Maximum possible score */
  maxScore: number
  /** Score percentage (0–100) */
  percentage: number
  /** Whether the user passed */
  passed: boolean
  /** Elapsed time in ms */
  timeMs: number
  /** When the score was submitted */
  submittedAt: string
  /** Upstream commit SHA of the questions used */
  commitSha: string
}

export type AuthStatus =
  | { authenticated: false }
  | { authenticated: true; user: { id: string; provider: string; name: string; avatar: string } }

// ─── Token Management ────────────────────────────────────────────────

const TOKEN_KEY = 'isaqb-auth-token'

/** Store the auth token in localStorage */
export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Get the stored auth token */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** Clear the stored auth token */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** Build Authorization headers if a token exists */
function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Extract token from URL query params (after OAuth redirect) */
export function extractTokenFromUrl(): string | null {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('token')
  if (token) {
    // Store the token
    storeToken(token)
    // Clean the token from the URL without losing the hash
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.toString())
  }
  return token
}

// ─── Leaderboard ─────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'isaqb-leaderboard-cache'
const CACHE_TTL_MS = 5 * 60 * 1000

interface CachedLeaderboard {
  entries: LeaderboardEntry[]
  fetchedAt: number
}

/** Fetch the leaderboard entries for a specific question version, with local caching */
export async function fetchLeaderboard(commitSha: string, forceRefresh = false): Promise<{
  entries: LeaderboardEntry[]
  fromCache: boolean
  fetchedAt: number
}> {
  const cacheKey = `${CACHE_KEY_PREFIX}:${commitSha}`

  // Check local cache first
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const cached: CachedLeaderboard = JSON.parse(raw)
        if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
          return { entries: cached.entries, fromCache: true, fetchedAt: cached.fetchedAt }
        }
      }
    } catch { /* ignore corrupt cache */ }
  }

  // Fetch from Worker API
  try {
    const res = await fetch(`${WORKER_BASE_URL}/api/leaderboard?commitSha=${encodeURIComponent(commitSha)}`, {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: { entries: LeaderboardEntry[] } = await res.json()
    const fetchedAt = Date.now()

    // Update cache
    const cacheData: CachedLeaderboard = { entries: data.entries, fetchedAt }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))

    return { entries: data.entries, fromCache: false, fetchedAt }
  } catch {
    // Fall back to stale cache
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const cached: CachedLeaderboard = JSON.parse(raw)
        return { entries: cached.entries, fromCache: true, fetchedAt: cached.fetchedAt }
      }
    } catch { /* ignore */ }
    throw new Error('Failed to fetch leaderboard')
  }
}

/** Submit an exam result to the leaderboard */
export async function submitToLeaderboard(
  commitSha: string,
  answers: Answers,
  timeMs: number,
): Promise<{ entry: LeaderboardEntry }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/leaderboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ commitSha, answers, elapsedMs: timeMs }),
  })

  if (res.status === 401) {
    clearToken()
    throw new Error('AUTH_REQUIRED')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  // Clear cache for this commitSha so next fetch gets fresh data
  localStorage.removeItem(`${CACHE_KEY_PREFIX}:${commitSha}`)
  return res.json()
}

// ─── Auth ────────────────────────────────────────────────────────────

/** Check current authentication status */
export async function fetchAuthStatus(): Promise<AuthStatus> {
  const token = getToken()
  if (!token) return { authenticated: false }

  try {
    const res = await fetch(`${WORKER_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { authenticated: false }
    return res.json()
  } catch {
    return { authenticated: false }
  }
}

/** Get the OAuth login URL for a given provider, with returnTo defaulting to current page */
export function getLoginUrl(provider: 'github' | 'google', returnTo?: string): string {
  const target = returnTo ?? window.location.href
  return `${WORKER_BASE_URL}/auth/${provider}?returnTo=${encodeURIComponent(target)}`
}

/** Log out (clear local token) */
export async function logout(): Promise<void> {
  clearToken()
}
