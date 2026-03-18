import { WORKER_BASE_URL } from './leaderboardConfig'
import { authHeaders, clearToken } from './auth'
import type { Answers } from './scoring'

// ─── Types ───────────────────────────────────────────────────────────

/** A single leaderboard entry (public — no user ID) */
export interface LeaderboardEntry {
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

// ─── Leaderboard ─────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'isaqb-leaderboard-cache'
const CACHE_TTL_MS = 5 * 60 * 1000

interface CachedLeaderboard {
  entries: LeaderboardEntry[]
  fetchedAt: number
}

/** Fetch the leaderboard entries, optionally filtered by question version */
export async function fetchLeaderboard(commitSha?: string, forceRefresh = false): Promise<{
  entries: LeaderboardEntry[]
  fromCache: boolean
  fetchedAt: number
}> {
  const cacheKey = `${CACHE_KEY_PREFIX}:${commitSha ?? 'all'}`

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
    const url = commitSha
      ? `${WORKER_BASE_URL}/api/leaderboard?commitSha=${encodeURIComponent(commitSha)}`
      : `${WORKER_BASE_URL}/api/leaderboard`
    const res = await fetch(url, {
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
  localStorage.removeItem(`${CACHE_KEY_PREFIX}:all`)
  return res.json()
}

// ─── Versions ───────────────────────────────────────────────────────────

export interface LeaderboardVersion {
  commitSha: string
  entryCount: number
}

/** Fetch available leaderboard versions (commit SHAs with entries) */
export async function fetchLeaderboardVersions(): Promise<LeaderboardVersion[]> {
  try {
    const res = await fetch(`${WORKER_BASE_URL}/api/leaderboard/versions`)
    if (!res.ok) return []
    const data: { versions: LeaderboardVersion[] } = await res.json()
    return data.versions
  } catch {
    return []
  }
}
