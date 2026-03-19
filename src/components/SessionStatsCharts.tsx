/**
 * Session statistics chart components — pure CSS/SVG, no charting library.
 * All colors use theme CSS variables for dark/light mode compatibility.
 */

import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import type { QuestionStats, SessionStats, SessionSubmission } from '../data/sessionSchema'
import type { Question, PickQuestion, CategoryQuestion } from '../data/schema'
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// ─── Pass Rate Chart ─────────────────────────────────────────────────

interface PassRateChartProps {
  stats: SessionStats
}

export function PassRateChart({ stats }: PassRateChartProps) {
  const { t } = useLanguage()
  const passAngle = (stats.passRate / 100) * 360
  const size = 120
  const radius = 48
  const cx = size / 2
  const cy = size / 2

  // SVG arc path
  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, radius, endAngle)
    const end = polarToCartesian(cx, cy, radius, startAngle)
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
  }

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: centerX + r * Math.cos(rad), y: centerY + r * Math.sin(rad) }
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-error)" strokeWidth="10" opacity="0.3" />
        {/* Pass arc */}
        {stats.passRate > 0 && stats.passRate < 100 && (
          <path d={describeArc(0, passAngle)} fill="none" stroke="var(--color-success)" strokeWidth="10" strokeLinecap="round" />
        )}
        {stats.passRate >= 100 && (
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-success)" strokeWidth="10" />
        )}
        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-heading font-bold" fontSize="18" fill="var(--theme-text)">
          {stats.passRate}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--theme-text-muted)">
          {t(labels.sessionPassRate)}
        </text>
      </svg>
      <div className="flex flex-col gap-1">
        <div className="text-sm text-text-muted">
          {t(labels.sessionSubmissions)}: <span className="font-semibold text-text">{stats.totalSubmissions}</span>
        </div>
        <div className="text-sm text-text-muted">
          {t(labels.sessionAvgScore)}: <span className="font-semibold text-text">{stats.averagePercentage}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Answer Distribution Chart (Pick) ────────────────────────────────

