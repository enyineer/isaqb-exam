import { useMemo } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useExam, getSavedExamInfo } from '../context/ExamContext'
import { ThemePicker, LanguageToggle } from '../components/ThemePicker'
import { useLocation } from 'wouter'
import { labels } from '../utils/labels'
import { BookOpen, Timer, Trophy, ArrowRight, Info, RefreshCw, GraduationCap, Play, RotateCcw, CheckCircle2 } from 'lucide-react'
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

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function StartPage({ onRefresh }: StartPageProps) {
  const { t, lang } = useLanguage()
  const { questions, dataSource, fetchedAt, loading, resetExam, continueExam } = useExam()
  const [, navigate] = useLocation()

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)
  const savedExam = useMemo(() => getSavedExamInfo(questions), [questions])

  const handleStart = () => {
    resetExam()
    navigate('/question/1')
  }

  const handleContinue = () => {
    continueExam()
    if (savedExam?.examFinished) {
      navigate('/results')
    } else {
      navigate('/question/1')
    }
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
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

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
      <main id="main-content" className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full page-enter">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6">
              {/* Glow behind icon */}
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl scale-150" />
              <div className="relative w-20 h-20 rounded-2xl bg-linear-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg">
                <GraduationCap className="text-white" size={36} />
              </div>
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
              {t(labels.examTitle)}
            </h1>
            <p className="text-text-muted text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
              {t(labels.examSubtitle)}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="group relative bg-surface/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <BookOpen size={18} className="mx-auto mb-2.5 text-primary-light transition-transform duration-300 group-hover:scale-110" />
              <p className="text-3xl font-heading font-bold tabular-nums">{questions.length}</p>
              <p className="text-xs text-text-muted mt-0.5">{t(labels.totalQuestions)}</p>
            </div>
            <div className="group relative bg-surface/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 text-center transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
              <Trophy size={18} className="mx-auto mb-2.5 text-accent transition-transform duration-300 group-hover:scale-110" />
              <p className="text-3xl font-heading font-bold tabular-nums">{totalPoints}</p>
              <p className="text-xs text-text-muted mt-0.5">{t(labels.totalPoints)}</p>
            </div>
            <div className="group relative bg-surface/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 text-center transition-all duration-300 hover:border-success/30 hover:shadow-lg hover:shadow-success/5">
              <Timer size={18} className="mx-auto mb-2.5 text-success transition-transform duration-300 group-hover:scale-110" />
              <p className="text-3xl font-heading font-bold tabular-nums">{Math.round(PASS_THRESHOLD * 100)}%</p>
              <p className="text-xs text-text-muted mt-0.5">{t(labels.passAt)}</p>
            </div>
          </div>

          {/* Info block */}
          <div className="bg-surface/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 mb-8">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              {t(labels.examDescription)}
            </p>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs text-text-muted">
              <Info size={14} className="shrink-0 mt-0.5 text-primary-light" />
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

          {/* Continue saved exam or Start new */}
          {savedExam ? (
            <div className="bg-surface/60 backdrop-blur-sm border-2 border-primary/20 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {savedExam.examFinished
                    ? <CheckCircle2 size={20} className="text-primary-light" />
                    : <Play size={20} className="text-primary-light" />
                  }
                </div>
                <div>
                  <p className="font-heading font-semibold text-sm">{t(labels.savedExamTitle)}</p>
                  <p className="text-xs text-text-muted">
                    {savedExam.examFinished
                      ? t(labels.savedExamFinished)
                      : `${savedExam.answeredCount} / ${savedExam.totalQuestions} ${t(labels.savedExamProgress)}`
                    }
                    {savedExam.accumulatedMs > 0 && (
                      <span className="ml-1.5 opacity-60">· {formatTimer(savedExam.accumulatedMs)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleContinue}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-medium transition-all duration-200 hover:bg-primary-dark cursor-pointer"
                >
                  {savedExam.examFinished ? (
                    <>{t(labels.viewResults)} <ArrowRight size={16} /></>
                  ) : (
                    <>{t(labels.continueExam)} <ArrowRight size={16} /></>
                  )}
                </button>
                <button
                  onClick={handleStart}
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-border bg-surface rounded-xl font-medium transition-all duration-200 hover:bg-surface-hover cursor-pointer"
                >
                  <RotateCcw size={16} />
                  {t(labels.newExam)}
                </button>
              </div>
            </div>
          ) : (
            /* CTA */
            <div className="relative group">
              {/* Glow effect behind button */}
              <div className="absolute -inset-1 rounded-2xl bg-linear-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
              <button
                onClick={handleStart}
                disabled={questions.length === 0}
                className="relative w-full flex items-center justify-center gap-3 px-8 py-4 bg-linear-to-r from-primary to-primary-dark text-white rounded-2xl font-heading font-semibold text-lg transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {t(labels.startExam)}
                <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          )}

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
          <p className="text-center text-xs text-text-muted mt-8 opacity-50 leading-relaxed max-w-md mx-auto whitespace-pre-line">
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
