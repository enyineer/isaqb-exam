/**
 * Admin API — manage leaderboard entries, blocked users, and admin users.
 *
 * Admin identity is established via the existing JWT session.
 * A user is an admin if their `session.sub` appears in:
 *   1. The `ADMIN_USER_IDS` env var (comma-separated seed list), or
 *   2. The `admin-users` KV key in the ADMIN namespace (dynamic list)
 */

import type { Env, SessionPayload, StoredLeaderboardEntry } from './types.ts'
import { getSession } from './auth.ts'

// ─── KV Keys ─────────────────────────────────────────────────────────

const KV_ADMIN_USERS = 'admin-users'
const KV_BLOCKED_USERS = 'blocked-users'

/** A dynamic admin entry with an ID and a human-readable name */
interface DynamicAdmin {
  id: string
  name: string
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Parse the comma-separated seed admin list from env */
function parseSeedAdmins(env: Env): string[] {
  if (!env.ADMIN_USER_IDS) return []
  return env.ADMIN_USER_IDS.split(',').map(id => id.trim()).filter(Boolean)
}

/** Read a JSON string array from KV (returns [] if missing) */
async function readList(kv: KVNamespace, key: string): Promise<string[]> {
  const data = await kv.get<string[]>(key, 'json')
  return data ?? []
}

/** Read dynamic admin list from KV — handles backwards compat with old string[] format */
async function readDynamicAdmins(kv: KVNamespace): Promise<DynamicAdmin[]> {
  const raw = await kv.get(KV_ADMIN_USERS, 'json') as DynamicAdmin[] | string[] | null
  if (!raw) return []
  // Backwards compat: migrate old string[] format
  if (raw.length > 0 && typeof raw[0] === 'string') {
    return (raw as string[]).map(id => ({ id, name: '' }))
  }
  return raw as DynamicAdmin[]
}

/** Write dynamic admin list to KV */
async function writeDynamicAdmins(kv: KVNamespace, list: DynamicAdmin[]): Promise<void> {
  await kv.put(KV_ADMIN_USERS, JSON.stringify(list))
}

/** Write a JSON string array to KV */
async function writeList(kv: KVNamespace, key: string, list: string[]): Promise<void> {
  await kv.put(key, JSON.stringify(list))
}

/** Check if a user ID is in the admin list (seed + dynamic) */
export async function isAdmin(userId: string, env: Env): Promise<boolean> {
  const seedAdmins = parseSeedAdmins(env)
  if (seedAdmins.includes(userId)) return true
  const dynamicAdmins = await readDynamicAdmins(env.ADMIN)
  return dynamicAdmins.some(a => a.id === userId)
}

/** Check if a user ID is blocked */
export async function isBlocked(userId: string, env: Env): Promise<boolean> {
  const blocked = await readList(env.ADMIN, KV_BLOCKED_USERS)
  return blocked.includes(userId)
}

/**
 * Verify the request has a valid session belonging to an admin.
 * Returns the session on success, or a 401/403 Response on failure.
 */
async function requireAdmin(request: Request, env: Env): Promise<SessionPayload | Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!(await isAdmin(session.sub, env))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session
}

// ─── Admin Check ─────────────────────────────────────────────────────

/** GET /api/admin/check — Check if the current user is an admin */
export async function handleAdminCheck(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ isAdmin: false })
  }
  return Response.json({ isAdmin: await isAdmin(session.sub, env) })
}

// ─── Leaderboard Entry Management ────────────────────────────────────

