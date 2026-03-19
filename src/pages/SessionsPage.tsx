/**
 * SessionsPage — Lecturer dashboard for managing exam sessions.
 * Lists all sessions created by the authenticated user with create/edit functionality.
 */

import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'wouter'
import { PageLayout } from '../components/PageLayout'
import { LoginButtons } from '../components/LoginButtons'
import { ConfirmModal } from '../components/ConfirmModal'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import { labels } from '../utils/labels'
import { fetchSessions, createSession, deleteSession, getSessionLink } from '../utils/sessions'
import type { ExamSession } from '../data/sessionSchema'
import { getSessionStatus, type SessionStatus } from '../data/sessionSchema'
import {
  Plus, Loader2, Copy, Check, Trash2, CalendarClock,
  Clock, Users, ExternalLink, X,
} from 'lucide-react'

// ─── Status Badge ────────────────────────────────────────────────────

const statusConfig: Record<SessionStatus, { labelKey: keyof typeof labels; color: string; bg: string }> = {
  upcoming: { labelKey: 'sessionStatusUpcoming', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/15' },
  active: { labelKey: 'sessionStatusActive', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/15' },
  ended: { labelKey: 'sessionStatusEnded', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/15' },
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useLanguage()
  const cfg = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {t(labels[cfg.labelKey])}
    </span>
  )
}

// ─── Date Formatting ─────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function fromLocalDatetimeInput(value: string): string {
  return new Date(value).toISOString()
}

// ─── Create Session Form ─────────────────────────────────────────────

interface CreateFormProps {
  commitSha: string
  onCreated: (session: ExamSession) => void
  onCancel: () => void
}

function CreateSessionForm({ commitSha, onCreated, onCancel }: CreateFormProps) {
  const { t } = useLanguage()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startTime || !endTime) return
    setSubmitting(true)
    setError(null)
    try {
      const { session } = await createSession({
        title: title.trim(),
        description: description.trim(),
        slug: slug.trim() || null,
        startTime: fromLocalDatetimeInput(startTime),
        endTime: fromLocalDatetimeInput(endTime),
        commitSha,
      })
      onCreated(session)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 rounded-2xl border-2 border-primary/30 bg-surface space-y-4">
      <h3 className="font-heading font-semibold text-lg">{t(labels.sessionCreate)}</h3>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t(labels.sessionTitle)}</label>
        <input
          type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder={t(labels.sessionTitlePlaceholder)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary transition-all"
          required maxLength={200}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t(labels.sessionDescription)}</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder={t(labels.sessionDescriptionPlaceholder)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary transition-all resize-none"
          rows={2} maxLength={2000}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t(labels.sessionSlug)}</label>
        <input
          type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          placeholder={t(labels.sessionSlugPlaceholder)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary transition-all"
          maxLength={64}
        />
        <p className="text-xs text-text-muted">{t(labels.sessionSlugHint)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t(labels.sessionStartTime)}</label>
          <input
            type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary transition-all"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{t(labels.sessionEndTime)}</label>
          <input
            type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary transition-all"
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-error font-medium">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-border bg-surface font-medium text-sm hover:bg-surface-hover transition-all cursor-pointer"
        >
          {t(labels.sessionCancel)}
        </button>
        <button
          type="submit" disabled={submitting || !title.trim() || !startTime || !endTime}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {t(labels.sessionCreate)}
        </button>
      </div>
    </form>
  )
}

// ─── Session Card ────────────────────────────────────────────────────

interface SessionCardProps {
  session: ExamSession
  onDelete: (id: string) => void
}

function SessionCard({ session, onDelete }: SessionCardProps) {
  const { t } = useLanguage()
  const [, navigate] = useLocation()
  const [copied, setCopied] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const status = getSessionStatus(session)
  const link = getSessionLink(session)

  const copyLink = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div
        className="p-5 rounded-2xl border border-border bg-surface hover:border-primary-light transition-all duration-200 cursor-pointer group"
        onClick={() => navigate(`/sessions/${session.id}`)}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-heading font-semibold text-base group-hover:text-primary transition-colors truncate">
            {session.title}
          </h3>
          <StatusBadge status={status} />
        </div>

        {session.description && (
          <p className="text-sm text-text-muted mb-3 line-clamp-2">{session.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
          <span className="flex items-center gap-1">
            <CalendarClock size={13} />
            {formatDateTime(session.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {formatDateTime(session.endTime)}
          </span>
        </div>

        {/* Session link + actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <span className="text-xs text-text-muted truncate flex-1 font-mono">
            {session.slug ? `…/session/${session.slug}` : `…/session/${session.id.slice(0, 8)}…`}
          </span>
          <button
            onClick={copyLink}
            className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
            title={t(labels.sessionLink)}
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDelete(true) }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
            title={t(labels.sessionDelete)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showDelete && (
        <ConfirmModal
          icon={<Trash2 size={20} className="text-red-500" />}
          iconBg="bg-red-500/15"
          title={t(labels.sessionDelete)}
          body={t(labels.sessionDeleteConfirm)}
          confirmLabel={t(labels.adminDelete)}
          confirmVariant="danger"
          cancelLabel={t(labels.sessionCancel)}
          onCancel={() => setShowDelete(false)}
          onConfirm={() => { setShowDelete(false); onDelete(session.id) }}
        />
      )}
    </>
  )
}

// ─── Page ────────────────────────────────────────────────────────────

export function SessionsPage() {
  const { t } = useLanguage()
  const { authStatus, authLoading } = useAuth()
  const { questionsCommitSha } = useExam()
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    if (!authStatus.authenticated) return
    setLoading(true)
    try {
      const { sessions: data } = await fetchSessions()
      setSessions(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [authStatus])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleCreated = (session: ExamSession) => {
    setSessions(prev => [session, ...prev])
    setShowCreate(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Not authenticated — show explanation + sign-in
  if (!authLoading && !authStatus.authenticated) {
    return (
      <PageLayout>
        <main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 page-enter">
          <div className="text-center space-y-6">
            <div>
              <Users size={48} className="mx-auto mb-4 text-primary opacity-60" />
              <h1 className="font-heading font-bold text-2xl mb-2">{t(labels.sessionsTitle)}</h1>
              <p className="text-text-muted max-w-md mx-auto">{t(labels.sessionsSignInPrompt)}</p>
            </div>
            <LoginButtons returnTo="#/sessions" />
          </div>
        </main>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 page-enter">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading font-bold text-2xl">{t(labels.sessionsTitle)}</h1>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-medium text-sm hover:opacity-90 transition-all cursor-pointer"
            >
              <Plus size={16} />
              {t(labels.sessionCreate)}
            </button>
          )}
        </div>

        {error && <p className="text-sm text-error mb-4">{error}</p>}

        {showCreate && questionsCommitSha && (
          <div className="mb-6">
            <CreateSessionForm
              commitSha={questionsCommitSha}
              onCreated={handleCreated}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <CalendarClock size={40} className="mx-auto mb-3 opacity-40" />
            <p>{t(labels.sessionsEmpty)}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sessions.map(s => (
              <SessionCard key={s.id} session={s} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </PageLayout>
  )
}
