import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { buildSubmitUrl, parseLeaderboardComment, fetchLeaderboard, type LeaderboardEntry } from '../src/utils/leaderboard'
import {
  LEADERBOARD_REPO_OWNER,
  LEADERBOARD_REPO_NAME,
  LEADERBOARD_DISCUSSION_NUMBER,
  LEADERBOARD_COMMENT_MARKER,
  GITHUB_REST_API,
} from '../src/utils/leaderboardConfig'

// ─── Test Helpers ────────────────────────────────────────────────────

const COMMENTS_URL_PREFIX = `${GITHUB_REST_API}/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/discussions/${LEADERBOARD_DISCUSSION_NUMBER}/comments`

const CACHE_KEY = 'isaqb-leaderboard-cache'

/** Build a valid Discussion comment that parseLeaderboardComment will accept */
function makeValidComment(overrides: {
  score?: number
  max?: number
  pct?: number
  passed?: boolean
  timeMs?: number
  commitSha?: string
  ts?: string
  username?: string
  login?: string
  avatarUrl?: string
  authorAssociation?: string
} = {}) {
  const payload = {
    v: 1,
    score: overrides.score ?? 20,
    max: overrides.max ?? 38,
    pct: overrides.pct ?? 52.6,
    passed: overrides.passed ?? true,
    timeMs: overrides.timeMs ?? 90000,
    commitSha: overrides.commitSha ?? 'sha123',
    ts: overrides.ts ?? '2026-03-12T10:00:00Z',
  }
  const username = overrides.username ?? 'test-user'
  const avatarUrl = overrides.avatarUrl ?? 'https://avatars.githubusercontent.com/u/1'
  return {
    body: [
      LEADERBOARD_COMMENT_MARKER,
      `<!-- user:${username} avatar:${encodeURIComponent(avatarUrl)} -->`,
      '',
      `### 🏆 ${username}`,
      '',
      '```json',
      JSON.stringify(payload),
      '```',
    ].join('\n'),
    created_at: payload.ts,
    author: {
      login: overrides.login ?? 'github-actions[bot]',
      avatar_url: avatarUrl,
    },
    author_association: overrides.authorAssociation ?? 'COLLABORATOR',
  }
}

/** Generate an array of N valid comments with unique scores */
function makeComments(count: number, startScore = 1): ReturnType<typeof makeValidComment>[] {
  return Array.from({ length: count }, (_, i) =>
    makeValidComment({
      score: startScore + i,
      pct: ((startScore + i) / 38) * 100,
      username: `user-${startScore + i}`,
      timeMs: 60000 + i * 1000,
    }),
  )
}

/** Create a mock Response object */
function mockResponse(body: unknown, status = 200, etag: string | null = null): Response {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (etag) headers.set('etag', etag)
  return new Response(JSON.stringify(body), { status, headers })
}

/** Create a 304 Not Modified response */
function mock304(): Response {
  return new Response(null, { status: 304 })
}

/** Create a rate-limited response */
function mock403(): Response {
  return new Response('rate limited', { status: 403 })
}

function mock429(): Response {
  return new Response('too many requests', { status: 429 })
}

function mock500(): Response {
  return new Response('server error', { status: 500 })
}

/** Extract page number from a fetch URL (matches &page= to avoid per_page) */
function getPageFromUrl(url: string): number {
  const match = url.match(/[&?]page=(\d+)/)
  return match ? parseInt(match[1], 10) : 1
}

/** Extract If-None-Match header from fetch call */
function getEtagFromCall(call: [string, RequestInit | undefined]): string | null {
  const headers = call[1]?.headers as Record<string, string> | undefined
  return headers?.['If-None-Match'] ?? null
}

// ─── Mock Infrastructure ─────────────────────────────────────────────

let fetchCalls: [string, RequestInit | undefined][] = []
let fetchHandler: (url: string, init?: RequestInit) => Promise<Response>
let localStorageData: Record<string, string> = {}
let dateNowValue = Date.now()

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalDateNow = Date.now