/** GET /api/admin/leaderboard/entries — List all entries across all shards */
export async function handleAdminGetEntries(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const allEntries: StoredLeaderboardEntry[] = []
  let cursor: string | undefined
  do {
    const list = await env.LEADERBOARD.list({ prefix: 'leaderboard:', cursor })
    for (const key of list.keys) {
      const data = await env.LEADERBOARD.get<StoredLeaderboardEntry[]>(key.name, 'json')
      if (data) allEntries.push(...data)
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)

  return Response.json({ entries: allEntries })
}

/** DELETE /api/admin/leaderboard/entry — Delete a specific entry by userId + commitSha */
export async function handleAdminDeleteEntry(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const body = await request.json<{ userId: string; commitSha: string }>().catch(() => null)
  if (!body?.userId || !body?.commitSha) {
    return Response.json({ error: 'userId and commitSha are required' }, { status: 400 })
  }

  const kvKey = `leaderboard:${body.commitSha}`
  const entries = await env.LEADERBOARD.get<StoredLeaderboardEntry[]>(kvKey, 'json')
  if (!entries) {
    return Response.json({ error: 'No entries found for this commit SHA' }, { status: 404 })
  }

  const filtered = entries.filter(e => e.id !== body.userId)
  if (filtered.length === entries.length) {
    return Response.json({ error: 'Entry not found' }, { status: 404 })
  }

  if (filtered.length === 0) {
    await env.LEADERBOARD.delete(kvKey)
  } else {
    await env.LEADERBOARD.put(kvKey, JSON.stringify(filtered))
  }

  return Response.json({ ok: true, remaining: filtered.length })
}

// ─── Blocked User Management ────────────────────────────────────────

/** GET /api/admin/leaderboard/blocked — List all blocked user IDs */
export async function handleAdminGetBlocked(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const blocked = await readList(env.ADMIN, KV_BLOCKED_USERS)
  return Response.json({ blocked })
}

/** POST /api/admin/leaderboard/blocked — Block a user */
export async function handleAdminBlockUser(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const body = await request.json<{ userId: string }>().catch(() => null)
  if (!body?.userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }

  const blocked = await readList(env.ADMIN, KV_BLOCKED_USERS)
  if (!blocked.includes(body.userId)) {
    blocked.push(body.userId)
    await writeList(env.ADMIN, KV_BLOCKED_USERS, blocked)
  }

  return Response.json({ ok: true, blocked })
}

/** DELETE /api/admin/leaderboard/blocked — Unblock a user */
export async function handleAdminUnblockUser(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const body = await request.json<{ userId: string }>().catch(() => null)
  if (!body?.userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }

  const blocked = await readList(env.ADMIN, KV_BLOCKED_USERS)
  const filtered = blocked.filter(id => id !== body.userId)
  await writeList(env.ADMIN, KV_BLOCKED_USERS, filtered)

  return Response.json({ ok: true, blocked: filtered })
}

// ─── Admin User Management ──────────────────────────────────────────

/** GET /api/admin/admins — List all admin user IDs (seed + dynamic) */
export async function handleAdminGetAdmins(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const seedAdmins = parseSeedAdmins(env)
  const dynamicAdmins = await readDynamicAdmins(env.ADMIN)

  return Response.json({ seedAdmins, dynamicAdmins })
}

/** POST /api/admin/admins — Add a new dynamic admin */
export async function handleAdminAddAdmin(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const body = await request.json<{ userId: string; name?: string }>().catch(() => null)
  if (!body?.userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }

  const dynamicAdmins = await readDynamicAdmins(env.ADMIN)
  if (!dynamicAdmins.some(a => a.id === body.userId)) {
    dynamicAdmins.push({ id: body.userId, name: body.name?.trim() || '' })
    await writeDynamicAdmins(env.ADMIN, dynamicAdmins)
  }

  return Response.json({ ok: true, dynamicAdmins })
}

/** DELETE /api/admin/admins — Remove a dynamic admin */
export async function handleAdminRemoveAdmin(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env)
  if (auth instanceof Response) return auth

  const body = await request.json<{ userId: string }>().catch(() => null)
  if (!body?.userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }

  const dynamicAdmins = await readDynamicAdmins(env.ADMIN)
  const filtered = dynamicAdmins.filter(a => a.id !== body.userId)
  await writeDynamicAdmins(env.ADMIN, filtered)

  return Response.json({ ok: true, dynamicAdmins: filtered })
}
