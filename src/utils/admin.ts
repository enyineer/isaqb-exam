/**
 * Frontend admin API utilities — check admin status,
 * manage leaderboard entries, blocked users, and admin users.
 */

import { WORKER_BASE_URL } from './leaderboardConfig'
import { authHeaders } from './auth'
import type { LeaderboardEntry } from './leaderboard'

// ─── Admin Check ─────────────────────────────────────────────────────

/** Check if the current user is an admin */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const res = await fetch(`${WORKER_BASE_URL}/api/admin/check`, {
      headers: authHeaders(),
    })
    if (!res.ok) return false
    const data: { isAdmin: boolean } = await res.json()
    return data.isAdmin
  } catch {
    return false
  }
}

// ─── Leaderboard Entry Management ────────────────────────────────────

/** Admin leaderboard entry — includes user ID (not exposed in public API) */
export interface AdminLeaderboardEntry extends LeaderboardEntry {
  id: string
}

/** Fetch all leaderboard entries (admin only) */
export async function adminFetchEntries(): Promise<AdminLeaderboardEntry[]> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/leaderboard/entries`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: { entries: AdminLeaderboardEntry[] } = await res.json()
  return data.entries
}

/** Delete a specific leaderboard entry (admin only) */
export async function adminDeleteEntry(userId: string, commitSha: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/leaderboard/entry`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ userId, commitSha }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

// ─── Blocked User Management ─────────────────────────────────────────

/** Fetch blocked user IDs (admin only) */
export async function adminFetchBlocked(): Promise<string[]> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/leaderboard/blocked`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: { blocked: string[] } = await res.json()
  return data.blocked
}

/** Block a user (admin only) */
export async function adminBlockUser(userId: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/leaderboard/blocked`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

/** Unblock a user (admin only) */
export async function adminUnblockUser(userId: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/leaderboard/blocked`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

// ─── Admin User Management ───────────────────────────────────────────

/** A dynamic admin entry */
export interface DynamicAdmin {
  id: string
  name: string
}

/** Admin list shape */
export interface AdminList {
  seedAdmins: string[]
  dynamicAdmins: DynamicAdmin[]
}

/** Fetch admin user IDs (admin only) */
export async function adminFetchAdmins(): Promise<AdminList> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/admins`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Add a new dynamic admin (admin only) */
export async function adminAddAdmin(userId: string, name: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ userId, name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

/** Remove a dynamic admin (admin only) */
export async function adminRemoveAdmin(userId: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE_URL}/api/admin/admins`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}