beforeEach(() => {
  fetchCalls = []
  localStorageData = {}
  dateNowValue = 1710000000000 // Fixed timestamp

  // Mock Date.now
  Date.now = () => dateNowValue

  // Mock fetch
  fetchHandler = async () => mockResponse([])
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    fetchCalls.push([url, init])
    return fetchHandler(url, init)
  }) as typeof fetch

  // Mock localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => localStorageData[key] ?? null,
      setItem: (key: string, value: string) => { localStorageData[key] = value },
      removeItem: (key: string) => { delete localStorageData[key] },
    },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true })
  Date.now = originalDateNow
})

// ===== buildSubmitUrl =====

describe('buildSubmitUrl', () => {
  test('generates a valid GitHub issue URL', () => {
    const url = buildSubmitUrl('abc123', { Q1: ['A'] }, 60000)

    expect(url).toContain(`https://github.com/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues/new`)
    expect(url).toContain('title=')
    expect(url).toContain('body=')
    expect(url).toContain('labels=leaderboard-submission')
  })

  test('includes commitSha in the payload', () => {
    const url = buildSubmitUrl('deadbeef123', { Q1: ['B', 'C'] }, 120000)
    expect(url).toContain('deadbeef123')
  })

  test('includes answers in the payload', () => {
    const answers = { 'Q-01': ['A', 'B'], 'Q-02': { S1: 'cat-a', S2: 'cat-b' } }
    const url = buildSubmitUrl('abc', answers, 5000)

    const urlObj = new URL(url)
    const body = urlObj.searchParams.get('body') ?? ''
    expect(body).toContain('Q-01')
    expect(body).toContain('Q-02')
  })

  test('includes elapsed time in the payload', () => {
    const url = buildSubmitUrl('abc', {}, 142000)
    const urlObj = new URL(url)
    const body = urlObj.searchParams.get('body') ?? ''
    expect(body).toContain('142000')
  })

  test('includes the leaderboard marker', () => {
    const url = buildSubmitUrl('abc', {}, 0)
    const urlObj = new URL(url)
    const body = urlObj.searchParams.get('body') ?? ''
    expect(body).toContain(LEADERBOARD_COMMENT_MARKER)
  })
})

// ===== parseLeaderboardComment =====

describe('parseLeaderboardComment', () => {
  const validBody = [
    LEADERBOARD_COMMENT_MARKER,
    '<!-- user:testuser avatar:https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F1234 -->',
    '',
    '### 🏆 testuser',
    '',
    '```json',
    JSON.stringify({
      v: 1,
      score: 23.5,
      max: 38,
      pct: 61.8,
      passed: true,
      timeMs: 142000,
      commitSha: 'abc123',
      ts: '2026-03-12T10:00:00Z',
    }),
    '```',
  ].join('\n')

  const makeComment = (overrides: {
    body?: string
    login?: string
    avatar_url?: string
    author_association?: string
  } = {}) => ({
    body: overrides.body ?? '',
    created_at: '2026-03-12T10:00:00Z',
    author: {
      login: overrides.login ?? 'github-actions[bot]',
      avatar_url: overrides.avatar_url ?? 'https://avatars.githubusercontent.com/u/1234',
    },
    author_association: overrides.author_association ?? 'COLLABORATOR',
  })

  test('parses a valid Action-generated comment', () => {
    const entry = parseLeaderboardComment(makeComment({ body: validBody }))
    expect(entry).not.toBeNull()
    const e = entry as LeaderboardEntry
    expect(e.username).toBe('testuser')
    expect(e.score).toBe(23.5)
    expect(e.maxScore).toBe(38)
    expect(e.percentage).toBe(61.8)
    expect(e.passed).toBe(true)
    expect(e.timeMs).toBe(142000)
    expect(e.commitSha).toBe('abc123')
    expect(e.version).toBe(1)
  })

  test('returns null for comments from unauthorized users', () => {
    const entry = parseLeaderboardComment(makeComment({
      body: validBody,
      login: 'random-user',
      author_association: 'NONE',
    }))
    expect(entry).toBeNull()
  })

  test('returns null for comments without the marker', () => {
    const bodyWithoutMarker = validBody.replace(LEADERBOARD_COMMENT_MARKER, '')
    const entry = parseLeaderboardComment(makeComment({ body: bodyWithoutMarker }))
    expect(entry).toBeNull()
  })

  test('returns null for comments without a JSON block', () => {
    const entry = parseLeaderboardComment(makeComment({
      body: `${LEADERBOARD_COMMENT_MARKER}\nNo JSON here`,
    }))
    expect(entry).toBeNull()
  })

  test('returns null for invalid JSON', () => {
    const entry = parseLeaderboardComment(makeComment({
      body: `${LEADERBOARD_COMMENT_MARKER}\n\`\`\`json\n{invalid}\n\`\`\``,
    }))
    expect(entry).toBeNull()
  })

  test('returns null if version is missing', () => {
    const entry = parseLeaderboardComment(makeComment({
      body: `${LEADERBOARD_COMMENT_MARKER}\n\`\`\`json\n${JSON.stringify({ score: 10, max: 20 })}\n\`\`\``,
    }))
    expect(entry).toBeNull()
  })

  test('allows OWNER author association', () => {
    const entry = parseLeaderboardComment(makeComment({
      body: validBody,
      login: 'repo-owner',
      author_association: 'OWNER',
    }))
    expect(entry).not.toBeNull()
  })

  test('allows MEMBER author association', () => {
    const entry = parseLeaderboardComment(makeComment({
      body: validBody,
      login: 'org-member',
      author_association: 'MEMBER',
    }))
    expect(entry).not.toBeNull()
  })

  test('decodes avatar URL', () => {
    const entry = parseLeaderboardComment(makeComment({ body: validBody }))
    expect(entry).not.toBeNull()
    expect((entry as LeaderboardEntry).avatarUrl).toBe('https://avatars.githubusercontent.com/u/1234')
  })
})

