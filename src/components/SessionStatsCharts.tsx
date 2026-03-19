/**
 * Session statistics chart components — pure CSS/SVG, no charting library.
 * All colors use theme CSS variables for dark/light mode compatibility.
 */

import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import type { QuestionStats, SessionStats } from '../data/sessionSchema'
import type { Question } from '../data/schema'

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

// ─── Answer Distribution Chart ───────────────────────────────────────

interface AnswerDistributionChartProps {
  questionStats: QuestionStats
  question: Question
}

export function AnswerDistributionChart({ questionStats, question }: AnswerDistributionChartProps) {
  const { t } = useLanguage()

  if (question.type === 'pick') {
    const options = question.options
    const maxCount = Math.max(1, ...Object.values(questionStats.answerDistribution))

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-text-muted">{t(labels.sessionAnswerDistribution)}</h4>
        {options.map(opt => {
          const count = questionStats.answerDistribution[opt.id] ?? 0
          const pct = (count / maxCount) * 100
          const isCorrect = opt.correct

          return (
            <div key={opt.id} className="flex items-center gap-2 text-sm">
              <div
                className="h-6 rounded-md transition-all duration-300 min-w-[4px]"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: isCorrect ? 'var(--color-success)' : 'var(--theme-primary-light)',
                  opacity: isCorrect ? 1 : 0.5,
                }}
              />
              <span className={`whitespace-nowrap ${isCorrect ? 'font-semibold text-success' : 'text-text-muted'}`}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // Category question — show distribution per statement
  const statements = question.statements
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-muted">{t(labels.sessionAnswerDistribution)}</h4>
      {statements.map(stmt => {
        const dist = questionStats.categoryDistribution[stmt.id] ?? {}
        const totalForStmt = Object.values(dist).reduce((s, c) => s + c, 0) || 1

        return (
          <div key={stmt.id} className="space-y-1">
            <div className="flex gap-1 h-5">
              {question.categories.map(cat => {
                const count = dist[cat.label] ?? 0
                const pct = (count / totalForStmt) * 100
                const isCorrect = cat.label === stmt.correctCategory

                return pct > 0 ? (
                  <div
                    key={cat.label}
                    className="h-full rounded-sm transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      background: isCorrect ? 'var(--color-success)' : 'var(--theme-primary-light)',
                      opacity: isCorrect ? 1 : 0.4,
                    }}
                    title={`${cat.label}: ${count}`}
                  />
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
      <h4 className="text-sm font-semibold text-text-muted">{t(labels.sessionTimePerQuestion)}</h4>
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
        <span>{formatTime(p10)}</span>
        <span className="font-semibold">{formatTime(p50)}</span>
        <span>{formatTime(p90)}</span>
      </div>
    </div>
  )
}

// ─── Combined Stats View ─────────────────────────────────────────────

interface SessionStatsViewProps {
  stats: SessionStats
  questions: Question[]
}

export function SessionStatsView({ stats, questions }: SessionStatsViewProps) {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <PassRateChart stats={stats} />

      <div className="space-y-8">
        {questions.map((q, idx) => {
          const qs = stats.questionStats.find(s => s.questionId === q.id)
          if (!qs) return null

          return (
            <div key={q.id} className="p-4 rounded-xl border border-border bg-surface space-y-4">
              <h3 className="font-heading font-semibold text-sm">
                {t(labels.question)} {idx + 1}
              </h3>
              <AnswerDistributionChart questionStats={qs} question={q} />
              <TimePercentileChart questionStats={qs} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
