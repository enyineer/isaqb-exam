import {
  LEADERBOARD_REPO_OWNER,
  LEADERBOARD_REPO_NAME,
  LEADERBOARD_DISCUSSION_NUMBER,
  GITHUB_REST_API,
  LEADERBOARD_COMMENT_MARKER,
  LEADERBOARD_SCHEMA_VERSION,
} from './leaderboardConfig'
import type { Answers } from './scoring'

// ─── Types ───────────────────────────────────────────────────────────

/** A single parsed leaderboard entry */
export interface LeaderboardEntry {
  /** Schema version of this entry */
  version: number
  /** GitHub username */
  username: string
  /** GitHub avatar URL */
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

/** JSON shape embedded in Discussion comments by the Action */
export interface LeaderboardPayload {
  v: number
  score: number
  max: number
  pct: number
  passed: boolean
  timeMs: number
  commitSha: string
  ts: string
}

// ─── Submit URL Builder ──────────────────────────────────────────────

/** Shape of the submission payload embedded in the Issue body */
interface SubmissionPayload {
  v: number
  commitSha: string
  answers: Answers
  elapsedMs: number
}

/**
 * Build a pre-filled GitHub Issue URL for leaderboard submission.
 * The Issue body contains a JSON payload that the Action will parse.
 */
export function buildSubmitUrl(
  commitSha: string,
  answers: Answers,
  elapsedMs: number,
): string {
  const payload: SubmissionPayload = {
    v: LEADERBOARD_SCHEMA_VERSION,
    commitSha,
    answers,
    elapsedMs,
  }

  const jsonPayload = JSON.stringify(payload)
  const title = '🏆 Leaderboard Submission'
  const body = `${LEADERBOARD_COMMENT_MARKER}\n\`\`\`json\n${jsonPayload}\n\`\`\``
  const labels = 'leaderboard-submission'

  const params = new URLSearchParams({
    title,
    body,
    labels,
  })

  return `https://github.com/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues/new?${params.toString()}`
}

// ─── Leaderboard Cache ───────────────────────────────────────────────

const LEADERBOARD_CACHE_KEY = 'isaqb-leaderboard-cache'
const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_TAIL_PAGES = 10 // Max tail pages to fetch per refresh

/** Permanently cached page data */
interface CachedPage {
  entries: LeaderboardEntry[]
  etag: string | null
}

/**
 * Cache structure with per-page ETag validation.
 *
 * Full pages (100 raw comments) are normally immutable in an append-only
 * discussion. However, if a comment is deleted, all subsequent pages shift.
 * We detect this by validating the *last* permanent page's ETag on each
 * refresh — a deletion anywhere before it causes its content to change.
 */
interface LeaderboardCache {
  /** Permanently cached full pages, keyed by page number */
  pages: Record<number, CachedPage>
  /** The highest page number that returned exactly 100 raw comments */
  lastFullPage: number
  /** Parsed entries from the last fetch of tail pages */
  tailEntries: LeaderboardEntry[]
  /** ETag from the first tail page (page after lastFullPage) */
  tailEtag: string | null
  /** When the tail was last refreshed */
  fetchedAt: number
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[]
  fetchedAt: number
  fromCache: boolean
  /** True if the request was rate-limited and stale cache was used */
  rateLimited: boolean
}

function readCache(): LeaderboardCache | null {
  try {
    const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY)
    if (!raw) return null
    const parsed: LeaderboardCache = JSON.parse(raw)
    if (!parsed.fetchedAt || !parsed.pages) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(cache: LeaderboardCache): void {
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function collectAllEntries(cache: LeaderboardCache): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = []
  // Collect from permanent pages in order
  for (let p = 1; p <= cache.lastFullPage; p++) {
    const page = cache.pages[p]
    if (page) entries.push(...page.entries)
  }
  // Append tail entries
  entries.push(...cache.tailEntries)
  return entries
}

function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage
    return a.timeMs - b.timeMs
  })
}

// ─── Leaderboard Reader ──────────────────────────────────────────────

interface DiscussionCommentAuthor {
  login: string
  avatar_url: string
}

interface DiscussionComment {
  body: string
  created_at: string
  user: DiscussionCommentAuthor
  author_association: string
}

function commentsUrl(page: number): string {
  return `${GITHUB_REST_API}/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/discussions/${LEADERBOARD_DISCUSSION_NUMBER}/comments?per_page=100&page=${page}`
}

async function fetchPage(page: number, extraHeaders: Record<string, string> = {}): Promise<Response | null> {
  return fetch(commentsUrl(page), {
    headers: { Accept: 'application/vnd.github+json', ...extraHeaders },
  }).catch(() => null)
}

function parseCommentsToEntries(comments: DiscussionComment[]): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = []
  for (const comment of comments) {
    const entry = parseLeaderboardComment(comment)
    if (entry) entries.push(entry)
  }
  return entries
}

