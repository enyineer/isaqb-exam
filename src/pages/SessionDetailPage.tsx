/**
 * SessionDetailPage — Lecturer view for a single exam session.
 * Shows session info, QR code, participant submissions, stats charts, and notes.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRoute, useLocation } from 'wouter'
import { PageLayout } from '../components/PageLayout'
import { ConfirmModal } from '../components/ConfirmModal'
import { QRCode } from '../components/QRCode'
import { SessionStatsView } from '../components/SessionStatsCharts'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import {
  fetchSession,
  fetchSessionSubmissions,
  fetchSessionStats,
  updateSession,
  deleteSession,
  getSessionLink,
} from '../utils/sessions'
import type { ExamSession, SessionSubmission, SessionStats } from '../data/sessionSchema'
import { getSessionStatus } from '../data/sessionSchema'
import type { Question } from '../data/schema'
import {
  ArrowLeft, Loader2, Copy, Check, Trash2, Pencil, Save,
  ChevronDown, ChevronUp, BarChart3, MessageSquare, Users, Download, X,
} from 'lucide-react'

// ─── Tabs ────────────────────────────────────────────────────────────

type Tab = 'submissions' | 'stats' | 'notes'

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function fromLocalDatetimeInput(value: string): string {
  return new Date(value).toISOString()
}

// ─── Edit Form ───────────────────────────────────────────────────────

interface EditFormProps {
  session: ExamSession
  onSaved: (updated: ExamSession) => void
  onCancel: () => void
}

function EditSessionForm({ session, onSaved, onCancel }: EditFormProps) {
  const { t } = useLanguage()
  const [title, setTitle] = useState(session.title)
  const [description, setDescription] = useState(session.description)
  const [slug, setSlug] = useState(session.slug ?? '')
  const [startTime, setStartTime] = useState(toLocalDatetimeInput(session.startTime))
  const [endTime, setEndTime] = useState(toLocalDatetimeInput(session.endTime))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { session: updated } = await updateSession(session.id, {
        title: title.trim(),
        description: description.trim(),
        slug: slug.trim() || null,
        startTime: fromLocalDatetimeInput(startTime),
        endTime: fromLocalDatetimeInput(endTime),
      })
      onSaved(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 rounded-2xl border-2 border-primary/30 bg-surface space-y-4">
      <h3 className="font-heading font-semibold text-lg">{t(labels.sessionEdit)}</h3>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t(labels.sessionTitle)}</label>
        <input
          type="text" value={title} onChange={e => setTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary"
          required maxLength={200}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t(labels.sessionDescription)}</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary resize-none"
          rows={2} maxLength={2000}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t(labels.sessionSlug)}</label>
        <input
          type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          placeholder={t(labels.sessionSlugPlaceholder)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary"
          maxLength={64}
        />
        <p className="text-xs text-text-muted">{t(labels.sessionSlugHint)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t(labels.sessionStartTime)}</label>
          <input
            type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{t(labels.sessionEndTime)}</label>
          <input
            type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-alt text-sm focus:outline-2 focus:outline-primary"
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-error font-medium">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-border bg-surface font-medium text-sm hover:bg-surface-hover transition-all cursor-pointer">
          {t(labels.sessionCancel)}
        </button>
        <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t(labels.sessionSave)}
        </button>
      </div>
    </form>
  )
}

// ─── Submission Row ──────────────────────────────────────────────────

interface SubmissionRowProps {
  submission: SessionSubmission
  index: number
}

function SubmissionRow({ submission, index }: SubmissionRowProps) {
  const [expanded, setExpanded] = useState(false)
  const providerBadge = submission.authMethod === 'nickname' ? '👤' : submission.authMethod === 'github' ? '🐙' : '🔵'

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer text-left"
      >
        <span className="text-text-muted text-xs w-6">{index + 1}</span>
        {submission.participantAvatar ? (
          <img src={submission.participantAvatar} alt="" className="w-7 h-7 rounded-full" />
        ) : (
          <span className="text-lg">{providerBadge}</span>
        )}
        <span className="font-medium text-sm flex-1 truncate">{submission.participantName}</span>
        <span className={`font-heading font-bold text-sm ${submission.passed ? 'text-success' : 'text-error'}`}>
          {submission.percentage}%
        </span>
        <span className="text-xs text-text-muted">{formatDuration(submission.elapsedMs)}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-2 text-sm animate-in">
          <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
            <div>Score: <span className="font-semibold text-text">{submission.score} / {submission.maxScore}</span></div>
            <div>Auth: <span className="font-semibold text-text">{submission.authMethod}</span></div>
          </div>

          {/* Notes preview */}
          {Object.keys(submission.questionNotes).length > 0 && (
            <div className="mt-2 space-y-1">
              <h5 className="text-xs font-semibold text-text-muted">Notes:</h5>
              {Object.entries(submission.questionNotes).map(([qId, note]) => (
                <p key={qId} className="text-xs text-text-muted bg-surface-alt px-3 py-1.5 rounded-lg">
                  <span className="font-mono text-text-muted/60">{qId}: </span>{note}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CSV Export ───────────────────────────────────────────────────────

function downloadCsv(submissions: SessionSubmission[], title: string) {
  const header = 'Name,Auth Method,Score,Max Score,Percentage,Passed,Time (ms),Submitted At\n'
  const rows = submissions.map(s =>
    [s.participantName, s.authMethod, s.score, s.maxScore, s.percentage, s.passed, s.elapsedMs, s.submittedAt].join(','),
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '_')}_submissions.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Notes View ──────────────────────────────────────────────────────

interface NotesViewProps {
  submissions: SessionSubmission[]
  questions: Question[]
}

function NotesView({ submissions, questions }: NotesViewProps) {
  const { t } = useLanguage()

  // Group notes by question
  const notesByQuestion: Record<string, Array<{ author: string; note: string }>> = {}
  for (const sub of submissions) {
    for (const [qId, note] of Object.entries(sub.questionNotes)) {
      if (!note.trim()) continue
      if (!notesByQuestion[qId]) notesByQuestion[qId] = []
      notesByQuestion[qId].push({ author: sub.participantName, note })
    }
  }

  const questionIds = Object.keys(notesByQuestion)
  if (questionIds.length === 0) {
    return <p className="text-center text-text-muted py-8">{t(labels.sessionNoNotes)}</p>
  }

  return (
    <div className="space-y-6">
      {questions.map((q, idx) => {
        const notes = notesByQuestion[q.id]
        if (!notes?.length) return null
        return (
          <div key={q.id} className="p-4 rounded-xl border border-border bg-surface space-y-3">
            <h4 className="font-heading font-semibold text-sm">
              {t(labels.question)} {idx + 1}
            </h4>
            {notes.map((n, i) => (
              <div key={i} className="bg-surface-alt px-3 py-2 rounded-lg text-sm">
                <span className="font-medium text-primary text-xs">{n.author}:</span>
                <p className="text-text-muted mt-0.5">{n.note}</p>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────

export function SessionDetailPage() {
  const { t } = useLanguage()
  const { authStatus } = useAuth()
  const [, navigate] = useLocation()
  const [match, params] = useRoute('/sessions/:id')

  const [session, setSession] = useState<ExamSession | null>(null)
  const [submissions, setSubmissions] = useState<SessionSubmission[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('submissions')
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionId = params?.id ?? ''

  const loadData = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const [sessionRes, submissionsRes, statsRes] = await Promise.all([
        fetchSession(sessionId),
        fetchSessionSubmissions(sessionId).catch(() => ({ submissions: [] as SessionSubmission[] })),
        fetchSessionStats(sessionId).catch(() => ({ stats: null })),
      ])
      setSession(sessionRes.session)
      setSubmissions(submissionsRes.submissions)
      if (statsRes.stats) setStats(statsRes.stats)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Auto-refresh for active sessions
  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      if (session && getSessionStatus(session) === 'active') loadData()
    }, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleDelete = async () => {
    if (!session) return
    try {
      await deleteSession(session.id)
      navigate('/sessions')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const copyLink = async () => {
    if (!session) return
    await navigator.clipboard.writeText(getSessionLink(session))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 text-center">
          <p className="text-error">{error ?? t(labels.sessionNotFound)}</p>
          <button onClick={() => navigate('/sessions')} className="mt-4 text-primary hover:underline cursor-pointer">
            ← {t(labels.sessionsTitle)}
          </button>
        </main>
      </PageLayout>
    )
  }

  const isOwner = authStatus.authenticated && authStatus.user.id === session.creatorId
  const status = getSessionStatus(session)
  const link = getSessionLink(session)

  // Non-owner view
  if (!isOwner) {
    return (
      <PageLayout>
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 text-center">
          <p className="text-error">Access denied — only the session creator can view this page.</p>
          <button onClick={() => navigate('/')} className="mt-4 text-primary hover:underline cursor-pointer">
            ← Back
          </button>
        </main>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 page-enter">
        {/* Back button */}
        <button onClick={() => navigate('/sessions')} className="flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors mb-6 cursor-pointer">
          <ArrowLeft size={16} /> {t(labels.sessionsTitle)}
        </button>

        {editing ? (
          <EditSessionForm
            session={session}
            onSaved={(updated) => { setSession(updated); setEditing(false) }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            {/* Session Header */}
            <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h1 className="font-heading font-bold text-xl mb-1">{session.title}</h1>
                  {session.description && <p className="text-sm text-text-muted">{session.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setEditing(true)} className="p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer" title={t(labels.sessionEdit)}>
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => setShowDelete(true)} className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors cursor-pointer" title={t(labels.sessionDelete)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted mb-4">
                <span>{formatDateTime(session.startTime)} → {formatDateTime(session.endTime)}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status === 'active' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : status === 'upcoming' ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                  {t(labels[status === 'active' ? 'sessionStatusActive' : status === 'upcoming' ? 'sessionStatusUpcoming' : 'sessionStatusEnded'])}
                </span>
              </div>

              {/* Session Link + QR */}
              <div className="flex flex-col sm:flex-row items-start gap-4 pt-4 border-t border-border">
                <div className="flex-1 space-y-2 min-w-0">
                  <h3 className="text-sm font-semibold">{t(labels.sessionLink)}</h3>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-surface-alt px-3 py-1.5 rounded-lg truncate flex-1 font-mono">
                      {link}
                    </code>
                    <button onClick={copyLink} className="p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer shrink-0">
                      {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                <div className="shrink-0">
                  <QRCode value={link} size={120} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 border-b border-border">
              {[
                { key: 'submissions' as Tab, label: labels.sessionSubmissions, icon: Users, count: submissions.length },
                { key: 'stats' as Tab, label: labels.sessionStats, icon: BarChart3 },
                { key: 'notes' as Tab, label: labels.sessionNotes, icon: MessageSquare },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}
                >
                  <tab.icon size={14} />
                  {t(tab.label)}
                  {tab.count != null && <span className="text-xs bg-surface-alt px-1.5 py-0.5 rounded-full">{tab.count}</span>}
                </button>
              ))}

              {/* CSV Export */}
              {submissions.length > 0 && (
                <button
                  onClick={() => downloadCsv(submissions, session.title)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs text-text-muted hover:text-primary transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  {t(labels.sessionExportCsv)}
                </button>
              )}
            </div>

            {/* Tab Content */}
            {activeTab === 'submissions' && (
              submissions.length === 0 ? (
                <p className="text-center text-text-muted py-8">{t(labels.sessionNoSubmissions)}</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub, idx) => (
                    <SubmissionRow key={sub.participantId} submission={sub} index={idx} />
                  ))}
                </div>
              )
            )}

            {activeTab === 'stats' && stats && <SessionStatsView stats={stats} questions={questions} />}
            {activeTab === 'stats' && !stats && <p className="text-center text-text-muted py-8">{t(labels.sessionNoSubmissions)}</p>}

            {activeTab === 'notes' && <NotesView submissions={submissions} questions={questions} />}
          </>
        )}

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
            onConfirm={() => { setShowDelete(false); handleDelete() }}
          />
        )}
      </main>
    </PageLayout>
  )
}
