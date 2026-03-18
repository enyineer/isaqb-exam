/**
 * Minimal JWT implementation for Cloudflare Workers.
 * Uses the Web Crypto API (available in Workers) for HMAC-SHA256 signing.
 */

import type { SessionPayload } from './types.ts'

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

/** Session duration: 7 days */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

function base64UrlEncode(data: Uint8Array): string {
  const binary = String.fromCharCode(...data)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function createJwt(payload: Omit<SessionPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }

  const header = base64UrlEncode(ENCODER.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64UrlEncode(ENCODER.encode(JSON.stringify(fullPayload)))
  const signingInput = `${header}.${body}`

  const key = await getSigningKey(secret)
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, ENCODER.encode(signingInput)),
  )

  return `${signingInput}.${base64UrlEncode(signature)}`
}

export async function verifyJwt(token: string, secret: string): Promise<SessionPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, sig] = parts
  const signingInput = `${header}.${body}`

  const key = await getSigningKey(secret)
  const signatureBytes = base64UrlDecode(sig)

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    ENCODER.encode(signingInput),
  )
  if (!valid) return null

  try {
    const payload: SessionPayload = JSON.parse(DECODER.decode(base64UrlDecode(body)))
    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Cookie name for the session */
export const SESSION_COOKIE = 'isaqb-session'

/** Extract session token from Cookie header */
export function getSessionFromCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  return match ? match[1] : null
}

/** Build a Set-Cookie header value */
export function buildSessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`
}

/** Build a cookie-clearing header value */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`
}