/**
 * Validate the permanent page cache by walking backward through page ETags.
 *
 * If the last permanent page's ETag changed (content shifted due to a deletion),
 * we walk backward to find the first page whose ETag is still valid. Pages before
 * the invalidation point are kept; pages from that point onward are cleared.
 *
 * This minimizes re-fetching: a deletion on page 8 of 10 only clears pages 8–10.
 */
async function validatePermanentCache(
  cache: LeaderboardCache,
): Promise<{ validatedCache: LeaderboardCache; invalidated: boolean }> {
  if (cache.lastFullPage === 0) {
    return { validatedCache: cache, invalidated: false }
  }

  const lastPage = cache.pages[cache.lastFullPage]
  if (!lastPage?.etag) {
    // No ETag stored — can't validate, clear all
    return {
      validatedCache: { pages: {}, lastFullPage: 0, tailEntries: [], tailEtag: null, fetchedAt: cache.fetchedAt },
      invalidated: true,
    }
  }

  // Check the last permanent page first
  const lastRes = await fetchPage(cache.lastFullPage, { 'If-None-Match': lastPage.etag })

  if (!lastRes) {
    // Network error — assume cache is still valid
    return { validatedCache: cache, invalidated: false }
  }

  if (lastRes.status === 304) {
    // Last page unchanged — all permanent pages are valid
    return { validatedCache: cache, invalidated: false }
  }

  if (lastRes.status === 403 || lastRes.status === 429) {
    // Rate limited — assume cache is still valid
    return { validatedCache: cache, invalidated: false }
  }

  // Last page changed — walk backward to find the invalidation point
  let firstInvalidPage = 1 // worst case: everything is invalid

  for (let page = cache.lastFullPage - 1; page >= 1; page--) {
    const cachedPage = cache.pages[page]
    if (!cachedPage?.etag) {
      // No ETag — can't verify, assume this page is also invalid
      firstInvalidPage = page
      continue
    }

    const res = await fetchPage(page, { 'If-None-Match': cachedPage.etag })

    if (!res || res.status === 403 || res.status === 429) {
      // Network/rate error — conservatively assume everything from here is invalid
      firstInvalidPage = page
      break
    }

    if (res.status === 304) {
      // This page is still valid — invalidation starts at the next page
      firstInvalidPage = page + 1
      break
    }

    // Content changed — this page is also invalid, keep walking back
    firstInvalidPage = page
  }

  // Keep pages before the invalidation point, clear the rest
  const validPages: Record<number, CachedPage> = {}
  const newLastFullPage = firstInvalidPage - 1

  for (let p = 1; p <= newLastFullPage; p++) {
    if (cache.pages[p]) {
      validPages[p] = cache.pages[p]
    }
  }

  return {
    validatedCache: {
      pages: validPages,
      lastFullPage: newLastFullPage,
      tailEntries: [],
      tailEtag: null,
      fetchedAt: cache.fetchedAt,
    },
    invalidated: true,
  }
}

/**
 * Fetch leaderboard entries from the GitHub Discussion.
 *
 * Caching strategy:
 * 1. **Permanent page cache**: Full pages (100 comments) are cached with their
 *    ETags. On each refresh the last permanent page's ETag is validated — if it
 *    changed (comment deletion), all permanent pages are invalidated and re-fetched.
 * 2. **Tail fetch**: Only pages after the last known full page are re-fetched
 *    (up to MAX_TAIL_PAGES = 10). This is where new entries appear.
 * 3. **5-minute TTL** on the tail to avoid redundant API calls.
 * 4. **ETag conditional request** on the first tail page — a 304 Not Modified
 *    response doesn't count against the 60 req/hr rate limit.
 * 5. **Rate limit fallback** (403/429): returns stale cache with `rateLimited: true`.
 */
