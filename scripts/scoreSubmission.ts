/**
 * Server-side scoring script for the GitHub Action leaderboard processor.
 *
 * Fetches questions from the upstream iSAQB repo at a specific commit SHA,
 * then re-scores user answers using the same logic as the frontend.
 *
 * Usage: bun run scripts/scoreSubmission.ts <issueNumber>
 *
 * Environment variables:
 *   GITHUB_TOKEN — GitHub token for API access (provided by Actions)
 *   DISCUSSION_ID — GraphQL node ID of the leaderboard discussion
 */
import { parseQuestionXml } from '../src/data/xmlParser'
import { scoreExam } from '../src/utils/scoring'
import { validateQuestions } from '../src/data/schema'
import {
  LEADERBOARD_COMMENT_MARKER,
  LEADERBOARD_SCHEMA_VERSION,
  UPSTREAM_OWNER,
  UPSTREAM_REPO,
  UPSTREAM_QUESTIONS_PATH,
  LEADERBOARD_REPO_OWNER,
  LEADERBOARD_REPO_NAME,
} from '../src/utils/leaderboardConfig'
import type { Answers } from '../src/utils/scoring'
import { DOMParser } from 'linkedom'

// ─── Config ──────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const DISCUSSION_ID = process.env.DISCUSSION_ID

if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required')
if (!DISCUSSION_ID) throw new Error('DISCUSSION_ID is required')

const ISSUE_NUMBER = parseInt(process.argv[2], 10)
if (!ISSUE_NUMBER) throw new Error('Usage: bun run scripts/scoreSubmission.ts <issueNumber>')

// ─── GitHub API Helpers ──────────────────────────────────────────────

async function ghApi(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${body}`)
  }
  return res.json()
}

async function ghGraphQL(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GraphQL error ${res.status}: ${body}`)
  }
  const json = await res.json()
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  return json.data
}

// ─── Fetch Questions at Commit ───────────────────────────────────────