// ===== Sorting =====

describe('leaderboard sorting', () => {
  test('entries with higher percentage rank first', () => {
    const entries: Pick<LeaderboardEntry, 'percentage' | 'timeMs'>[] = [
      { percentage: 50, timeMs: 60000 },
      { percentage: 80, timeMs: 120000 },
      { percentage: 65, timeMs: 90000 },
    ]

    const sorted = [...entries].sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage
      return a.timeMs - b.timeMs
    })

    expect(sorted[0].percentage).toBe(80)
    expect(sorted[1].percentage).toBe(65)
    expect(sorted[2].percentage).toBe(50)
  })

  test('entries with same percentage are ranked by fastest time', () => {
    const entries: Pick<LeaderboardEntry, 'percentage' | 'timeMs'>[] = [
      { percentage: 70, timeMs: 120000 },
      { percentage: 70, timeMs: 60000 },
      { percentage: 70, timeMs: 90000 },
    ]

    const sorted = [...entries].sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage
      return a.timeMs - b.timeMs
    })

    expect(sorted[0].timeMs).toBe(60000)
    expect(sorted[1].timeMs).toBe(90000)
    expect(sorted[2].timeMs).toBe(120000)
  })
})

// ===== fetchLeaderboard — Fresh Fetch =====

describe('fetchLeaderboard — fresh fetch (no cache)', () => {
  test('fetches from page 1 when there is no cache', async () => {
    const comments = makeComments(3)
    fetchHandler = async (url) => {
      if (url.includes('page=1')) return mockResponse(comments, 200, '"etag-1"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(false)
    expect(result.rateLimited).toBe(false)
    expect(result.entries).toHaveLength(3)
    // Should have fetched page 1
    expect(fetchCalls.some(c => c[0].includes('page=1'))).toBe(true)
  })

  test('returns entries sorted by percentage descending', async () => {
    const comments = [
      makeValidComment({ pct: 40, timeMs: 60000, username: 'low' }),
      makeValidComment({ pct: 90, timeMs: 60000, username: 'high' }),
      makeValidComment({ pct: 65, timeMs: 60000, username: 'mid' }),
    ]
    fetchHandler = async () => mockResponse(comments, 200, '"etag-1"')

    const result = await fetchLeaderboard()

    expect(result.entries[0].percentage).toBe(90)
    expect(result.entries[1].percentage).toBe(65)
    expect(result.entries[2].percentage).toBe(40)
  })

  test('writes cache to localStorage after fresh fetch', async () => {
    fetchHandler = async () => mockResponse(makeComments(5), 200, '"etag-1"')

    await fetchLeaderboard()

    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.fetchedAt).toBe(dateNowValue)
    expect(cached.tailEntries).toHaveLength(5)
    expect(cached.lastFullPage).toBe(0)
    expect(cached.tailEtag).toBe('"etag-1"')
  })

  test('throws on network error with no cache', async () => {
    fetchHandler = async () => { throw new Error('network') }

    await expect(fetchLeaderboard()).rejects.toThrow('Network error')
  })

  test('throws on rate limit with no cache', async () => {
    fetchHandler = async () => mock403()

    await expect(fetchLeaderboard()).rejects.toThrow('rate limit')
  })

  test('throws on server error with no cache', async () => {
    fetchHandler = async () => mock500()

    await expect(fetchLeaderboard()).rejects.toThrow('GitHub API error: 500')
  })
})

// ===== fetchLeaderboard — Cache TTL =====

describe('fetchLeaderboard — cache TTL', () => {
  test('returns cache if within 5 minutes', async () => {
    // Seed the cache
    const cachedEntries = [makeValidComment({ pct: 80, username: 'cached-user' })]
    fetchHandler = async () => mockResponse(cachedEntries, 200, '"etag-1"')
    await fetchLeaderboard()
    fetchCalls = []

    // Advance time by 2 minutes (within TTL)
    dateNowValue += 2 * 60 * 1000

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(true)
    expect(result.entries).toHaveLength(1)
    // No fetch calls should have been made
    expect(fetchCalls).toHaveLength(0)
  })

  test('re-fetches after 5 minutes', async () => {
    // Seed the cache
    fetchHandler = async () => mockResponse(makeComments(2), 200, '"etag-1"')
    await fetchLeaderboard()
    fetchCalls = []

    // Advance time past TTL
    dateNowValue += 6 * 60 * 1000

    fetchHandler = async () => mockResponse(makeComments(3, 10), 200, '"etag-2"')
    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(false)
    expect(result.entries).toHaveLength(3)
    expect(fetchCalls.length).toBeGreaterThan(0)
  })

  test('forceRefresh bypasses TTL', async () => {
    // Seed the cache
    fetchHandler = async () => mockResponse(makeComments(2), 200, '"etag-1"')
    await fetchLeaderboard()
    fetchCalls = []

    // Don't advance time — still within TTL

    fetchHandler = async () => mockResponse(makeComments(4, 10), 200, '"etag-2"')
    const result = await fetchLeaderboard(true)

    expect(result.fromCache).toBe(false)
    expect(result.entries).toHaveLength(4)
    expect(fetchCalls.length).toBeGreaterThan(0)
  })
})

// ===== fetchLeaderboard — Tail ETag (304 Not Modified) =====

describe('fetchLeaderboard — tail ETag conditional requests', () => {
  test('returns cached entries on 304 and refreshes timestamp', async () => {
    // Seed cache
    fetchHandler = async () => mockResponse(makeComments(5), 200, '"tail-etag"')
    await fetchLeaderboard()

    // Expire cache
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    // Mock 304 response
    fetchHandler = async () => mock304()
    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(true)
    expect(result.entries).toHaveLength(5)
    // Timestamp should be updated
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.fetchedAt).toBe(dateNowValue)
  })

  test('sends If-None-Match header with stored tail ETag', async () => {
    // Seed cache with ETag
    fetchHandler = async () => mockResponse(makeComments(3), 200, '"my-tail-etag"')
    await fetchLeaderboard()

    // Expire and re-fetch
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    fetchHandler = async () => mock304()
    await fetchLeaderboard()

    // Verify If-None-Match was sent
    const tailCall = fetchCalls.find(c => c[0].includes('page=1'))
    expect(tailCall).toBeDefined()
    const headers = tailCall![1]?.headers as Record<string, string>
    expect(headers['If-None-Match']).toBe('"my-tail-etag"')
  })
})

