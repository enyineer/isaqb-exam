import type { Question } from './schema'
import { validateQuestions } from './schema'
import { parseQuestionXml } from './xmlParser'
import fallbackQuestions from './fallbackQuestions.json'

const GITHUB_API_URL = 'https://api.github.com/repos/isaqb-org/foundation-exam-questions/contents/mock/questions'
const RAW_BASE_URL = 'https://raw.githubusercontent.com/isaqb-org/foundation-exam-questions/main/mock/questions'

const CACHE_KEY = 'isaqb-questions-cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 60 minutes

interface CachedData {
  questions: Question[]
  fetchedAt: number // unix timestamp ms
  source: 'live'
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

function writeCache(questions: Question[]): void {
  const data: CachedData = { questions, fetchedAt: Date.now(), source: 'live' }
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
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`)
  const entries: Array<{ name: string; type: string }> = await res.json()
  return entries
    .filter(e => e.type === 'file' && e.name.endsWith('.xml'))
    .map(e => e.name)
    .sort()
}

/**
 * Fetch and parse all question XML files from GitHub.
 */
async function fetchLiveQuestions(): Promise<Question[]> {
  const filenames = await discoverQuestionFiles()

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

  return validation.data
}

export interface LoadResult {
  questions: Question[]
  source: 'live' | 'fallback' | 'cached'
  fetchedAt: number | null // unix timestamp ms, null for fallback
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
      return { questions: cached.questions, source: 'cached', fetchedAt: cached.fetchedAt }
    }
  }

  // Try live fetch
  try {
    const questions = await fetchLiveQuestions()
    writeCache(questions)
    return { questions, source: 'live', fetchedAt: Date.now() }
  } catch (err) {
    console.warn('Falling back to bundled questions:', (err as Error).message)

    // If we have a stale cache, prefer it over the static fallback
    const staleCache = readCache()
    if (staleCache) {
      return { questions: staleCache.questions, source: 'cached', fetchedAt: staleCache.fetchedAt }
    }

    return { questions: fallbackQuestions as Question[], source: 'fallback', fetchedAt: null }
  }
}

/**
 * Get the timestamp of the last successful fetch from cache.
 */
export function getCachedFetchTime(): number | null {
  const cached = readCache()
  return cached?.fetchedAt ?? null
}
