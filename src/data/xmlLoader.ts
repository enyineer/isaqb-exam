import type { Question } from './schema'
import { validateQuestions } from './schema'
import { parseQuestionXml } from './xmlParser'
import fallbackQuestions from './fallbackQuestions.json'

/** Thrown when GitHub returns 403 or 429 (rate limited) */
class RateLimitError extends Error {
  constructor(status: number) {
    super(`GitHub API rate limited (HTTP ${status})`)
    this.name = 'RateLimitError'
  }
}

const UPSTREAM_OWNER = 'isaqb-org'
const UPSTREAM_REPO = 'foundation-exam-questions'
const QUESTIONS_PATH = 'mock/questions'
const GITHUB_API_URL = `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/contents/${QUESTIONS_PATH}`
const COMMITS_API_URL = `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/commits?path=${QUESTIONS_PATH}&per_page=1`
const RAW_BASE_URL = `https://raw.githubusercontent.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/main/${QUESTIONS_PATH}`

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
 * Discover XML question files via the GitHub Contents API.
 * Returns an array of filenames like ["mock-01.xml", "mock-02.xml", ...].
 */
async function discoverQuestionFiles(): Promise<string[]> {
  const res = await fetch(GITHUB_API_URL)
  if (res.status === 403 || res.status === 429) throw new RateLimitError(res.status)
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`)
  const entries: Array<{ name: string; type: string }> = await res.json()
  return entries
    .filter(e => e.type === 'file' && e.name.endsWith('.xml'))
    .map(e => e.name)
    .sort()
}

/**
 * Fetch the latest commit SHA for the questions directory.
 */
async function fetchLatestCommitSha(): Promise<string> {
  const res = await fetch(COMMITS_API_URL)
  if (res.status === 403 || res.status === 429) throw new RateLimitError(res.status)
  if (!res.ok) throw new Error(`Commits API returned ${res.status}`)
  const commits: Array<{ sha: string }> = await res.json()
  if (commits.length === 0) throw new Error('No commits found for questions path')
  return commits[0].sha
}

/**
 * Fetch and parse all question XML files from GitHub.
 * Returns the questions along with the upstream commit SHA.
 */
async function fetchLiveQuestions(): Promise<{ questions: Question[]; commitSha: string }> {
  const [filenames, commitSha] = await Promise.all([
    discoverQuestionFiles(),
    fetchLatestCommitSha(),
  ])

  const results = await Promise.all(
    filenames.map(async (filename) => {
      const res = await fetch(`${RAW_BASE_URL}/${filename}`)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${filename}`)
      const xml = await res.text()
      return parseQuestionXml(xml, new DOMParser())
    })
  )

  const validation = validateQuestions(results)
  if (!validation.success) {
    console.warn('Live XML validation failed:', validation.error.issues)
    throw new Error('Schema validation failed')
  }

  return { questions: validation.data, commitSha }
}

export interface LoadResult {
  questions: Question[]
  source: 'live' | 'fallback' | 'cached'
  fetchedAt: number | null // unix timestamp ms, null for fallback
  /** Commit SHA of the upstream question source (null for fallback) */
  commitSha: string | null
  /** True if the live fetch failed due to GitHub API rate limiting */
  rateLimited: boolean
}

/**
 * Load questions with caching:
 * 1. If a valid cache exists and TTL hasn't expired → return cached
 * 2. Otherwise fetch live from GitHub → cache and return
 * 3. On any error → return bundled fallback JSON
 */
export async function loadQuestions(forceRefresh = false): Promise<LoadResult> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = readCache()
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
      return { questions: cached.questions, source: 'cached', fetchedAt: cached.fetchedAt, commitSha: cached.commitSha ?? null, rateLimited: false }
    }
  }

  // Try live fetch
  try {
    const { questions, commitSha } = await fetchLiveQuestions()
    writeCache(questions, commitSha)
    return { questions, source: 'live', fetchedAt: Date.now(), commitSha, rateLimited: false }
  } catch (err) {
    const isRateLimited = err instanceof RateLimitError
    console.warn('Falling back to bundled questions:', (err as Error).message)

    // If we have a stale cache, prefer it over the static fallback
    const staleCache = readCache()
    if (staleCache) {
      return { questions: staleCache.questions, source: 'cached', fetchedAt: staleCache.fetchedAt, commitSha: staleCache.commitSha ?? null, rateLimited: isRateLimited }
    }

    return { questions: fallbackQuestions as Question[], source: 'fallback', fetchedAt: null, commitSha: null, rateLimited: isRateLimited }
  }
}

/**
 * Get the timestamp of the last successful fetch from cache.
 */
export function getCachedFetchTime(): number | null {
  const cached = readCache()
  return cached?.fetchedAt ?? null
}
