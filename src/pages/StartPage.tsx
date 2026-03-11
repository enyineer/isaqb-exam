import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import { ThemePicker, LanguageToggle } from '../components/ThemePicker'
import { useLocation } from 'wouter'
import { labels } from '../utils/labels'
import { BookOpen, Timer, Trophy, ArrowRight, Info, RefreshCw } from 'lucide-react'
import { PASS_THRESHOLD } from '../utils/scoring'

interface StartPageProps {
  onRefresh: () => void
}

function formatRelativeTime(timestamp: number, lang: string): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return lang === 'de' ? 'gerade eben' : 'just now'
  if (minutes < 60) return lang === 'de' ? `vor ${minutes} Min.` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return lang === 'de' ? `vor ${hours} Std.` : `${hours}h ago`
}

export function StartPage({ onRefresh }: StartPageProps) {
  const { t, lang } = useLanguage()
  const { questions, dataSource, fetchedAt, loading, resetExam } = useExam()
  const [, navigate] = useLocation()

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)

  const handleStart = () => {
    resetExam()
    navigate('/question/1')
  }

  const sourceLabel = dataSource === 'live'
    ? labels.dataSourceLive
    : dataSource === 'cached'
      ? labels.dataSourceCached
      : labels.dataSourceFallback

  const sourceColor = dataSource === 'live'
    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
    : dataSource === 'cached'
      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'

  const dotColor = dataSource === 'live'
    ? 'bg-green-500'
    : dataSource === 'cached'
      ? 'bg-blue-500'
      : 'bg-amber-500'

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-heading font-bold text-lg">iSAQB</span>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemePicker />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full page-enter">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-6 shadow-lg">
              <BookOpen className="text-white" size={32} />
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
              {t(labels.examTitle)}
            </h1>
            <p className="text-text-muted text-lg max-w-md mx-auto leading-relaxed">
              {t(labels.examSubtitle)}
            </p>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-surface border-2 border-border rounded-xl p-4 text-center">
              <BookOpen size={20} className="mx-auto mb-2 text-primary-light" />
              <p className="text-2xl font-heading font-bold">{questions.length}</p>
              <p className="text-xs text-text-muted">{t(labels.totalQuestions)}</p>
            </div>
            <div className="bg-surface border-2 border-border rounded-xl p-4 text-center">
              <Trophy size={20} className="mx-auto mb-2 text-accent" />
              <p className="text-2xl font-heading font-bold">{totalPoints}</p>
              <p className="text-xs text-text-muted">{t(labels.totalPoints)}</p>
            </div>
            <div className="bg-surface border-2 border-border rounded-xl p-4 text-center">
              <Timer size={20} className="mx-auto mb-2 text-success" />
              <p className="text-2xl font-heading font-bold">{Math.round(PASS_THRESHOLD * 100)}%</p>
              <p className="text-xs text-text-muted">{t(labels.passAt)}</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-surface border-2 border-border rounded-xl p-5 mb-8">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              {t(labels.examDescription)}
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-alt text-xs text-text-muted">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>{t(labels.scoringInfo)}</span>
            </div>
          </div>

          {/* Data source indicator + refetch */}
          {dataSource && (
            <div className={`flex items-center justify-between gap-3 text-xs mb-6 px-4 py-2.5 rounded-xl ${sourceColor}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                <span>{t(sourceLabel)}</span>
                {fetchedAt && (
                  <span className="opacity-60">
                    · {t(labels.lastFetched)} {formatRelativeTime(fetchedAt, lang)}
                  </span>
                )}
              </div>
              <button
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-black/20 dark:hover:bg-black/30 transition-all font-medium cursor-pointer disabled:opacity-50"
                aria-label={t(labels.refetch)}
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {t(labels.refetch)}
              </button>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleStart}
            disabled={questions.length === 0}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-heading font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t(labels.startExam)}
            <ArrowRight size={20} />
          </button>

          {/* Keyboard hints — hidden on mobile (irrelevant for touch) */}
          <div className="hidden sm:flex items-center justify-center gap-4 mt-5 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md border border-border bg-surface-alt font-mono text-[10px] shadow-sm">←</kbd>
              <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md border border-border bg-surface-alt font-mono text-[10px] shadow-sm">→</kbd>
              <span className="ml-0.5 opacity-70">{t({ de: 'Navigieren', en: 'Navigate' })}</span>
            </span>
            <span className="w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md border border-border bg-surface-alt font-mono text-[10px] shadow-sm">1</kbd>
              <span className="opacity-40">–</span>
              <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md border border-border bg-surface-alt font-mono text-[10px] shadow-sm">9</kbd>
              <span className="ml-0.5 opacity-70">{t({ de: 'Optionen', en: 'Options' })}</span>
            </span>
          </div>

          {/* Disclaimer */}
          <p className="text-center text-xs text-text-muted mt-6 opacity-50 leading-relaxed max-w-md mx-auto whitespace-pre-line">
            {t(labels.disclaimer)}
          </p>
          <p className="text-center text-xs mt-2 opacity-40">
            <a
              href="https://enking.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-light hover:underline"
            >
              enking.dev
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
