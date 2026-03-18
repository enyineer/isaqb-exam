/**
 * OAuth authentication handlers — GitHub and Google OAuth2 flows.
 * Sessions are stored as JWT cookies.
 */

import type { Env, SessionPayload } from './types.ts'
import { createJwt, verifyJwt, getSessionFromCookie, buildSessionCookie, clearSessionCookie } from './jwt.ts'

const DEFAULT_FRONTEND_URL = 'https://enyineer.github.io/isaqb-exam'

/** Resolve the frontend URL — overridable via FRONTEND_URL env var for local dev */
function getFrontendUrl(env: Env): string {
  return env.FRONTEND_URL || DEFAULT_FRONTEND_URL
}

/** Resolve the worker origin for OAuth redirect URIs — overridable via WORKER_URL for local dev */
function getWorkerOrigin(request: Request, env: Env): string {
  return env.WORKER_URL || new URL(request.url).origin
}

/**
 * Sanitise the returnTo value to prevent open-redirect attacks.
 * Only allows relative paths / hash fragments — never absolute URLs.
 */
function sanitizeReturnTo(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.includes('://') || trimmed.startsWith('//')) return ''
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed === '') return trimmed
  return ''
}

/** Build a redirect URL with the token placed before the hash fragment */
function buildRedirectWithToken(env: Env, returnTo: string, token: string): string {
  let frontendUrl = getFrontendUrl(env)
  // Ensure trailing slash so /isaqb-exam becomes /isaqb-exam/ (Vite needs this)
  if (!frontendUrl.endsWith('/')) frontendUrl += '/'
  const base = returnTo ? `${frontendUrl}${returnTo}` : `${frontendUrl}#/results`
  const hashIdx = base.indexOf('#')
  const separator = base.includes('?') ? '&' : '?'
  if (hashIdx >= 0) {
    // Insert ?token=xxx before the #hash
    return base.slice(0, hashIdx) + separator + `token=${token}` + base.slice(hashIdx)
  }
  return base + separator + `token=${token}`
}

// ─── GitHub OAuth ────────────────────────────────────────────────────

export async function handleGitHubLogin(request: Request, env: Env): Promise<Response> {
  const state = crypto.randomUUID()
  const returnTo = sanitizeReturnTo(new URL(request.url).searchParams.get('returnTo') ?? '')

  // Store state + returnTo in KV (5 min TTL)
  await env.SESSIONS.put(`oauth-state:${state}`, returnTo, { expirationTtl: 300 })

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${getWorkerOrigin(request, env)}/auth/github/callback`,
    scope: 'read:user',
    state,
  })

  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302)
}

export async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  // Validate state
  const returnTo = await env.SESSIONS.get(`oauth-state:${state}`)
  if (returnTo === null) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }
  await env.SESSIONS.delete(`oauth-state:${state}`)

  // Exchange code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  if (!tokenRes.ok) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  const tokenData: { access_token?: string } = await tokenRes.json()
  if (!tokenData.access_token) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  // Fetch user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'isaqb-exam-worker',
    },
  })

  if (!userRes.ok) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  const user: { id: number; login: string; avatar_url: string } = await userRes.json()

  // Create JWT session
  const jwt = await createJwt({
    sub: `github:${user.id}`,
    provider: 'github',
    name: user.login,
    avatar: user.avatar_url,
  }, env.JWT_SECRET)

  return Response.redirect(buildRedirectWithToken(env, returnTo, jwt), 302)
}

// ─── Google OAuth ────────────────────────────────────────────────────

export async function handleGoogleLogin(request: Request, env: Env): Promise<Response> {
  const state = crypto.randomUUID()
  const returnTo = sanitizeReturnTo(new URL(request.url).searchParams.get('returnTo') ?? '')

  await env.SESSIONS.put(`oauth-state:${state}`, returnTo, { expirationTtl: 300 })

  const redirectUri = `${getWorkerOrigin(request, env)}/auth/google/callback`

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile',
    state,
  })

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
}

export async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  const returnTo = await env.SESSIONS.get(`oauth-state:${state}`)
  if (returnTo === null) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }
  await env.SESSIONS.delete(`oauth-state:${state}`)

  const callbackRedirectUri = `${getWorkerOrigin(request, env)}/auth/google/callback`

  // Exchange code for token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: callbackRedirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  const tokenData: { access_token?: string } = await tokenRes.json()
  if (!tokenData.access_token) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!userRes.ok) {
    return Response.redirect(`${getFrontendUrl(env)}/#/auth-error`, 302)
  }

  const user: { id: string; name: string; picture: string } = await userRes.json()

  const jwt = await createJwt({
    sub: `google:${user.id}`,
    provider: 'google',
    name: user.name,
    avatar: user.picture,
  }, env.JWT_SECRET)

  return Response.redirect(buildRedirectWithToken(env, returnTo, jwt), 302)
}

// ─── Session Management ──────────────────────────────────────────────

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ authenticated: false }, { status: 200 })
  }

  return Response.json({
    authenticated: true,
    user: {
      id: session.sub,
      provider: session.provider,
      name: session.name,
      avatar: session.avatar,
    },
  })
}

export function handleLogout(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  })
}

/** Get the current session from the request (Authorization header or cookie fallback) */
export async function getSession(request: Request, env: Env): Promise<SessionPayload | null> {
  // Prefer Authorization: Bearer header
  const authHeader = request.headers.get('Authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const session = await verifyJwt(token, env.JWT_SECRET)
    if (session) return session
  }
  // Fallback to cookie
  const token = getSessionFromCookie(request)
  if (!token) return null
  return verifyJwt(token, env.JWT_SECRET)
}
