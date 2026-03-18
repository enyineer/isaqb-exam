/**
 * Main Worker entry point — routes requests to the appropriate handler.
 *
 * Routes:
 *   GET  /api/questions     → questions proxy (cached by commit SHA)
 *   GET  /api/commit-sha    → latest upstream commit SHA
 *   GET  /api/leaderboard   → leaderboard entries
 *   POST /api/leaderboard   → submit score (requires auth)
 *   GET  /auth/github       → GitHub OAuth redirect
 *   GET  /auth/github/callback → GitHub OAuth callback
 *   GET  /auth/google       → Google OAuth redirect
 *   GET  /auth/google/callback → Google OAuth callback
 *   GET  /auth/me           → current session info
 *   POST /auth/logout       → clear session
 */

import type { Env } from './types.ts'
import { handleOptions, withCors } from './cors.ts'
import { handleGetQuestions, handleGetCommitSha } from './questions.ts'
import { handleGetLeaderboard, handleSubmitScore } from './leaderboard.ts'
import {
  handleGitHubLogin,
  handleGitHubCallback,
  handleGoogleLogin,
  handleGoogleCallback,
  handleMe,
  handleLogout,
} from './auth.ts'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(request)
    }

    try {
      let response: Response

      // ─── API Routes ──────────────────────────────────────────
      if (pathname === '/api/questions' && method === 'GET') {
        response = await handleGetQuestions(env)
      } else if (pathname === '/api/commit-sha' && method === 'GET') {
        response = await handleGetCommitSha(env)
      } else if (pathname === '/api/leaderboard' && method === 'GET') {
        response = await handleGetLeaderboard(request, env)
      } else if (pathname === '/api/leaderboard' && method === 'POST') {
        response = await handleSubmitScore(request, env)

      // ─── Auth Routes ─────────────────────────────────────────
      } else if (pathname === '/auth/github' && method === 'GET') {
        return handleGitHubLogin(request, env)
      } else if (pathname === '/auth/github/callback' && method === 'GET') {
        return handleGitHubCallback(request, env)
      } else if (pathname === '/auth/google' && method === 'GET') {
        return handleGoogleLogin(request, env)
      } else if (pathname === '/auth/google/callback' && method === 'GET') {
        return handleGoogleCallback(request, env)
      } else if (pathname === '/auth/me' && method === 'GET') {
        response = await handleMe(request, env)
      } else if (pathname === '/auth/logout' && method === 'POST') {
        response = handleLogout()

      // ─── Catch-all ────────────────────────────────────────────
      } else {
        response = Response.json(
          { error: 'Not found', availableRoutes: ['/api/questions', '/api/commit-sha', '/api/leaderboard', '/auth/github', '/auth/google', '/auth/me'] },
          { status: 404 },
        )
      }

      return withCors(request, response)
    } catch (err) {
      const response = Response.json(
        { error: 'Internal server error', message: (err as Error).message },
        { status: 500 },
      )
      return withCors(request, response)
    }
  },
} satisfies ExportedHandler<Env>
