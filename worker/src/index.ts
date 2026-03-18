/**
 * Main Worker entry point — routes requests to the appropriate handler.
 *
 * Routes:
 *   GET  /api/questions     → questions proxy (cached by commit SHA)
 *   GET  /api/commit-sha    → latest upstream commit SHA
 *   GET  /api/leaderboard   → leaderboard entries (optionally filtered by commitSha)
 *   GET  /api/leaderboard/versions → available question versions
 *   POST /api/leaderboard   → submit score (requires auth)
 *   GET  /api/admin/check   → check if current user is admin
 *   GET  /api/admin/leaderboard/entries → all leaderboard entries (admin)
 *   DELETE /api/admin/leaderboard/entry → delete a leaderboard entry (admin)
 *   GET  /api/admin/leaderboard/blocked → list blocked users (admin)
 *   POST /api/admin/leaderboard/blocked → block a user (admin)
 *   DELETE /api/admin/leaderboard/blocked → unblock a user (admin)
 *   GET  /api/admin/admins   → list admins (admin)
 *   POST /api/admin/admins   → add admin (admin)
 *   DELETE /api/admin/admins → remove admin (admin)
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
import { handleGetLeaderboard, handleGetLeaderboardVersions, handleSubmitScore } from './leaderboard.ts'
import {
  handleAdminCheck,
  handleAdminGetEntries,
  handleAdminDeleteEntry,
  handleAdminGetBlocked,
  handleAdminBlockUser,
  handleAdminUnblockUser,
  handleAdminGetAdmins,
  handleAdminAddAdmin,
  handleAdminRemoveAdmin,
} from './admin.ts'
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
      } else if (pathname === '/api/leaderboard/versions' && method === 'GET') {
        response = await handleGetLeaderboardVersions(env)
      } else if (pathname === '/api/leaderboard' && method === 'POST') {
        response = await handleSubmitScore(request, env)

      // ─── Admin Routes ─────────────────────────────────────────
      } else if (pathname === '/api/admin/check' && method === 'GET') {
        response = await handleAdminCheck(request, env)
      } else if (pathname === '/api/admin/leaderboard/entries' && method === 'GET') {
        response = await handleAdminGetEntries(request, env)
      } else if (pathname === '/api/admin/leaderboard/entry' && method === 'DELETE') {
        response = await handleAdminDeleteEntry(request, env)
      } else if (pathname === '/api/admin/leaderboard/blocked' && method === 'GET') {
        response = await handleAdminGetBlocked(request, env)
      } else if (pathname === '/api/admin/leaderboard/blocked' && method === 'POST') {
        response = await handleAdminBlockUser(request, env)
      } else if (pathname === '/api/admin/leaderboard/blocked' && method === 'DELETE') {
        response = await handleAdminUnblockUser(request, env)
      } else if (pathname === '/api/admin/admins' && method === 'GET') {
        response = await handleAdminGetAdmins(request, env)
      } else if (pathname === '/api/admin/admins' && method === 'POST') {
        response = await handleAdminAddAdmin(request, env)
      } else if (pathname === '/api/admin/admins' && method === 'DELETE') {
        response = await handleAdminRemoveAdmin(request, env)

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
          { error: 'Not found', availableRoutes: ['/api/questions', '/api/commit-sha', '/api/leaderboard', '/api/leaderboard/versions', '/api/admin/check', '/auth/github', '/auth/google', '/auth/me'] },
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
