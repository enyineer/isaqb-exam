/**
 * Frontend auth utilities — token management, OAuth login URLs,
 * and authentication status checks.
 */

import { WORKER_BASE_URL } from './config'

// ─── Types ───────────────────────────────────────────────────────────

export type AuthStatus =
  | { authenticated: false }
  | { authenticated: true; user: { id: string; provider: string; name: string; avatar: string } }

// ─── Token Management ────────────────────────────────────────────────

const TOKEN_KEY = 'isaqb-auth-token'

/** Store the auth token in localStorage */
export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Get the stored auth token */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** Clear the stored auth token */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** Build Authorization headers if a token exists */
export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Extract token from URL query params (after OAuth redirect) */
export function extractTokenFromUrl(): string | null {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('token')
  if (token) {
    storeToken(token)
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.toString())
  }
  return token
}

// ─── Auth API ────────────────────────────────────────────────────────

/** Check current authentication status */
export async function fetchAuthStatus(): Promise<AuthStatus> {
  const token = getToken()
  if (!token) return { authenticated: false }

  try {
    const res = await fetch(`${WORKER_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { authenticated: false }
    return res.json()
  } catch {
    return { authenticated: false }
  }
}

/** Get the OAuth login URL for a given provider */
export function getLoginUrl(provider: 'github' | 'google', returnTo?: string): string {
  const hashRoute = returnTo ?? `/${window.location.hash}`
  return `${WORKER_BASE_URL}/auth/${provider}?returnTo=${encodeURIComponent(hashRoute)}`
}

/** Log out (clear local token) */
export async function logout(): Promise<void> {
  clearToken()
}