function PickDistribution({ questionStats, question }: { questionStats: QuestionStats; question: PickQuestion }) {
  const { t } = useLanguage()
  const totalResponses = Math.max(1, ...Object.values(questionStats.answerDistribution))

  return (
    <div className="space-y-1.5">
      {question.options.map(opt => {
        const count = questionStats.answerDistribution[opt.id] ?? 0
        const pct = (count / totalResponses) * 100
        const isCorrect = opt.correct

        return (
          <div key={opt.id} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className={`truncate ${isCorrect ? 'font-semibold text-success' : 'text-text-muted'}`}>
                {isCorrect && '✓ '}{t(opt.text)}
              </span>
              <span className={`shrink-0 tabular-nums ${isCorrect ? 'font-semibold text-success' : 'text-text-muted'}`}>
                {count}
              </span>
            </div>
            <div className="h-4 bg-surface-alt rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 1)}%`,
                  background: isCorrect ? 'var(--color-success)' : 'var(--theme-primary-light)',
                  opacity: isCorrect ? 1 : 0.5,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Answer Distribution Chart (Category) ────────────────────────────

function CategoryDistribution({ questionStats, question }: { questionStats: QuestionStats; question: CategoryQuestion }) {
  const { t } = useLanguage()

  return (
    <div className="space-y-3">
      {question.statements.map(stmt => {
        const dist = questionStats.categoryDistribution[stmt.id] ?? {}
        const totalForStmt = Object.values(dist).reduce((s, c) => s + c, 0) || 1

        return (
          <div key={stmt.id} className="space-y-1">
            <p className="text-xs text-text-muted truncate">{t(stmt.text)}</p>
            <div className="flex gap-0.5 h-5 rounded-md overflow-hidden bg-surface-alt">
              {question.categories.map(cat => {
                const count = dist[cat.label] ?? 0
                const pct = (count / totalForStmt) * 100
                const isCorrect = cat.label === stmt.correctCategory

                return pct > 0 ? (
                  <div
                    key={cat.label}
                    className="h-full transition-all duration-300 relative group"
                    style={{
                      width: `${pct}%`,
                      background: isCorrect ? 'var(--color-success)' : 'var(--theme-primary-light)',
                      opacity: isCorrect ? 1 : 0.4,
                    }}
                    title={`${t(cat.text)}: ${count} (${Math.round(pct)}%)`}
                  />
                ) : null
              })}
            </div>
            <div className="flex gap-2 text-[10px] text-text-muted/70">
              {question.categories.map(cat => {
                const count = dist[cat.label] ?? 0
                const isCorrect = cat.label === stmt.correctCategory
                return count > 0 ? (
                  <span key={cat.label} className={isCorrect ? 'font-semibold text-success' : ''}>
                    {t(cat.text)}: {count}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Time Percentile Chart ───────────────────────────────────────────

interface TimePercentileChartProps {
  questionStats: QuestionStats
}

export function TimePercentileChart({ questionStats }: TimePercentileChartProps) {
  const { t } = useLanguage()
  const { p10, p25, p50, p75, p90 } = questionStats.timePercentiles
  const max = p90 * 1.15 || 1

  const toPercent = (v: number) => (v / max) * 100

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-text-muted">{t(labels.sessionTimePerQuestion)}</h4>
      <div className="relative h-8 rounded-lg bg-surface-alt overflow-hidden">
        {/* Whiskers: p10 to p90 */}
        <div
          className="absolute h-0.5 top-1/2 -translate-y-1/2 bg-text-muted/30"
          style={{ left: `${toPercent(p10)}%`, width: `${toPercent(p90 - p10)}%` }}
        />
        {/* Box: p25 to p75 */}
        <div
          className="absolute h-5 top-1/2 -translate-y-1/2 rounded-md transition-all duration-300"
          style={{
            left: `${toPercent(p25)}%`,
            width: `${toPercent(p75 - p25)}%`,
            background: 'var(--theme-primary-light)',
            opacity: 0.4,
          }}
        />
        {/* Median line */}
        <div
          className="absolute w-0.5 h-6 top-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${toPercent(p50)}%`, background: 'var(--theme-primary)' }}
        />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>p10: {formatTime(p10)}</span>
        <span className="font-semibold">Median: {formatTime(p50)}</span>
        <span>p90: {formatTime(p90)}</span>
      </div>
    </div>
  )
}

// ─── Per-Question Notes ──────────────────────────────────────────────

function QuestionNotes({ questionId, submissions }: { questionId: string; submissions: SessionSubmission[] }) {
  const notes = submissions
    .filter(s => s.questionNotes[questionId]?.trim())
    .map(s => ({ author: s.participantName, note: s.questionNotes[questionId] }))

  if (notes.length === 0) return null

  return (
    <div className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <StickyNote size={12} />
        Notes ({notes.length})
      </h4>
      {notes.map((n, i) => (
        <div key={i} className="bg-amber-500/5 border border-amber-500/15 px-3 py-2 rounded-lg text-sm">
          <span className="font-medium text-primary text-xs">{n.author}:</span>
          <p className="text-text-muted mt-0.5 text-xs leading-relaxed">{n.note}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Combined Stats View ─────────────────────────────────────────────

interface SessionStatsViewProps {
  stats: SessionStats
  questions: Question[]
  submissions: SessionSubmission[]
}

export function SessionStatsView({ stats, questions, submissions }: SessionStatsViewProps) {
  const { t } = useLanguage()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll = () => {
    if (expandedIds.size === questions.length) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(questions.map(q => q.id)))
    }
  }

  return (
    <div className="space-y-6">
      <PassRateChart stats={stats} />

      {/* Controls */}
      {questions.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={expandAll}
            className="text-xs text-text-muted hover:text-primary transition-colors cursor-pointer"
          >
            {expandedIds.size === questions.length ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const qs = stats.questionStats.find(s => s.questionId === q.id)
          if (!qs) return null
          const expanded = expandedIds.has(q.id)

          return (
            <div key={q.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              {/* Question header — always visible */}
              <button
                onClick={() => toggle(q.id)}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <span className="shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{t(q.stem)}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {q.type === 'pick' ? `Pick ${(q as PickQuestion).options.filter(o => o.correct).length} of ${(q as PickQuestion).options.length}` : `${(q as CategoryQuestion).statements.length} statements → ${(q as CategoryQuestion).categories.length} categories`}
                    {' · '}Median: {formatTime(qs.timePercentiles.p50)}
                  </p>
                </div>
                <span className="shrink-0 mt-1 text-text-muted">
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {/* Expanded details */}
              {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
                  {/* Answer distribution */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted mb-2">{t(labels.sessionAnswerDistribution)}</h4>
                    {q.type === 'pick' ? (
                      <PickDistribution questionStats={qs} question={q as PickQuestion} />
                    ) : (
                      <CategoryDistribution questionStats={qs} question={q as CategoryQuestion} />
                    )}
                  </div>

                  {/* Time percentile box plot */}
                  <TimePercentileChart questionStats={qs} />

                  {/* Notes for this question */}
                  <QuestionNotes questionId={q.id} submissions={submissions} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