// ===== fetchLeaderboard — Full Page Promotion =====

describe('fetchLeaderboard — full page promotion to permanent cache', () => {
  test('promotes a full page (100 comments) to permanent cache', async () => {
    const fullPage = makeComments(100, 1)

    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(fullPage, 200, '"page1-etag"')
      if (page === 2) return mockResponse(makeComments(20, 101), 200, '"page2-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    expect(result.entries).toHaveLength(120) // 100 + 20

    // Verify cache structure
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(1)
    expect(cached.pages[1]).toBeDefined()
    expect(cached.pages[1].etag).toBe('"page1-etag"')
    expect(cached.pages[1].entries).toHaveLength(100)
    expect(cached.tailEntries).toHaveLength(20)
  })

  test('promotes multiple full pages to permanent cache', async () => {
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1-etag"')
      if (page === 2) return mockResponse(makeComments(100, 101), 200, '"p2-etag"')
      if (page === 3) return mockResponse(makeComments(100, 201), 200, '"p3-etag"')
      if (page === 4) return mockResponse(makeComments(50, 301), 200, '"p4-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    expect(result.entries).toHaveLength(350) // 100*3 + 50

    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(3)
    expect(cached.pages[1].etag).toBe('"p1-etag"')
    expect(cached.pages[2].etag).toBe('"p2-etag"')
    expect(cached.pages[3].etag).toBe('"p3-etag"')
    expect(cached.tailEntries).toHaveLength(50)
  })

  test('on re-fetch, skips permanently cached pages and starts from tail', async () => {
    // First fetch: 100 comments on page 1, 30 on page 2
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1-etag"')
      if (page === 2) return mockResponse(makeComments(30, 101), 200, '"page2-tail-etag"')
      return mockResponse([])
    }
    await fetchLeaderboard()
    expect(JSON.parse(localStorageData[CACHE_KEY]).lastFullPage).toBe(1)

    // Expire cache
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    // Second fetch: page 1 still valid (304 on validation), new data on page 2
    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined
      // Validation of last permanent page (page 1)
      if (page === 1 && headers?.['If-None-Match'] === '"p1-etag"') return mock304()
      // Tail fetch starts from page 2
      if (page === 2) return mockResponse(makeComments(40, 101), 200, '"new-page2-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // Should have 100 (permanent) + 40 (tail) entries
    expect(result.entries).toHaveLength(140)
    expect(result.fromCache).toBe(false)
    // Should NOT have fetched page 1 for data (only for validation)
    const page1Calls = fetchCalls.filter(c => getPageFromUrl(c[0]) === 1)
    expect(page1Calls).toHaveLength(1) // only the validation call
  })
})

// ===== fetchLeaderboard — Permanent Page Validation =====

describe('fetchLeaderboard — permanent page ETag validation', () => {
  test('keeps all pages when last page ETag is valid (304)', async () => {
    // Seed: 3 full pages + 20 tail
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page <= 3) return mockResponse(makeComments(100, (page - 1) * 100 + 1), 200, `"p${page}-etag"`)
      if (page === 4) return mockResponse(makeComments(20, 301), 200, '"tail-etag"')
      return mockResponse([])
    }
    await fetchLeaderboard()

    // Expire cache
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    // Validation: last permanent page (3) returns 304
    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined
      if (page === 3 && headers?.['If-None-Match']) return mock304()
      if (page === 4) return mockResponse(makeComments(25, 301), 200, '"new-tail-etag"')
      return mockResponse([])
    }
    const result = await fetchLeaderboard()

    // All 300 permanent + 25 new tail
    expect(result.entries).toHaveLength(325)
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(3)
  })

  test('invalidates all pages when last page has no etag', async () => {
    // Manually seed cache with page that has no etag
    const cache = {
      pages: {
        1: { entries: makeComments(100, 1).map(c => parseLeaderboardComment(c)!), etag: null },
      },
      lastFullPage: 1,
      tailEntries: [],
      tailEtag: null,
      fetchedAt: dateNowValue - 6 * 60 * 1000, // expired
    }
    localStorageData[CACHE_KEY] = JSON.stringify(cache)

    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(50, 1), 200, '"fresh-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // Should re-fetch from page 1
    expect(result.entries).toHaveLength(50)
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(0) // no full pages in the re-fetch
  })
})

