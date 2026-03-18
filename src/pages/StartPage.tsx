import { useMemo } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useExam, getSavedExamInfo } from "../context/ExamContext";
import { PageLayout } from "../components/PageLayout";
import { useLocation } from "wouter";
import { labels } from "../utils/labels";
import {
  BookOpen,
  Timer,
  Trophy,
  ArrowRight,
  RefreshCw,
  GraduationCap,
  Play,
  RotateCcw,
  CheckCircle2,
  CirclePlus,
  CircleMinus,
  Shield,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { ExternalLink } from "../components/ExternalLink";
import { Footer } from "../components/Footer";
import { PASS_THRESHOLD } from "../utils/scoring";

interface StartPageProps {
  onRefresh: () => void;
}

function formatRelativeTime(timestamp: number, lang: string): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return lang === "de" ? "gerade eben" : "just now";
  if (minutes < 60)
    return lang === "de" ? `vor ${minutes} Min.` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return lang === "de" ? `vor ${hours} Std.` : `${hours}h ago`;
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function StartPage({ onRefresh }: StartPageProps) {
  const { t, lang } = useLanguage();
  const { questions, dataSource, fetchedAt, loading, resetExam, continueExam } =
    useExam();
  const [, navigate] = useLocation();

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const savedExam = useMemo(() => getSavedExamInfo(questions), [questions]);

  const handleStart = () => {
    resetExam();
    navigate("/question/1");
  };

  const handleContinue = () => {
    continueExam();
    if (savedExam?.examFinished) {
      navigate("/results");
    } else {
      navigate("/question/1");
    }
  };

  const sourceLabel =
    dataSource === "live"
      ? labels.dataSourceLive
      : dataSource === "cached"
        ? labels.dataSourceCached
        : labels.dataSourceFallback;

  const dotColor =
    dataSource === "live"
      ? "bg-green-500"
      : dataSource === "cached"
        ? "bg-blue-500"
        : "bg-amber-500";

  return (
    <PageLayout className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <main
        id="main-content"
        className="relative flex-1 flex items-center justify-center px-4 py-12"
      >
        <div className="max-w-2xl w-full page-enter">
          {/* Hero */}
          <div className="text-center mb-10">
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
            <p className="text-text-muted text-base sm:text-lg max-w-lg mx-auto leading-relaxed mb-2">
              {t(labels.examSubtitle)}
            </p>
            {/* iSAQB attribution — inline */}
            <p className="text-xs text-text-muted/50">
              {t({
                de: "Basierend auf dem Lehrplan der",
                en: "Based on the curriculum by",
              })}{" "}
              <ExternalLink
                href="https://www.isaqb.org/certifications/cpsa-certifications/cpsa-foundation-level/"
                className="text-primary-light/70 hover:text-primary transition-colors hover:underline"
              >
                iSAQB e.V.
              </ExternalLink>
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
            <div className="group relative bg-surface/60 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-5 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 overflow-hidden min-w-0">
              <BookOpen
                size={18}
                className="mx-auto mb-2.5 text-primary-light transition-transform duration-300 group-hover:scale-110"
              />
              <p className="text-2xl sm:text-3xl font-heading font-bold tabular-nums">
                {questions.length}
              </p>
              <p className="text-[11px] sm:text-xs text-text-muted mt-0.5 wrap-break-word">
                {t(labels.totalQuestions)}
              </p>
            </div>
            <div className="group relative bg-surface/60 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-5 text-center transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 overflow-hidden min-w-0">
              <Trophy
                size={18}
                className="mx-auto mb-2.5 text-accent transition-transform duration-300 group-hover:scale-110"
              />
              <p className="text-2xl sm:text-3xl font-heading font-bold tabular-nums">
                {totalPoints}
              </p>
              <p className="text-[11px] sm:text-xs text-text-muted mt-0.5 wrap-break-word">
                {t(labels.totalPoints)}
              </p>
            </div>
            <div className="group relative bg-surface/60 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-5 text-center transition-all duration-300 hover:border-success/30 hover:shadow-lg hover:shadow-success/5 overflow-hidden min-w-0">
              <Timer
                size={18}
                className="mx-auto mb-2.5 text-success transition-transform duration-300 group-hover:scale-110"
              />
              <p className="text-2xl sm:text-3xl font-heading font-bold tabular-nums">
                {Math.round(PASS_THRESHOLD * 100)}%
              </p>
              <p className="text-[11px] sm:text-xs text-text-muted mt-0.5 wrap-break-word">
                {t(labels.passAt)}
              </p>
            </div>
          </div>

          {/* Exam description */}
          <p className="text-sm text-text-muted text-center leading-relaxed mb-4 max-w-md mx-auto">
            {t(labels.examDescription)}
          </p>

          {/* Collapsible scoring details — near CTA for context */}
          <details className="group mb-6">
            <summary className="flex items-center justify-center gap-1.5 text-xs text-text-muted/50 cursor-pointer hover:text-text-muted transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
              <span className="border-b border-dashed border-current">
                {t(labels.scoringToggle)}
              </span>
              <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 4.5L6 7.5L9 4.5" />
              </svg>
            </summary>
            <div className="mt-3 rounded-xl bg-surface/40 border border-border/30 p-4">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { icon: CirclePlus,  color: 'text-success',       title: labels.scoringCorrectTitle, desc: labels.scoringCorrectDesc },
                  { icon: CircleMinus, color: 'text-error',         title: labels.scoringWrongTitle,   desc: labels.scoringWrongDesc },
                  { icon: Shield,      color: 'text-primary-light', title: labels.scoringFloorTitle,   desc: labels.scoringFloorDesc },
                  { icon: Ban,         color: 'text-amber-500',     title: labels.scoringOverTitle,    desc: labels.scoringOverDesc },
                ] as const).map(({ icon: Icon, color, title, desc }) => (
                  <div key={title.en} className="flex items-center gap-2.5">
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-surface/80 border border-border/40 flex items-center justify-center">
                      <Icon size={14} className={color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text leading-none mb-0.5">{t(title)}</p>
                      <p className="text-[11px] text-text-muted leading-tight">{t(desc)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* Continue saved exam or Start new */}
          {savedExam ? (
            <div className="bg-surface/60 backdrop-blur-sm border-2 border-primary/20 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {savedExam.examFinished ? (
                    <CheckCircle2 size={20} className="text-primary-light" />
                  ) : (
                    <Play size={20} className="text-primary-light" />
                  )}
                </div>
                <div>
                  <p className="font-heading font-semibold text-sm">
                    {t(labels.savedExamTitle)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {savedExam.examFinished
                      ? t(labels.savedExamFinished)
                      : `${savedExam.answeredCount} / ${savedExam.totalQuestions} ${t(labels.savedExamProgress)}`}
                    {savedExam.accumulatedMs > 0 && (
                      <span className="ml-1.5 opacity-60">
                        · {formatTimer(savedExam.accumulatedMs)}
                      </span>
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
                    <>
                      {t(labels.viewResults)} <ArrowRight size={16} />
                    </>
                  ) : (
                    <>
                      {t(labels.continueExam)} <ArrowRight size={16} />
                    </>
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
            <div className="relative group mb-6">
              {/* Glow effect behind button */}
              <div className="absolute -inset-1 rounded-2xl bg-linear-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
              <button
                onClick={handleStart}
                disabled={questions.length === 0}
                className="relative w-full flex items-center justify-center gap-3 px-8 py-4 bg-linear-to-r from-primary to-primary-dark text-white rounded-2xl font-heading font-semibold text-lg transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {t(labels.startExam)}
                <ArrowRight
                  size={20}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </button>
            </div>
          )}

          {/* Secondary actions row */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => navigate('/leaderboard')}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors cursor-pointer"
            >
              <Trophy size={13} />
              {t(labels.viewLeaderboard)}
            </button>
          </div>

          {/* Keyboard hints — hidden on mobile */}
          <div className="hidden sm:flex items-center justify-center gap-4 mb-6 text-[11px] text-text-muted/50">
            <span className="flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border border-border/50 bg-surface-alt/50 font-mono text-[9px]">
                ←
              </kbd>
              <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border border-border/50 bg-surface-alt/50 font-mono text-[9px]">
                →
              </kbd>
              <span className="opacity-70">
                {t({ de: "Navigieren", en: "Navigate" })}
              </span>
            </span>
            <span className="w-px h-3 bg-border/30" />
            <span className="flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border border-border/50 bg-surface-alt/50 font-mono text-[9px]">
                1
              </kbd>
              <span className="opacity-40">–</span>
              <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border border-border/50 bg-surface-alt/50 font-mono text-[9px]">
                9
              </kbd>
              <span className="opacity-70">
                {t({ de: "Optionen", en: "Options" })}
              </span>
            </span>
          </div>



          {/* Data source — minimal pill */}
          {dataSource && (
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted/40">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                <span>{t(sourceLabel)}</span>
                {fetchedAt && (
                  <span className="opacity-60">
                    · {formatRelativeTime(fetchedAt, lang)}
                  </span>
                )}
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className="ml-1 p-1 rounded-md hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40"
                  aria-label={t(labels.refetch)}
                >
                  <RefreshCw
                    size={10}
                    className={loading ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </div>
          )}

          <Footer className="mt-4" />
        </div>
      </main>
    </PageLayout>
  );
}