export async function fetchLeaderboard(forceRefresh = false): Promise<LeaderboardResult> {
  let cache = readCache()
  const cachedEntries = cache ? sortEntries(collectAllEntries(cache)) : []

  // Return from cache if tail TTL hasn't expired (unless force refresh)
  if (!forceRefresh && cache && (Date.now() - cache.fetchedAt) < LEADERBOARD_CACHE_TTL_MS) {
    return { entries: cachedEntries, fetchedAt: cache.fetchedAt, fromCache: true, rateLimited: false }
  }

  // Validate permanent pages (checks last page ETag to detect deletions)
  if (cache && cache.lastFullPage > 0) {
    const { validatedCache, invalidated } = await validatePermanentCache(cache)
    cache = validatedCache
    if (invalidated) {
      // Permanent cache was invalidated — will re-fetch from page 1
    }
  }

  // Start fetching from the page after the last known full page
  const startPage = (cache?.lastFullPage ?? 0) + 1

  // Use ETag for conditional request on the first tail page
  const etagHeaders: Record<string, string> = {}
  if (cache?.tailEtag) {
    etagHeaders['If-None-Match'] = cache.tailEtag
  }

  const firstRes = await fetchPage(startPage, etagHeaders)

  // Network error → return stale cache
  if (!firstRes) {
    if (cache) {
      const entries = sortEntries(collectAllEntries(cache))
      return { entries, fetchedAt: cache.fetchedAt, fromCache: true, rateLimited: false }
    }
    throw new Error('Network error fetching leaderboard')
  }

  // 304 Not Modified → tail hasn't changed, just refresh the timestamp
  if (firstRes.status === 304 && cache) {
    const updated: LeaderboardCache = { ...cache, fetchedAt: Date.now() }
    writeCache(updated)
    const entries = sortEntries(collectAllEntries(updated))
    return { entries, fetchedAt: updated.fetchedAt, fromCache: true, rateLimited: false }
  }

  // Rate limited → return stale cache with flag
  if (firstRes.status === 403 || firstRes.status === 429) {
    if (cache) {
      const entries = sortEntries(collectAllEntries(cache))
      return { entries, fetchedAt: cache.fetchedAt, fromCache: true, rateLimited: true }
    }
    throw new Error('GitHub API rate limit exceeded')
  }

  if (!firstRes.ok) {
    if (cache) {
      const entries = sortEntries(collectAllEntries(cache))
      return { entries, fetchedAt: cache.fetchedAt, fromCache: true, rateLimited: false }
    }
    throw new Error(`GitHub API error: ${firstRes.status}`)
  }

  // Process first tail page
  const firstTailEtag = firstRes.headers.get('etag')
  const firstComments: DiscussionComment[] = await firstRes.json()
  const pages: Record<number, CachedPage> = cache?.pages ? { ...cache.pages } : {}
  let lastFullPage = cache?.lastFullPage ?? 0
  const tailEntries: LeaderboardEntry[] = []
  let lastTailEtag: string | null = null

  if (firstComments.length === 100) {
    // Full page → promote to permanent cache with its ETag
    pages[startPage] = { entries: parseCommentsToEntries(firstComments), etag: firstTailEtag }
    lastFullPage = startPage
  } else {
    // Partial page → tail entries
    tailEntries.push(...parseCommentsToEntries(firstComments))
    lastTailEtag = firstTailEtag
  }

  // Fetch more pages if the first tail page was full
  if (firstComments.length === 100) {
    for (let page = startPage + 1; page < startPage + MAX_TAIL_PAGES; page++) {
      const res = await fetchPage(page)
      if (!res || !res.ok) break

      const pageEtag = res.headers.get('etag')
      const comments: DiscussionComment[] = await res.json()
      if (comments.length === 0) break

      if (comments.length === 100) {
        // Full page → promote to permanent with ETag
        pages[page] = { entries: parseCommentsToEntries(comments), etag: pageEtag }
        lastFullPage = page
      } else {
        // Partial page → tail (save its ETag for conditional requests)
        tailEntries.push(...parseCommentsToEntries(comments))
        lastTailEtag = pageEtag
        break
      }
    }
  }

  // Use the ETag of whichever page is now the tail
  const tailEtag = lastTailEtag

  // Build and save updated cache
  const updatedCache: LeaderboardCache = {
    pages,
    lastFullPage,
    tailEntries,
    tailEtag,
    fetchedAt: Date.now(),
  }
  writeCache(updatedCache)

  const allEntries = sortEntries(collectAllEntries(updatedCache))
  return { entries: allEntries, fetchedAt: updatedCache.fetchedAt, fromCache: false, rateLimited: false }
}

// ─── Comment Parser ──────────────────────────────────────────────────

/**
 * Parse a discussion comment into a LeaderboardEntry.
 * Returns null if the comment is not a valid Action-generated entry.
 */
export function parseLeaderboardComment(comment: DiscussionComment): LeaderboardEntry | null {
  // Only include comments from GitHub Actions bot or repo collaborators
  const validAssociations = ['COLLABORATOR', 'MEMBER', 'OWNER']
  const isBot = comment.user.login === 'github-actions[bot]'
  if (!isBot && !validAssociations.includes(comment.author_association)) {
    return null
  }

  // Must contain the marker
  if (!comment.body.includes(LEADERBOARD_COMMENT_MARKER)) {
    return null
  }

  // Extract JSON from code block
  const jsonMatch = comment.body.match(/```json\s*\n([\s\S]*?)\n\s*```/)
  if (!jsonMatch) return null

  try {
    const payload: LeaderboardPayload = JSON.parse(jsonMatch[1])

    // Validate required fields based on version
    if (typeof payload.v !== 'number' || payload.v < 1) return null
    if (typeof payload.score !== 'number') return null
    if (typeof payload.max !== 'number') return null

    // Extract the submitter's info from the comment body
    // The Action will include the submitter's username in the comment
    const userMatch = comment.body.match(/<!-- user:(\S+) avatar:(\S+) -->/)
    const username = userMatch?.[1] ?? comment.user.login
    const avatarUrl = userMatch?.[2] ?? comment.user.avatar_url

    return {
      version: payload.v,
      username,
      avatarUrl: decodeURIComponent(avatarUrl),
      score: payload.score,
      maxScore: payload.max,
      percentage: payload.pct,
      passed: payload.passed,
      timeMs: payload.timeMs,
      submittedAt: payload.ts ?? comment.created_at,
      commitSha: payload.commitSha ?? 'unknown',
    }
  } catch {
    return null
  }
}
