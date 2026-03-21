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

/** Returns a CSS color that scales from red (score=0) to neutral text (score=max). */
function scoreColor(score: number, maxPoints: number): string {
  const ratio = maxPoints > 0 ? Math.min(score / maxPoints, 1) : 0
  // Interpolate: 0 → hsl(0, 80%, 55%) (red), 1 → inherit (no override)
  if (ratio >= 1) return 'var(--theme-text)'
  // Red at 0%, transitioning via saturation/lightness fade toward neutral
  const saturation = Math.round(80 - ratio * 60) // 80% → 20%
  const lightness = Math.round(55 + ratio * 15)   // 55% → 70%
  return `hsl(0 ${saturation}% ${lightness}%)`
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

function PickDistribution({ questionStats, question, totalSubmissions }: { questionStats: QuestionStats; question: PickQuestion; totalSubmissions: number }) {
  const { t } = useLanguage()
  const total = Math.max(totalSubmissions, 1)

  return (
    <div className="space-y-2">
      {question.options.map(opt => {
        const count = questionStats.answerDistribution[opt.id] ?? 0
        const pct = (count / total) * 100
        const isCorrect = opt.correct

        return (
          <div key={opt.id} className="group">
            <div className="flex items-start gap-2 mb-1">
              <span className={`shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold ${isCorrect ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-surface-alt text-text-muted/50'}`}>
                {isCorrect ? '✓' : ''}
              </span>
              <span className={`flex-1 text-xs leading-relaxed ${isCorrect ? 'font-medium' : 'text-text-muted'}`}>
                {t(opt.text)}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-6">
              <div className="flex-1 h-5 bg-surface-alt rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1.5"
                  style={{
                    width: `${Math.max(pct, pct > 0 ? 8 : 0)}%`,
                    background: isCorrect ? 'var(--color-success)' : 'var(--color-error)',
                    opacity: isCorrect ? 0.7 : 0.35,
                  }}
                >
                  {pct >= 15 && (
                    <span className="text-[10px] font-semibold text-white/90">{Math.round(pct)}%</span>
                  )}
                </div>
              </div>
              <span className={`shrink-0 w-12 text-right text-xs tabular-nums ${isCorrect ? 'font-semibold text-success' : 'text-text-muted'}`}>
                {count}/{total}
              </span>
            </div>
          </div>
        )
      })}
      {questionStats.invalidCount > 0 && (
        <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
          <span className="font-semibold">{questionStats.invalidCount}</span>
          <span>{questionStats.invalidCount === 1 ? 'participant' : 'participants'} selected too many options (invalid, 0 points)</span>
        </div>
      )}
    </div>
  )
}

// ─── Answer Distribution Chart (Category) ────────────────────────────

function CategoryDistribution({ questionStats, question, totalSubmissions }: { questionStats: QuestionStats; question: CategoryQuestion; totalSubmissions: number }) {
  const { t } = useLanguage()
  const total = Math.max(totalSubmissions, 1)

  return (
    <div className="space-y-3">
      {/* Category legend */}
      <div className="flex flex-wrap gap-2">
        {question.categories.map(cat => (
          <span key={cat.label} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-surface-alt text-text-muted">
            {t(cat.text)}
          </span>
        ))}
      </div>

      {/* Statement cards */}
      {question.statements.map(stmt => {
        const dist = questionStats.categoryDistribution[stmt.id] ?? {}

        return (
          <div key={stmt.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            {/* Statement text */}
            <div className="flex items-start gap-2.5 px-3.5 py-2.5">
              <span className="shrink-0 text-[10px] font-bold w-5 h-5 rounded-md bg-surface-alt text-text-muted flex items-center justify-center">
                {stmt.id}
              </span>
              <span className="text-xs leading-relaxed flex-1">{t(stmt.text)}</span>
            </div>

            {/* Category distribution cells */}
            <div className="flex border-t border-border">
              {question.categories.map((cat, catIdx) => {
                const count = dist[cat.label] ?? 0
                const pct = (count / total) * 100
                const isCorrect = cat.label === stmt.correctCategory

                return (
                  <div
                    key={cat.label}
                    className={`flex-1 py-2 text-center transition-all ${catIdx > 0 ? 'border-l border-border' : ''} ${
                      isCorrect ? 'bg-green-500/15' : 'bg-red-500/10'
                    }`}
                  >
                    <div className={`text-sm font-bold tabular-nums ${
                      isCorrect
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-500/80 dark:text-red-400/80'
                    }`}>
                      {count}/{total}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {t(cat.text)}
                    </div>
                    {count > 0 && (
                      <div className="text-[9px] text-text-muted/60 tabular-nums">
                        {Math.round(pct)}%
                      </div>
                    )}
                  </div>
                )
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
          const hasNotes = submissions.some(s => s.questionNotes[q.id]?.trim())

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
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                    <span>{t(labels.sessionAvgScoreLabel)}: <span className="font-semibold tabular-nums" style={{ color: scoreColor(qs.averageScore, q.points) }}>{qs.averageScore.toFixed(2)}</span><span className="text-text-muted">/{q.points}</span></span>
                    <span>{t(labels.sessionMinScoreLabel)}: <span className="font-semibold tabular-nums" style={{ color: scoreColor(qs.minScore, q.points) }}>{qs.minScore.toFixed(2)}</span><span className="text-text-muted">/{q.points}</span></span>
                    {hasNotes && (
                      <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        <StickyNote size={11} />
                      </span>
                    )}
                  </div>
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
                      <PickDistribution questionStats={qs} question={q as PickQuestion} totalSubmissions={stats.totalSubmissions} />
                    ) : (
                      <CategoryDistribution questionStats={qs} question={q as CategoryQuestion} totalSubmissions={stats.totalSubmissions} />
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
