import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useExam } from "../context/ExamContext";
import { useLocation } from "wouter";
import { PageLayout } from "../components/PageLayout";
import {
  ReviewResultItem,
  type ReviewStatus,
} from "../components/ReviewResultItem";
import { labels } from "../utils/labels";
import { scoreExam, PASS_THRESHOLD } from "../utils/scoring";
import type { PickQuestion, CategoryQuestion } from "../data/schema";
import type {
  PickQuestionResult,
  CategoryQuestionResult,
} from "../utils/scoring";
import {
  RotateCcw,
  Home,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Trophy,
  TrendingUp,
  Clock,
  Printer,
  StickyNote,
  ExternalLink,
} from "lucide-react";
import { Footer } from "../components/Footer";
import {
  submitToLeaderboard,
  fetchAuthStatus,
  getLoginUrl,
  extractTokenFromUrl,
  type AuthStatus,
} from "../utils/leaderboard";
import confetti from "canvas-confetti";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ResultsPage() {
  const { t } = useLanguage();
  const {
    questions,
    answers,
    examFinished,
    resetExam,
    elapsedMs,
    questionTimes,
    questionNotes,
    questionsCommitSha,
    stateRestored,
  } = useExam();
  const [, navigate] = useLocation();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const result = useMemo(
    () => scoreExam(questions, answers),
    [questions, answers],
  );

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Extract token from URL (after OAuth redirect) and check auth status
  useEffect(() => {
    extractTokenFromUrl();
    fetchAuthStatus()
      .then(setAuthStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Wait for state to be restored from localStorage before checking
    if (stateRestored && !examFinished) {
      navigate("/");
    }
  }, [stateRestored, examFinished, navigate]);

  // Confetti for passing
  useEffect(() => {
    if (result.passed) {
      const duration = 3000;
      const end = Date.now() + duration;
      const colors = ["#1e40af", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [result.passed]);

  if (!examFinished) return null;

  const handleRetry = () => {
    resetExam();
    navigate("/question/1");
  };

  return (
    <PageLayout headerClassName="print:hidden">
      <main
        id="main-content"
        className="flex-1 max-w-3xl mx-auto w-full px-4 py-8"
      >
        <div className="page-enter">
          {/* Result banner */}
          <div
            className={`text-center p-8 rounded-2xl mb-8 ${
              result.passed
                ? "bg-linear-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/20"
                : "bg-linear-to-br from-red-500/10 to-orange-500/10 border-2 border-red-500/20"
            }`}
          >
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                result.passed ? "bg-green-500/20" : "bg-red-500/20"
              }`}
            >
              {result.passed ? (
                <Trophy
                  className="text-green-600 dark:text-green-400"
                  size={40}
                />
              ) : (
                <TrendingUp
                  className="text-red-600 dark:text-red-400"
                  size={40}
                />
              )}
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
              {t(result.passed ? labels.passed : labels.failed)}
            </h1>
            <p className="text-text-muted text-lg">
              {t(labels.yourScore)}: {result.totalScore.toFixed(1)} /{" "}
              {result.totalPossible} ({(result.percentage * 100).toFixed(1)}%)
            </p>
          </div>

          {/* Score details */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
            <div className="bg-surface border-2 border-border rounded-xl p-3 sm:p-4 text-center overflow-hidden min-w-0 flex flex-col justify-between">
              <p className="text-[11px] sm:text-sm text-text-muted mb-1 wrap-break-word">
                {t(labels.totalScore)}
              </p>
              <p className="text-2xl sm:text-3xl font-heading font-bold mt-auto">
                {result.totalScore.toFixed(1)}
                <span className="text-base sm:text-lg text-text-muted">
                  /{result.totalPossible}
                </span>
              </p>
            </div>
            <div className="bg-surface border-2 border-border rounded-xl p-3 sm:p-4 text-center overflow-hidden min-w-0 flex flex-col justify-between">
              <p className="text-[11px] sm:text-sm text-text-muted mb-1 wrap-break-word">
                {t(labels.passThreshold)}
              </p>
              <p className="text-2xl sm:text-3xl font-heading font-bold mt-auto">
                {Math.round(PASS_THRESHOLD * 100)}%
              </p>
            </div>
            <div className="bg-surface border-2 border-border rounded-xl p-3 sm:p-4 text-center overflow-hidden min-w-0 flex flex-col justify-between">
              <p className="text-[11px] sm:text-sm text-text-muted mb-1 wrap-break-word">
                {t(labels.timeTaken)}
              </p>
              <p className="text-2xl sm:text-3xl font-heading font-bold mt-auto">
                {elapsedMs ? formatElapsed(elapsedMs) : "—"}
              </p>
            </div>
          </div>

          {/* Score bar */}
          <div className="mb-8 bg-surface border-2 border-border rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-muted">0</span>
              <span className="text-text-muted">{result.totalPossible}</span>
            </div>
            <div className="relative h-4 bg-surface-alt rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  result.passed ? "bg-green-500" : "bg-red-500"
                }`}
                style={{ width: `${result.percentage * 100}%` }}
              />
              {/* Pass threshold marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-text"
                style={{ left: `${PASS_THRESHOLD * 100}%` }}
              />
            </div>
            <div className="text-xs mt-1 font-medium">
              {(result.percentage * 100).toFixed(1)}%
            </div>
          </div>

          {/* Per-question time breakdown */}
          {Object.keys(questionTimes).length > 0 && (
            <details className="mb-8 bg-surface border-2 border-border rounded-xl group print:hidden">
              <summary className="flex items-center gap-2 p-4 cursor-pointer select-none text-sm font-semibold text-text-muted list-none [&::-webkit-details-marker]:hidden">
                <Clock size={14} className="shrink-0" />
                {t(labels.timePerQuestion)}
                <svg
                  className="ml-auto w-4 h-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div className="px-4 pb-4">
                <p className="text-xs text-text-muted mb-3 leading-relaxed">
                  {t(labels.timePerQuestionHint)}
                </p>
                <div className="space-y-1.5">
                  {questions.map((q, i) => {
                    const timeMs = questionTimes[q.id] ?? 0;
                    const maxTimeMs = Math.max(
                      ...Object.values(questionTimes),
                      1,
                    );
                    const barPercent = (timeMs / maxTimeMs) * 100;
                    const isLong =
                      timeMs > ((elapsedMs ?? 0) / questions.length) * 1.5; // > 1.5x average
                    return (
                      <div
                        key={q.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-6 text-right font-mono text-text-muted shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 h-4 bg-surface-alt rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              isLong ? "bg-amber-500" : "bg-primary-light"
                            }`}
                            style={{ width: `${barPercent}%` }}
                          />
                        </div>
                        <span
                          className={`w-12 text-right font-mono shrink-0 ${
                            isLong
                              ? "text-amber-500 font-semibold"
                              : "text-text-muted"
                          }`}
                        >
                          {formatElapsed(timeMs)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 print:hidden">
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-primary text-white hover:bg-primary-dark transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer"
            >
              <RotateCcw size={16} />
              {t(labels.retryExam)}
            </button>
            <button
              onClick={() => {
                resetExam();
                navigate("/");
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer"
            >
              <Home size={16} />
              {t(labels.backToStart)}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer"
              title={t(labels.exportResults)}
            >
              <Printer size={16} />
              <span className="hidden sm:inline">
                {t(labels.exportResults)}
              </span>
            </button>
          </div>

          {/* Leaderboard buttons */}
          <div className="flex flex-col gap-3 mb-10 print:hidden">
            {submitted ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border-2 border-green-500/30 text-sm font-medium text-green-700 dark:text-green-400 sm:flex-1 sm:min-w-0">
                  <CheckCircle2 size={16} />
                  {t(labels.leaderboardSubmitSuccess)}
                </div>
                <button
                  onClick={() => navigate("/leaderboard")}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer sm:shrink-0 sm:whitespace-nowrap"
                >
                  <Trophy size={16} className="text-amber-500" />
                  {t(labels.viewLeaderboard)}
                </button>
              </div>
            ) : questionsCommitSha ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                {authStatus.authenticated ? (
                  <button
                    onClick={async () => {
                      setSubmitting(true);
                      setSubmitError(null);
                      try {
                        await submitToLeaderboard(
                          questionsCommitSha,
                          answers,
                          elapsedMs ?? 0,
                        );
                        setSubmitted(true);
                      } catch (err) {
                        const msg = (err as Error).message;
                        if (msg === "AUTH_REQUIRED") {
                          setAuthStatus({ authenticated: false });
                        } else {
                          setSubmitError(msg);
                        }
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 hover:bg-amber-500/20 transition-all duration-200 text-sm sm:text-base font-medium text-amber-700 dark:text-amber-400 cursor-pointer disabled:opacity-50 sm:flex-1 sm:min-w-0"
                  >
                    <Trophy size={16} className="shrink-0" />
                    <span className="truncate">
                      {submitting
                        ? t(labels.leaderboardSubmitting)
                        : t(labels.submitToLeaderboard)}
                    </span>
                  </button>
                ) : (
                  <>
                    <a
                      href={getLoginUrl("github")}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-gray-900/10 dark:bg-white/10 border-2 border-gray-900/20 dark:border-white/20 hover:bg-gray-900/20 dark:hover:bg-white/20 transition-all duration-200 text-sm font-medium sm:flex-1 sm:min-w-0"
                    >
                      <svg
                        className="w-4 h-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span>{t(labels.signInWithGitHub)}</span>
                    </a>
                    <a
                      href={getLoginUrl("google")}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-blue-500/10 border-2 border-blue-500/20 hover:bg-blue-500/20 transition-all duration-200 text-sm font-medium text-blue-700 dark:text-blue-400 sm:flex-1 sm:min-w-0"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span>{t(labels.signInWithGoogle)}</span>
                    </a>
                  </>
                )}
                <button
                  onClick={() => navigate("/leaderboard")}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 text-sm sm:text-base font-medium cursor-pointer sm:shrink-0 sm:whitespace-nowrap"
                >
                  <Trophy size={16} className="text-amber-500" />
                  {t(labels.viewLeaderboard)}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 sm:gap-3">
                <p className="flex-1 min-w-0 text-center text-xs sm:text-sm text-text-muted px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl bg-surface border-2 border-border">
                  {t(labels.leaderboardOfflineWarning)}
                </p>
                <button
                  onClick={() => navigate("/leaderboard")}
                  className="shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 text-xs sm:text-base font-medium cursor-pointer whitespace-nowrap"
                >
                  <Trophy size={16} className="text-amber-500" />
                  {t(labels.viewLeaderboard)}
                </button>
              </div>
            )}
            {submitError && (
              <p className="text-xs text-red-500 text-center">{submitError}</p>
            )}
          </div>

          {/* Questions review - all questions */}
          {result.questionResults.length > 0 && (
            <div>
              <h2 className="font-heading text-xl font-bold mb-4">
                {t(labels.questionsReview)}
              </h2>
              <div className="space-y-4">
                {result.questionResults.map((qr) => {
                  const question = questions.find(
                    (q) => q.id === qr.questionId,
                  )!;
                  const isCorrect = qr.score >= qr.maxPoints;
                  const isPartial = qr.score > 0 && !isCorrect;

                  return (
                    <div
                      key={qr.questionId}
                      className="bg-surface border-2 border-border rounded-xl p-3.5 sm:p-5"
                    >
                      {/* Question header */}
                      <div className="flex items-start gap-2 sm:gap-3 mb-3">
                        <span
                          className={`shrink-0 mt-0.5 ${
                            isCorrect
                              ? "text-green-500"
                              : isPartial
                                ? "text-amber-500"
                                : "text-red-500"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 size={18} />
                          ) : isPartial ? (
                            <MinusCircle size={18} />
                          ) : (
                            <XCircle size={18} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] sm:text-sm font-medium mb-1">
                            {t(question.stem)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {qr.score.toFixed(2)} / {qr.maxPoints}{" "}
                            {t(labels.points)} —{" "}
                            {t(
                              isCorrect
                                ? labels.correct
                                : isPartial
                                  ? labels.partiallyCorrect
                                  : labels.incorrect,
                            )}
                            {questionTimes[qr.questionId] != null && (
                              <span className="ml-2 opacity-60">
                                ⏱ {formatElapsed(questionTimes[qr.questionId])}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Answer details */}
                      {qr.type === "pick" && (
                        <PickReview
                          qr={qr}
                          question={question as PickQuestion}
                        />
                      )}
                      {qr.type === "category" && (
                        <CategoryReview
                          qr={qr}
                          question={question as CategoryQuestion}
                        />
                      )}

                      {/* Explanation */}
                      {question.explanation && t(question.explanation) && (
                        <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-surface-alt text-[13px] sm:text-sm print:hidden">
                          <p className="font-semibold text-xs text-text-muted mb-1">
                            {t(labels.explanation)}
                          </p>
                          <p className="text-text-muted leading-relaxed whitespace-pre-line">
                            {t(question.explanation)}
                          </p>
                        </div>
                      )}

                      {/* User note */}
                      {questionNotes[qr.questionId] && (
                        <div className="mt-3 p-2.5 sm:p-3 rounded-lg border-2 border-amber-500/20 bg-amber-500/5 text-[13px] sm:text-sm">
                          <p className="flex items-center gap-1.5 font-semibold text-xs text-amber-600 dark:text-amber-400 mb-1">
                            <StickyNote size={12} />
                            {t(labels.noteForLecturer)}
                          </p>
                          <p className="text-text-muted leading-relaxed whitespace-pre-line">
                            {questionNotes[qr.questionId]}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <Footer className="mt-8 mb-4" />
      </main>
    </PageLayout>
  );
}

function PickReview({
  qr,
  question,
}: {
  qr: PickQuestionResult;
  question: PickQuestion;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-1 sm:space-y-1.5 mt-1">
      {question.options.map((opt) => {
        const or = qr.optionResults.find((o) => o.id === opt.id)!;

        const status: ReviewStatus =
          or.isCorrect && or.isSelected
            ? "correct"
            : or.isCorrect && !or.isSelected
              ? "missed"
              : or.isSelected && !or.isCorrect
                ? "incorrect"
                : "neutral";

        return (
          <ReviewResultItem
            key={opt.id}
            status={status}
            itemId={opt.id}
            text={t(opt.text)}
          />
        );
      })}
    </div>
  );
}

function CategoryReview({
  qr,
  question,
}: {
  qr: CategoryQuestionResult;
  question: CategoryQuestion;
}) {
  const { t } = useLanguage();
  const categoryMap = Object.fromEntries(
    question.categories.map((c) => [c.label, t(c.text)]),
  );

  return (
    <div className="space-y-1 sm:space-y-1.5 mt-1">
      {question.statements.map((stmt) => {
        const sr = qr.statementResults.find((s) => s.id === stmt.id)!;

        const status: ReviewStatus = sr.isCorrect
          ? "correct"
          : sr.isSkipped
            ? "missed"
            : "incorrect";

        return (
          <ReviewResultItem
            key={stmt.id}
            status={status}
            itemId={stmt.id}
            text={t(stmt.text)}
            secondaryContent={
              <>
                <span
                  className={sr.assignedCategory ? "" : "italic opacity-50"}
                >
                  {sr.assignedCategory ? categoryMap[sr.assignedCategory] : "—"}
                </span>
                <span>→</span>
                <span className="font-medium">
                  {categoryMap[sr.correctCategory]}
                </span>
              </>
            }
          />
        );
      })}
    </div>
  );
}
