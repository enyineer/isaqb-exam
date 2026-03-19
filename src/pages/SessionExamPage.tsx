/**
 * SessionExamPage — Participant entry point for taking an exam session.
 * Handles session lookup (by ID or slug), time gating, auth/nickname flow,
 * and submission of results with server-side scoring.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRoute, useLocation } from 'wouter'
import { PageLayout } from '../components/PageLayout'
import { LoginButtons } from '../components/LoginButtons'
import { useAuth } from '../context/AuthContext'
import { useExam } from '../context/ExamContext'
import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import { fetchSession } from '../utils/sessions'
import type { ExamSession } from '../data/sessionSchema'
import { getSessionStatus } from '../data/sessionSchema'
import { Loader2, Clock, XCircle, User, LogIn } from 'lucide-react'

/** Key used to store active session context in sessionStorage */
export const SESSION_CONTEXT_KEY = 'isaqb-session-context'

export interface SessionContext {
  sessionId: string
  sessionSlug: string | null
  nickname: string | null
}

/** Read the current session context (if any) from sessionStorage */
export function getSessionContext(): SessionContext | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CONTEXT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Clear session context after submission */
export function clearSessionContext(): void {
  sessionStorage.removeItem(SESSION_CONTEXT_KEY)
}

// ─── Countdown ───────────────────────────────────────────────────────

function useCountdown(targetIso: string) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(targetIso).getTime() - Date.now()))

  useEffect(() => {
    const interval = setInterval(() => {
      const r = Math.max(0, new Date(targetIso).getTime() - Date.now())
      setRemaining(r)
      if (r === 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [targetIso])

  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  return { remaining, formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` }
}

// ─── Page ────────────────────────────────────────────────────────────

export function SessionExamPage() {
  const { t } = useLanguage()
  const { authStatus } = useAuth()
  const { resetExam } = useExam()
  const [, params] = useRoute('/session/:id')
  const [, navigate] = useLocation()

  const [session, setSession] = useState<ExamSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')

  const idOrSlug = params?.id ?? ''

  const loadSession = useCallback(async () => {
    if (!idOrSlug) return
    setLoading(true)
    try {
      const { session: s } = await fetchSession(idOrSlug)
      setSession(s)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [idOrSlug])

  useEffect(() => { loadSession() }, [loadSession])

  // Once authenticated via OAuth, auto-start the exam
  useEffect(() => {
    if (session && authStatus.authenticated && getSessionStatus(session) === 'active') {
      startSessionExam(null)
    }
  }, [authStatus.authenticated, session])

  /** Store session context and navigate to the exam */
  const startSessionExam = (nick: string | null) => {
    if (!session) return
    const ctx: SessionContext = {
      sessionId: session.id,
      sessionSlug: session.slug ?? null,
      nickname: nick,
    }
    sessionStorage.setItem(SESSION_CONTEXT_KEY, JSON.stringify(ctx))
    resetExam()
    navigate('/question/1')
  }

  if (loading) {
    return (
      <PageLayout>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </main>
      </PageLayout>
    )
  }

  if (error || !session) {
    return (
      <PageLayout>
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-12 text-center page-enter">
          <XCircle size={48} className="mx-auto mb-4 text-error opacity-60" />
          <p className="text-error font-medium">{error === 'SESSION_NOT_FOUND' ? t(labels.sessionNotFound) : error}</p>
        </main>
      </PageLayout>
    )
  }

  const status = getSessionStatus(session)

  // ── Upcoming: show countdown ──
  if (status === 'upcoming') {
    return (
      <PageLayout>
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-12 text-center page-enter">
          <SessionCountdown session={session} />
        </main>
      </PageLayout>
    )
  }

  // ── Ended ──
  if (status === 'ended') {
    return (
      <PageLayout>
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-12 text-center page-enter">
          <Clock size={48} className="mx-auto mb-4 text-text-muted opacity-40" />
          <h1 className="font-heading font-bold text-xl mb-2">{session.title}</h1>
          <p className="text-text-muted">{t(labels.sessionEnded)}</p>
        </main>
      </PageLayout>
    )
  }

  // ── Active: show auth options (nickname or OAuth) ──
  return (
    <PageLayout>
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-12 text-center page-enter">
        <LogIn size={48} className="mx-auto mb-4 text-primary opacity-60" />
        <h1 className="font-heading font-bold text-xl mb-2">{session.title}</h1>
        {session.description && <p className="text-sm text-text-muted mb-6">{session.description}</p>}

        {/* Nickname auth */}
        <div className="p-5 rounded-2xl border border-border bg-surface space-y-3 mb-4">
          <label className="text-sm font-medium block text-left">{t(labels.sessionNickname)}</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder={t(labels.sessionNicknamePlaceholder)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary"
            maxLength={50}
            onKeyDown={e => { if (e.key === 'Enter' && nickname.trim()) startSessionExam(nickname.trim()) }}
          />
          <button
            onClick={() => startSessionExam(nickname.trim())}
            disabled={!nickname.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
          >
            <User size={16} />
            {t(labels.sessionJoinAsGuest)}
          </button>
        </div>

        {/* OAuth auth */}
        {!authStatus.authenticated && (
          <>
            <p className="text-sm text-text-muted mb-3">{t(labels.sessionOrSignIn)}</p>
            <LoginButtons returnTo={`#/session/${idOrSlug}`} />
          </>
        )}
      </main>
    </PageLayout>
  )
}

// ─── Countdown Sub-component ─────────────────────────────────────────

function SessionCountdown({ session }: { session: ExamSession }) {
  const { t } = useLanguage()
  const { formatted, remaining } = useCountdown(session.startTime)

  return (
    <>
      <Clock size={48} className="mx-auto mb-4 text-yellow-500 opacity-60" />
      <h1 className="font-heading font-bold text-xl mb-2">{session.title}</h1>
      {session.description && <p className="text-sm text-text-muted mb-6">{session.description}</p>}

      <p className="text-sm text-text-muted mb-2">{t(labels.sessionStartsIn)}</p>
      <div className="font-heading text-4xl font-bold text-primary tabular-nums">
        {formatted}
      </div>

      <p className="text-xs text-text-muted mt-4">{t(labels.sessionNotStarted)}</p>
    </>
  )
}
