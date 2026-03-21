/**
 * Session CRUD handlers — create, list, get, update, delete exam sessions.
 * Sessions are stored in the EXAM_SESSIONS KV namespace.
 */

import type { Env } from './types.ts'
import type { ExamSession } from '../../src/data/sessionSchema.ts'
import { createSessionSchema, updateSessionSchema, sessionSlugSchema } from '../../src/data/sessionSchema.ts'
import { getSession } from './auth.ts'
import { z } from 'zod'

// ─── KV Helpers ──────────────────────────────────────────────────────

function sessionKey(id: string): string { return `session:${id}` }
function submissionsKey(id: string): string { return `session:${id}:submissions` }
function userSessionsKey(userId: string): string { return `sessions-by-user:${userId}` }
function slugKey(slug: string): string { return `session-slug:${slug}` }

async function readSession(kv: KVNamespace, id: string): Promise<ExamSession | null> {
  return kv.get<ExamSession>(sessionKey(id), 'json')
}

async function writeSession(kv: KVNamespace, session: ExamSession): Promise<void> {
  await kv.put(sessionKey(session.id), JSON.stringify(session))
}

/** Add a session ID to the user's session index */
async function addToUserIndex(kv: KVNamespace, userId: string, sessionId: string): Promise<void> {
  const existing = await kv.get<string[]>(userSessionsKey(userId), 'json') ?? []
  if (!existing.includes(sessionId)) {
    existing.push(sessionId)
    await kv.put(userSessionsKey(userId), JSON.stringify(existing))
  }
}

/** Remove a session ID from the user's session index */
async function removeFromUserIndex(kv: KVNamespace, userId: string, sessionId: string): Promise<void> {
  const existing = await kv.get<string[]>(userSessionsKey(userId), 'json') ?? []
  const updated = existing.filter(id => id !== sessionId)
  await kv.put(userSessionsKey(userId), JSON.stringify(updated))
}

/**
 * Resolve a session by ID or slug.
 * Tries direct ID lookup first, then falls back to slug index.
 */
export async function resolveSession(kv: KVNamespace, idOrSlug: string): Promise<ExamSession | null> {
  // Try direct ID lookup first
  const byId = await readSession(kv, idOrSlug)
  if (byId) return byId

  // Try slug lookup
  const sessionId = await kv.get(slugKey(idOrSlug))
  if (sessionId) return readSession(kv, sessionId)

  return null
}

// ─── Route Handlers ──────────────────────────────────────────────────

/** POST /api/sessions — Create a new exam session */
export async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = createSessionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i: z.ZodIssue) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return Response.json({ error: msg }, { status: 400 })
  }
  const body = parsed.data

  // Check slug uniqueness if provided
  const slug = body.slug ?? null
  if (slug) {
    const existingSlug = await env.EXAM_SESSIONS.get(slugKey(slug))
    if (existingSlug) {
      return Response.json({ error: 'This slug is already taken. Please choose a different one.' }, { status: 409 })
    }
  }

  const now = new Date().toISOString()
  const examSession: ExamSession = {
    id: crypto.randomUUID(),
    slug,
    creatorId: session.sub,
    creatorName: session.name,
    title: body.title,
    description: body.description,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
    commitSha: body.commitSha,
    createdAt: now,
    updatedAt: now,
  }

  // Write session, user index, and slug index
  await writeSession(env.EXAM_SESSIONS, examSession)
  await addToUserIndex(env.EXAM_SESSIONS, session.sub, examSession.id)
  if (slug) {
    await env.EXAM_SESSIONS.put(slugKey(slug), examSession.id)
  }

  return Response.json({ session: examSession }, { status: 201 })
}

/** GET /api/sessions — List sessions created by the authenticated user */
export async function handleListSessions(request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const sessionIds = await env.EXAM_SESSIONS.get<string[]>(userSessionsKey(session.sub), 'json') ?? []

  const sessions: ExamSession[] = []
  for (const id of sessionIds) {
    const s = await readSession(env.EXAM_SESSIONS, id)
    if (s) sessions.push(s)
  }

  // Sort by creation date descending (newest first)
  sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return Response.json({ sessions })
}

/** GET /api/sessions/:idOrSlug — Get session details (public) */
export async function handleGetSession(idOrSlug: string, env: Env): Promise<Response> {
  const session = await resolveSession(env.EXAM_SESSIONS, idOrSlug)
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  return Response.json({ session })
}

/** PUT /api/sessions/:id — Update session (owner only) */
export async function handleUpdateSession(id: string, request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const existing = await readSession(env.EXAM_SESSIONS, id)
  if (!existing) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  if (existing.creatorId !== session.sub) {
    return Response.json({ error: 'Only the session creator can edit this session' }, { status: 403 })
  }

  const parsed = updateSessionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i: z.ZodIssue) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return Response.json({ error: msg }, { status: 400 })
  }
  const body = parsed.data

  // Validate time ordering — only when both are non-null
  const newStart = body.startTime !== undefined ? body.startTime : existing.startTime
  const newEnd = body.endTime !== undefined ? body.endTime : existing.endTime
  if (newStart && newEnd && new Date(newStart) >= new Date(newEnd)) {
    return Response.json({ error: 'Start time must be before end time' }, { status: 400 })
  }

  // Handle slug changes
  if (body.slug !== undefined) {
    const newSlug = body.slug
    if (newSlug && newSlug !== existing.slug) {
      // Check uniqueness of new slug
      const existingSlug = await env.EXAM_SESSIONS.get(slugKey(newSlug))
      if (existingSlug && existingSlug !== id) {
        return Response.json({ error: 'This slug is already taken. Please choose a different one.' }, { status: 409 })
      }
      // Write new slug index
      await env.EXAM_SESSIONS.put(slugKey(newSlug), id)
    }
    // Remove old slug index if it changed
    if (existing.slug && existing.slug !== newSlug) {
      await env.EXAM_SESSIONS.delete(slugKey(existing.slug))
    }
  }

  const updated: ExamSession = {
    ...existing,
    title: body.title ?? existing.title,
    description: body.description ?? existing.description,
    slug: body.slug !== undefined ? body.slug ?? null : existing.slug,
    startTime: newStart ?? null,
    endTime: newEnd ?? null,
    updatedAt: new Date().toISOString(),
  }

  await writeSession(env.EXAM_SESSIONS, updated)
  return Response.json({ session: updated })
}

/** DELETE /api/sessions/:id — Delete session + submissions + slug index (owner only) */
export async function handleDeleteSession(id: string, request: Request, env: Env): Promise<Response> {
  const session = await getSession(request, env)
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const existing = await readSession(env.EXAM_SESSIONS, id)
  if (!existing) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  if (existing.creatorId !== session.sub) {
    return Response.json({ error: 'Only the session creator can delete this session' }, { status: 403 })
  }

  // Delete session, submissions, slug index, and update user index
  await env.EXAM_SESSIONS.delete(sessionKey(id))
  await env.EXAM_SESSIONS.delete(submissionsKey(id))
  if (existing.slug) {
    await env.EXAM_SESSIONS.delete(slugKey(existing.slug))
  }
  await removeFromUserIndex(env.EXAM_SESSIONS, session.sub, id)

  return Response.json({ ok: true })
}