// ===== fetchLeaderboard — Backward ETag Walk (Deletion Detection) =====

describe('fetchLeaderboard — backward ETag walk on deletion', () => {
  /**
   * Sets up a cache with N full pages and specified ETags.
   * Returns the cache for assertion purposes.
   */
  function seedPermanentCache(numPages: number, etagPrefix = 'p') {
    const pages: Record<number, { entries: LeaderboardEntry[]; etag: string }> = {}
    for (let p = 1; p <= numPages; p++) {
      pages[p] = {
        entries: makeComments(100, (p - 1) * 100 + 1).map(c => parseLeaderboardComment(c)!),
        etag: `"${etagPrefix}${p}-etag"`,
      }
    }
    const cache = {
      pages,
      lastFullPage: numPages,
      tailEntries: [],
      tailEtag: '"tail-etag"',
      fetchedAt: dateNowValue - 6 * 60 * 1000, // expired
    }
    localStorageData[CACHE_KEY] = JSON.stringify(cache)
    return cache
  }

  test('keeps pages before deletion point and clears from point onward', async () => {
    // Seed 5 full pages
    seedPermanentCache(5)

    // Deletion on page 4 → pages 4 and 5 have shifted
    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined

      // Validation walk:
      // Page 5 (last): ETag changed → 200
      if (page === 5 && headers?.['If-None-Match'] === '"p5-etag"') return mockResponse([], 200)
      // Page 4: ETag changed → 200
      if (page === 4 && headers?.['If-None-Match'] === '"p4-etag"') return mockResponse([], 200)
      // Page 3: ETag valid → 304
      if (page === 3 && headers?.['If-None-Match'] === '"p3-etag"') return mock304()

      // After validation, tail fetch starts from page 4
      if (page === 4 && !headers?.['If-None-Match']) return mockResponse(makeComments(80, 301), 200, '"new-p4-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // Pages 1-3 kept (300 entries) + 80 new tail entries
    expect(result.entries).toHaveLength(380)
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(3) // Pages 4-5 cleared
    expect(cached.pages[1]).toBeDefined()
    expect(cached.pages[2]).toBeDefined()
    expect(cached.pages[3]).toBeDefined()
    expect(cached.pages[4]).toBeUndefined()
    expect(cached.pages[5]).toBeUndefined()
  })

  test('clears all pages when deletion is on page 1', async () => {
    // Seed 3 full pages
    seedPermanentCache(3)

    // All page ETags have changed
    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined

      // Validation: all ETags are invalid
      if (headers?.['If-None-Match']) return mockResponse([], 200)

      // Re-fetch from page 1
      if (page === 1 && !headers?.['If-None-Match']) return mockResponse(makeComments(50, 1), 200, '"fresh-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(0) // all cleared
    expect(Object.keys(cached.pages)).toHaveLength(0)
    expect(result.entries).toHaveLength(50)
  })

  test('handles network error during backward walk conservatively', async () => {
    seedPermanentCache(4)

    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined

      // Page 4: ETag changed
      if (page === 4 && headers?.['If-None-Match']) return mockResponse([], 200)
      // Page 3: network error → return null to simulate fetchPage catching the error
      if (page === 3 && headers?.['If-None-Match']) return null as unknown as Response

      // Tail fetch from page 3 onward
      if (page === 3 && !headers?.['If-None-Match']) return mockResponse(makeComments(50, 201), 200, '"new-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // Pages 1-2 kept, 3-4 cleared
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(2)
    expect(cached.pages[1]).toBeDefined()
    expect(cached.pages[2]).toBeDefined()
    expect(cached.pages[3]).toBeUndefined()
  })

  test('handles rate limiting during backward walk', async () => {
    seedPermanentCache(4)

    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined

      // Page 4: ETag changed
      if (page === 4 && headers?.['If-None-Match']) return mockResponse([], 200)
      // Page 3: rate limited
      if (page === 3 && headers?.['If-None-Match']) return mock403()

      // Tail fetch from page 3 onward
      if (page === 3 && !headers?.['If-None-Match']) return mockResponse(makeComments(30, 201), 200, '"new-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // Pages 1-2 kept, page 3+ cleared conservatively
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(2)
  })
})

// ===== fetchLeaderboard — Rate Limiting =====

describe('fetchLeaderboard — rate limiting', () => {
  test('returns stale cache with rateLimited flag on 403', async () => {
    // Seed cache
    fetchHandler = async () => mockResponse(makeComments(5), 200, '"etag"')
    await fetchLeaderboard()

    dateNowValue += 6 * 60 * 1000
    fetchCalls = []
    fetchHandler = async () => mock403()

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(true)
    expect(result.rateLimited).toBe(true)
    expect(result.entries).toHaveLength(5)
  })

  test('returns stale cache with rateLimited flag on 429', async () => {
    // Seed cache
    fetchHandler = async () => mockResponse(makeComments(3), 200, '"etag"')
    await fetchLeaderboard()

    dateNowValue += 6 * 60 * 1000
    fetchHandler = async () => mock429()

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(true)
    expect(result.rateLimited).toBe(true)
    expect(result.entries).toHaveLength(3)
  })
})

// ===== fetchLeaderboard — Network Errors =====

describe('fetchLeaderboard — network error fallback', () => {
  test('returns stale cache on network error during tail fetch', async () => {
    // Seed cache
    fetchHandler = async () => mockResponse(makeComments(8), 200, '"etag"')
    await fetchLeaderboard()

    dateNowValue += 6 * 60 * 1000
    fetchHandler = async () => { throw new Error('offline') }

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(true)
    expect(result.rateLimited).toBe(false)
    expect(result.entries).toHaveLength(8)
  })

  test('returns stale cache on server error (500) during tail fetch', async () => {
    // Seed cache
    fetchHandler = async () => mockResponse(makeComments(4), 200, '"etag"')
    await fetchLeaderboard()

    dateNowValue += 6 * 60 * 1000
    fetchHandler = async () => mock500()

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(true)
    expect(result.entries).toHaveLength(4)
  })
})

// ===== fetchLeaderboard — Pagination =====

describe('fetchLeaderboard — pagination', () => {
  test('fetches multiple pages until a partial page', async () => {
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1"')
      if (page === 2) return mockResponse(makeComments(100, 101), 200, '"p2"')
      if (page === 3) return mockResponse(makeComments(42, 201), 200, '"p3"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    expect(result.entries).toHaveLength(242) // 100 + 100 + 42
  })

  test('stops at MAX_TAIL_PAGES (10) even if all pages are full', async () => {
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      // All pages return 100 comments
      return mockResponse(makeComments(100, (page - 1) * 100 + 1), 200, `"p${page}"`)
    }

    const result = await fetchLeaderboard()

    // Should stop at 10 pages = 1000 entries (first page + 9 more)
    expect(result.entries).toHaveLength(1000)
  })

  test('stops pagination on error and returns entries collected so far', async () => {
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1"')
      if (page === 2) return mockResponse(makeComments(100, 101), 200, '"p2"')
      if (page === 3) return mock500() // error on page 3
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // Should have pages 1 and 2 (200 entries)
    expect(result.entries).toHaveLength(200)
  })

  test('stops pagination on empty page', async () => {
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1"')
      if (page === 2) return mockResponse([], 200, '"p2"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    expect(result.entries).toHaveLength(100)
  })
})

// ===== fetchLeaderboard — Tail ETag Clearing on Promotion =====

describe('fetchLeaderboard — tail ETag management', () => {
  test('clears tail ETag when first tail page is promoted to permanent', async () => {
    // First fetch: partial page
    fetchHandler = async () => mockResponse(makeComments(50), 200, '"tail-etag-v1"')
    await fetchLeaderboard()
    let cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.tailEtag).toBe('"tail-etag-v1"')

    // Expire and re-fetch: now the tail page has grown to 100 (full) + new partial
    dateNowValue += 6 * 60 * 1000
    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"promoted-etag"')
      if (page === 2) return mockResponse(makeComments(10, 101), 200, '"new-tail-etag"')
      return mockResponse([])
    }

    await fetchLeaderboard()

    cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(1)
    // Tail ETag should be null since the original first tail page was promoted
    expect(cached.tailEtag).toBeNull()
  })

  test('preserves tail ETag when first tail page stays partial', async () => {
    fetchHandler = async () => mockResponse(makeComments(30), 200, '"stable-tail-etag"')
    await fetchLeaderboard()

    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.tailEtag).toBe('"stable-tail-etag"')
    expect(cached.lastFullPage).toBe(0)
  })
})

// ===== fetchLeaderboard — Cache Migration =====

describe('fetchLeaderboard — cache format migration', () => {
  test('ignores old cache format (missing permanentEntries/pages)', async () => {
    // Old format cache
    localStorageData[CACHE_KEY] = JSON.stringify({
      entries: [],
      fetchedAt: dateNowValue,
      etag: '"old"',
    })

    fetchHandler = async () => mockResponse(makeComments(3), 200, '"new-etag"')

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(false)
    expect(result.entries).toHaveLength(3)
  })

  test('handles corrupted localStorage gracefully', async () => {
    localStorageData[CACHE_KEY] = 'not-json'

    fetchHandler = async () => mockResponse(makeComments(2), 200, '"etag"')

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(false)
    expect(result.entries).toHaveLength(2)
  })
})

// ===== fetchLeaderboard — Permanent Validation + Tail Combined =====

describe('fetchLeaderboard — full cycle with permanent pages + tail', () => {
  test('validates permanent pages, then fetches tail with new entries', async () => {
    // First fetch: 2 full pages + partial tail
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1-etag"')
      if (page === 2) return mockResponse(makeComments(100, 101), 200, '"p2-etag"')
      if (page === 3) return mockResponse(makeComments(20, 201), 200, '"p3-tail-etag"')
      return mockResponse([])
    }
    await fetchLeaderboard()

    // Expire cache
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    // Refresh: validate page 2 (304), fetch page 3 tail with more entries
    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined

      // Validate last permanent (page 2)
      if (page === 2 && headers?.['If-None-Match'] === '"p2-etag"') return mock304()
      // Tail page 3 with new data
      if (page === 3) return mockResponse(makeComments(35, 201), 200, '"new-tail-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // 200 permanent (pages 1-2) + 35 tail
    expect(result.entries).toHaveLength(235)
    expect(result.fromCache).toBe(false)

    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(2) // unchanged
    expect(cached.tailEntries).toHaveLength(35) // updated
  })

  test('full page in tail gets promoted during re-fetch', async () => {
    // First fetch: 1 full page + 30 tail
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1-etag"')
      if (page === 2) return mockResponse(makeComments(30, 101), 200, '"p2-tail-etag"')
      return mockResponse([])
    }
    await fetchLeaderboard()

    // Expire
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    // Page 2 is now full (100 entries) + new page 3 with partial
    fetchHandler = async (url, init) => {
      const page = getPageFromUrl(url)
      const headers = init?.headers as Record<string, string> | undefined

      if (page === 1 && headers?.['If-None-Match'] === '"p1-etag"') return mock304()
      if (page === 2) return mockResponse(makeComments(100, 101), 200, '"p2-promoted-etag"')
      if (page === 3) return mockResponse(makeComments(15, 201), 200, '"p3-tail-etag"')
      return mockResponse([])
    }

    const result = await fetchLeaderboard()

    // 100 (p1) + 100 (p2 promoted) + 15 (tail)
    expect(result.entries).toHaveLength(215)

    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(2) // page 2 now promoted
    expect(cached.pages[2].etag).toBe('"p2-promoted-etag"')
    expect(cached.tailEntries).toHaveLength(15)
  })
})

// ===== fetchLeaderboard — Validation skipped when no permanent pages =====

describe('fetchLeaderboard — no validation when no permanent pages', () => {
  test('does not send validation requests when lastFullPage is 0', async () => {
    // Seed with only tail entries (no permanent pages)
    fetchHandler = async () => mockResponse(makeComments(20), 200, '"tail-etag"')
    await fetchLeaderboard()

    // Expire
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    fetchHandler = async () => mockResponse(makeComments(25), 200, '"new-tail-etag"')
    await fetchLeaderboard()

    // Should only have the tail fetch (page 1), no validation calls
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0][0]).toContain('page=1')
  })
})

// ===== fetchLeaderboard — Validation network error keeps cache =====

describe('fetchLeaderboard — validation network error', () => {
  test('keeps permanent cache if validation request fails due to network', async () => {
    // Seed with permanent pages
    fetchHandler = async (url) => {
      const page = getPageFromUrl(url)
      if (page === 1) return mockResponse(makeComments(100, 1), 200, '"p1-etag"')
      if (page === 2) return mockResponse(makeComments(50, 101), 200, '"p2-tail"')
      return mockResponse([])
    }
    await fetchLeaderboard()

    // Expire cache
    dateNowValue += 6 * 60 * 1000
    fetchCalls = []

    // Validation network error, tail fetch also errors
    fetchHandler = async () => { throw new Error('offline') }

    const result = await fetchLeaderboard()

    expect(result.fromCache).toBe(true)
    // Permanent pages should be preserved
    const cached = JSON.parse(localStorageData[CACHE_KEY])
    expect(cached.lastFullPage).toBe(1)
    expect(cached.pages[1]).toBeDefined()
  })
})
