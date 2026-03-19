import type { Question } from './schema'
import { validateQuestions } from './schema'
import fallbackQuestions from './fallbackQuestions.json'
import { WORKER_BASE_URL } from '../utils/config'

const CACHE_KEY = 'isaqb-questions-cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 60 minutes

interface CachedData {
  questions: Question[]
  fetchedAt: number // unix timestamp ms
  source: 'live'
  /** Commit SHA of the upstream question source at fetch time */
  commitSha: string
}

function readCache(): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: CachedData = JSON.parse(raw)
    if (!parsed.questions || !parsed.fetchedAt) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(questions: Question[], commitSha: string): void {
  const data: CachedData = { questions, fetchedAt: Date.now(), source: 'live', commitSha }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Fetch questions from the Worker API.
 * The worker proxies the GitHub API with a PAT (no rate limits)
 * and caches by commit SHA.
 */
async function fetchLiveQuestions(): Promise<{ questions: Question[]; commitSha: string }> {
  const res = await fetch(`${WORKER_BASE_URL}/api/questions`)

  if (!res.ok) {
    throw new Error(`Worker API returned ${res.status}`)
  }

  const data: { questions: unknown[]; commitSha: string } = await res.json()

  const validation = validateQuestions(data.questions)
  if (!validation.success) {
    console.warn('Worker response validation failed:', validation.error.issues)
    throw new Error('Schema validation failed')
  }

  return { questions: validation.data, commitSha: data.commitSha }
}

export interface LoadResult {
  questions: Question[]
  source: 'live' | 'fallback' | 'cached'
  fetchedAt: number | null // unix timestamp ms, null for fallback
  /** Commit SHA of the upstream question source (null for fallback) */
  commitSha: string | null
}

/**
 * Load questions with caching:
 * 1. If a valid cache exists and TTL hasn't expired → return cached
 * 2. Otherwise fetch from Worker API → cache and return
 * 3. On any error → return bundled fallback JSON
 */
export async function loadQuestions(forceRefresh = false): Promise<LoadResult> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = readCache()
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
      return { questions: cached.questions, source: 'cached', fetchedAt: cached.fetchedAt, commitSha: cached.commitSha ?? null }
    }
  }

  // Try live fetch from Worker
  try {
    const { questions, commitSha } = await fetchLiveQuestions()
    writeCache(questions, commitSha)
    return { questions, source: 'live', fetchedAt: Date.now(), commitSha }
  } catch (err) {
    console.warn('Falling back to bundled questions:', (err as Error).message)

    // If we have a stale cache, prefer it over the static fallback
    const staleCache = readCache()
    if (staleCache) {
      return { questions: staleCache.questions, source: 'cached', fetchedAt: staleCache.fetchedAt, commitSha: staleCache.commitSha ?? null }
    }

    return { questions: fallbackQuestions as Question[], source: 'fallback', fetchedAt: null, commitSha: null }
  }
}

/**
 * Get the timestamp of the last successful fetch from cache.
 */
export function getCachedFetchTime(): number | null {
  const cached = readCache()
  return cached?.fetchedAt ?? null
}
