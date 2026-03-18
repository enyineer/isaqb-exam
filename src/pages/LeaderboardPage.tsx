import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'wouter'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import { labels } from '../utils/labels'
import { PageLayout } from '../components/PageLayout'
import { Footer } from '../components/Footer'
import { fetchLeaderboard, type LeaderboardEntry } from '../utils/leaderboard'
import {
  Trophy,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Medal,
  Clock,
  ChevronUp,
  ChevronDown,
  RefreshCw,
} from 'lucide-react'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

function formatRelativeTime(timestamp: number, lang: string): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return lang === 'de' ? 'gerade eben' : 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return lang === 'de' ? `vor ${minutes} Min.` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return lang === 'de' ? `vor ${hours} Std.` : `${hours}h ago`
}

type SortField = 'percentage' | 'timeMs' | 'submittedAt'
type SortDirection = 'asc' | 'desc'

export function LeaderboardPage() {
  const { t, lang } = useLanguage()
  const { questionsCommitSha } = useExam()
  const [, navigate] = useLocation()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  const [sortField, setSortField] = useState<SortField>('percentage')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const doFetch = useCallback((forceRefresh = false) => {
    if (!questionsCommitSha) return
    setLoading(true)
    setError(null)

    fetchLeaderboard(questionsCommitSha, forceRefresh)
      .then((result) => {
        setEntries(result.entries)
        setFetchedAt(result.fetchedAt)
      })
      .catch((err) => {
        setError((err as Error).message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [questionsCommitSha])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  const sorted = useMemo(() => {
    const copy = [...entries]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortField === 'percentage') cmp = a.percentage - b.percentage
      else if (sortField === 'timeMs') cmp = a.timeMs - b.timeMs
      else if (sortField === 'submittedAt') cmp = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      return sortDir === 'desc' ? -cmp : cmp
    })
    return copy
  }, [entries, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir(field === 'timeMs' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'desc'
      ? <ChevronDown size={14} className="inline ml-0.5" />
      : <ChevronUp size={14} className="inline ml-0.5" />
  }

  return (
    <PageLayout>
      <main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="page-enter">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <Trophy className="text-amber-500" size={28} />
                <h1 className="font-heading text-2xl sm:text-3xl font-bold">
                  {t(labels.leaderboard)}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fetchedAt && (
                <span className="text-xs text-text-muted hidden sm:inline">
                  {t(labels.lastFetched)} {formatRelativeTime(fetchedAt, lang)}
                </span>
              )}
              <button
                onClick={() => doFetch(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-all text-xs font-medium cursor-pointer disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {t(labels.refetch)}
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-16">
              <Loader2 className="mx-auto mb-3 animate-spin text-primary" size={32} />
              <p className="text-text-muted">{t(labels.leaderboardLoading)}</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-center py-16">
              <AlertTriangle className="mx-auto mb-3 text-red-500" size={32} />
              <p className="text-text-muted">{t(labels.leaderboardError)}</p>
              <p className="text-xs text-text-muted mt-1 opacity-60">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center py-16">
              <Medal className="mx-auto mb-3 text-text-muted opacity-40" size={40} />
              <p className="text-text-muted">{t(labels.leaderboardEmpty)}</p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && sorted.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-xl border-2 border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b-2 border-border text-text-muted">
                    <th className="px-3 py-3 text-center font-semibold w-12">
                      {t(labels.leaderboardRank)}
                    </th>
                    <th className="px-3 py-3 text-left font-semibold">
                      {t(labels.leaderboardUser)}
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">
                      {t(labels.leaderboardScore)}
                    </th>
                    <th
                      className="px-3 py-3 text-right font-semibold cursor-pointer select-none hover:text-text transition-colors"
                      onClick={() => handleSort('percentage')}
                    >
                      {t(labels.leaderboardPercentage)}
                      <SortIcon field="percentage" />
                    </th>
                    <th
                      className="px-3 py-3 text-right font-semibold cursor-pointer select-none hover:text-text transition-colors hidden sm:table-cell"
                      onClick={() => handleSort('timeMs')}
                    >
                      {t(labels.leaderboardTime)}
                      <SortIcon field="timeMs" />
                    </th>
                    <th
                      className="px-3 py-3 text-right font-semibold cursor-pointer select-none hover:text-text transition-colors hidden md:table-cell"
                      onClick={() => handleSort('submittedAt')}
                    >
                      {t(labels.leaderboardDate)}
                      <SortIcon field="submittedAt" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((entry, i) => {
                    const rank = i + 1
                    const isTop3 = rank <= 3
                    return (
                      <tr
                        key={`${entry.id}-${entry.submittedAt}`}
                        className="border-b border-border last:border-b-0 hover:bg-surface-hover/50 transition-colors"
                      >
                        {/* Rank */}
                        <td className="px-3 py-3 text-center">
                          {isTop3 ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              rank === 1 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                : rank === 2 ? 'bg-gray-300/20 text-gray-600 dark:text-gray-400'
                                  : 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                            }`}>
                              {rank}
                            </span>
                          ) : (
                            <span className="text-text-muted font-mono">{rank}</span>
                          )}
                        </td>
                        {/* User */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={entry.avatarUrl}
                              alt=""
                              className="w-6 h-6 rounded-full bg-primary/20"
                              loading="lazy"
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = 'none';
                                const fallback = document.createElement('span');
                                fallback.className = 'w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0';
                                fallback.textContent = entry.displayName.charAt(0).toUpperCase();
                                el.parentElement?.insertBefore(fallback, el);
                              }}
                            />
                            <span className="font-medium truncate max-w-[120px] sm:max-w-none">
                              {entry.displayName}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              entry.passed
                                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                                : 'bg-red-500/15 text-red-600 dark:text-red-400'
                            }`}>
                              {t(entry.passed ? labels.leaderboardPassedBadge : labels.leaderboardFailedBadge)}
                            </span>
                          </div>
                        </td>
                        {/* Score */}
                        <td className="px-3 py-3 text-right font-mono">
                          {entry.score.toFixed(1)}<span className="text-text-muted">/{entry.maxScore}</span>
                        </td>
                        {/* Percentage */}
                        <td className="px-3 py-3 text-right font-mono font-semibold">
                          {entry.percentage.toFixed(1)}%
                        </td>
                        {/* Time */}
                        <td className="px-3 py-3 text-right font-mono text-text-muted hidden sm:table-cell">
                          <Clock size={12} className="inline mr-1 opacity-60" />
                          {formatElapsed(entry.timeMs)}
                        </td>
                        {/* Date */}
                        <td className="px-3 py-3 text-right text-text-muted hidden md:table-cell">
                          {formatDate(entry.submittedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>


            </>
          )}
        </div>
        <Footer className="mt-8 mb-4" />
      </main>
    </PageLayout>
  )
}
