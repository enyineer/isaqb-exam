/**
 * Questions proxy — fetches iSAQB exam questions from GitHub,
 * caches by commit SHA in KV.
 *
 * Shares xmlParser and schema from the frontend via direct imports (DRY).
 */

import type { Env, CachedQuestions } from './types.ts'
import { DOMParser } from '@xmldom/xmldom'
import { parseQuestionXml } from '../../src/data/xmlParser.ts'
import { validateQuestions } from '../../src/data/schema.ts'

const UPSTREAM_OWNER = 'isaqb-org'
const UPSTREAM_REPO = 'foundation-exam-questions'
const QUESTIONS_PATH = 'mock/questions'

/** Authenticated GitHub API fetch */
async function ghFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'isaqb-exam-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

/** Fetch the latest commit SHA for the questions directory */
async function fetchLatestCommitSha(token: string): Promise<string> {
  const url = `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/commits?path=${QUESTIONS_PATH}&per_page=1`
  const res = await ghFetch(url, token)

  if (!res.ok) throw new Error(`Commits API returned ${res.status}`)
  const commits: Array<{ sha: string }> = await res.json()
  if (commits.length === 0) throw new Error('No commits found for questions path')
  return commits[0].sha
}

/** Discover and parse all question XML files at a specific commit */
async function fetchQuestionsAtCommit(commitSha: string, token: string): Promise<unknown[]> {
  const treeUrl = `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/contents/${QUESTIONS_PATH}?ref=${commitSha}`
  const res = await ghFetch(treeUrl, token)

  if (!res.ok) throw new Error(`Contents API returned ${res.status}`)
  const entries: Array<{ name: string; type: string }> = await res.json()
  const xmlFiles = entries
    .filter(e => e.type === 'file' && e.name.endsWith('.xml'))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (xmlFiles.length === 0) throw new Error('No XML question files found')

  // @xmldom/xmldom's DOMParser is compatible with parseQuestionXml's parameter type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domParser = new DOMParser() as any

  const questions = await Promise.all(
    xmlFiles.map(async (file) => {
      const rawUrl = `https://raw.githubusercontent.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/${commitSha}/${QUESTIONS_PATH}/${file.name}`
      const rawRes = await fetch(rawUrl)
      if (!rawRes.ok) throw new Error(`Failed to fetch ${file.name}: ${rawRes.status}`)
      const xml = await rawRes.text()
      return parseQuestionXml(xml, domParser)
    }),
  )

  const validation = validateQuestions(questions)
  if (!validation.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(validation.error.issues)}`)
  }

  return validation.data
}

// ─── Route Handlers ──────────────────────────────────────────────────

/** GET /api/questions — Returns cached questions JSON. Accepts optional ?commitSha= to fetch at a specific commit. */
export async function handleGetQuestions(request: Request, env: Env): Promise<Response> {
  try {
    // Use explicit commitSha from query param, or fall back to latest
    const url = new URL(request.url)
    const commitSha = url.searchParams.get('commitSha') || await fetchLatestCommitSha(env.GITHUB_TOKEN)

    const questions = await getQuestionsWithCache(commitSha, env)

    return Response.json({
      questions,
      commitSha,
    })
  } catch (err) {
    return Response.json(
      { error: `Failed to fetch questions: ${(err as Error).message}` },
      { status: 502 },
    )
  }
}

/** GET /api/commit-sha — Returns the latest upstream commit SHA */
export async function handleGetCommitSha(env: Env): Promise<Response> {
  try {
    const sha = await fetchLatestCommitSha(env.GITHUB_TOKEN)
    return Response.json({ sha })
  } catch (err) {
    return Response.json(
      { error: `Failed to fetch commit SHA: ${(err as Error).message}` },
      { status: 502 },
    )
  }
}

/**
 * Get questions at a specific commit, using KV cache when available.
 * On a cache miss, fetches from GitHub and writes results to KV for future calls.
 */
export async function getQuestionsWithCache(commitSha: string, env: Env): Promise<unknown[]> {
  const cacheKey = `questions:${commitSha}`
  const cached = await env.QUESTIONS_CACHE.get<CachedQuestions>(cacheKey, 'json')

  if (cached) return cached.questions

  // Cache miss — fetch from GitHub, parse, save to KV
  const questions = await fetchQuestionsAtCommit(commitSha, env.GITHUB_TOKEN)

  const cacheData: CachedQuestions = {
    questions,
    commitSha,
    cachedAt: new Date().toISOString(),
  }
  await env.QUESTIONS_CACHE.put(cacheKey, JSON.stringify(cacheData))

  return questions
}

/** Fetch questions at a specific commit (used by leaderboard scoring) */
export { fetchQuestionsAtCommit }