async function fetchQuestionsAtCommit(commitSha: string) {
  const treeUrl = `https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/contents/${UPSTREAM_QUESTIONS_PATH}?ref=${commitSha}`
  const entries: Array<{ name: string; download_url: string }> = await ghApi(treeUrl)
  const xmlFiles = entries.filter(e => e.name.endsWith('.xml')).sort((a, b) => a.name.localeCompare(b.name))

  if (xmlFiles.length === 0) throw new Error('No question XML files found at commit')

  const domParser = new DOMParser() as unknown as globalThis.DOMParser

  const questions = await Promise.all(
    xmlFiles.map(async (file) => {
      const res = await fetch(file.download_url)
      if (!res.ok) throw new Error(`Failed to fetch ${file.name}: ${res.status}`)
      const xml = await res.text()
      return parseQuestionXml(xml, domParser)
    })
  )

  const validation = validateQuestions(questions)
  if (!validation.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(validation.error.issues)}`)
  }

  return validation.data
}

// ─── Process Issue ───────────────────────────────────────────────────

interface SubmissionPayload {
  v: number
  commitSha: string
  answers: Answers
  elapsedMs: number
}

async function closeIssue(comment: string, success: boolean) {
  // Add comment
  await ghApi(
    `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues/${ISSUE_NUMBER}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body: comment }),
    }
  )

  // Close issue
  await ghApi(
    `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues/${ISSUE_NUMBER}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: success ? 'completed' : 'not_planned' }),
    }
  )

  // Add reaction
  await ghApi(
    `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues/${ISSUE_NUMBER}/reactions`,
    {
      method: 'POST',
      body: JSON.stringify({ content: success ? '+1' : 'confused' }),
    }
  )
}

async function main() {
  console.log(`Processing leaderboard submission issue #${ISSUE_NUMBER}`)

  // 1. Fetch issue details
  const issue = await ghApi(
    `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues/${ISSUE_NUMBER}`
  )

  const submitter = issue.user.login
  const submitterAvatar = issue.user.avatar_url

  // 2. Parse payload from issue body
  const jsonMatch = issue.body?.match(/```json\s*\n([\s\S]*?)\n\s*```/)
  if (!jsonMatch) {
    await closeIssue('❌ Could not find a valid JSON payload in the issue body.', false)
    process.exit(1)
  }

  let payload: SubmissionPayload
  try {
    payload = JSON.parse(jsonMatch[1])
  } catch {
    await closeIssue('❌ Invalid JSON payload.', false)
    process.exit(1)
  }

  // 3. Validate payload shape
  if (!payload.commitSha || typeof payload.commitSha !== 'string') {
    await closeIssue('❌ Missing or invalid `commitSha`.', false)
    process.exit(1)
  }
  if (!payload.answers || typeof payload.answers !== 'object') {
    await closeIssue('❌ Missing or invalid `answers`.', false)
    process.exit(1)
  }
  if (typeof payload.elapsedMs !== 'number' || payload.elapsedMs < 0) {
    await closeIssue('❌ Missing or invalid `elapsedMs`.', false)
    process.exit(1)
  }

  console.log(`Submission from @${submitter}, commit: ${payload.commitSha.slice(0, 7)}, elapsed: ${payload.elapsedMs}ms`)

  // 4. Fetch questions at the exact commit
  let questions
  try {
    questions = await fetchQuestionsAtCommit(payload.commitSha)
  } catch (err) {
    await closeIssue(`❌ Could not fetch questions at commit \`${payload.commitSha.slice(0, 7)}\`: ${(err as Error).message}`, false)
    process.exit(1)
  }

  console.log(`Fetched ${questions.length} questions at commit ${payload.commitSha.slice(0, 7)}`)

  // 5. Re-score the answers
  const result = scoreExam(questions, payload.answers)

  console.log(`Score: ${result.totalScore.toFixed(1)} / ${result.totalPossible} (${(result.percentage * 100).toFixed(1)}%) — ${result.passed ? 'PASSED' : 'FAILED'}`)

  // 6. Build the leaderboard comment
  const leaderboardPayload = {
    v: LEADERBOARD_SCHEMA_VERSION,
    score: Math.round(result.totalScore * 100) / 100,
    max: result.totalPossible,
    pct: Math.round(result.percentage * 1000) / 10,
    passed: result.passed,
    timeMs: payload.elapsedMs,
    commitSha: payload.commitSha,
    ts: new Date().toISOString(),
  }

  const commentBody = [
    LEADERBOARD_COMMENT_MARKER,
    `<!-- user:${submitter} avatar:${encodeURIComponent(submitterAvatar)} -->`,
    '',
    `### 🏆 ${submitter}`,
    '',
    `| Score | Percentage | Passed | Time |`,
    `|-------|-----------|--------|------|`,
    `| ${leaderboardPayload.score.toFixed(1)} / ${leaderboardPayload.max} | ${leaderboardPayload.pct.toFixed(1)}% | ${leaderboardPayload.passed ? '✅' : '❌'} | ${Math.floor(leaderboardPayload.timeMs / 60000)}:${String(Math.floor((leaderboardPayload.timeMs % 60000) / 1000)).padStart(2, '0')} |`,
    '',
    '```json',
    JSON.stringify(leaderboardPayload),
    '```',
    '',
    `<sub>Verified from <a href="https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/tree/${payload.commitSha}/${UPSTREAM_QUESTIONS_PATH}">commit ${payload.commitSha.slice(0, 7)}</a> · <a href="https://github.com/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues/${ISSUE_NUMBER}">#${ISSUE_NUMBER}</a></sub>`,
  ].join('\n')

  // 7. Post to the leaderboard discussion
  await ghGraphQL(
    `mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
        comment { id }
      }
    }`,
    { discussionId: DISCUSSION_ID, body: commentBody },
  )

  console.log('✅ Leaderboard entry posted to discussion')

  // 8. Close the issue with a success message
  await closeIssue(
    `✅ Your score has been verified and added to the [Leaderboard](https://github.com/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/discussions/3)!\n\n**${result.totalScore.toFixed(1)} / ${result.totalPossible}** (${(result.percentage * 100).toFixed(1)}%) — ${result.passed ? '**Passed!** 🎉' : 'Not passed'}`,
    true,
  )

  console.log('✅ Issue closed')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
