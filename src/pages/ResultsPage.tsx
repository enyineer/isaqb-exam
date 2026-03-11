import { useEffect, useMemo } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useExam } from "../context/ExamContext";
import { useLocation } from "wouter";
import { PageLayout } from "../components/PageLayout";
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
} from "lucide-react";
import { ExternalLink } from "../components/ExternalLink";
import { Footer } from "../components/Footer";
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
  } = useExam();
  const [, navigate] = useLocation();

  const result = useMemo(
    () => scoreExam(questions, answers),
    [questions, answers],
  );

  useEffect(() => {
    if (!examFinished) {
      navigate("/");
    }
  }, [examFinished, navigate]);

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
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-surface border-2 border-border rounded-xl p-4 text-center">
              <p className="text-sm text-text-muted mb-1">
                {t(labels.totalScore)}
              </p>
              <p className="text-3xl font-heading font-bold">
                {result.totalScore.toFixed(1)}
                <span className="text-lg text-text-muted">
                  /{result.totalPossible}
                </span>
              </p>
            </div>
            <div className="bg-surface border-2 border-border rounded-xl p-4 text-center">
              <p className="text-sm text-text-muted mb-1">
                {t(labels.passThreshold)}
              </p>
              <p className="text-3xl font-heading font-bold">
                {Math.round(PASS_THRESHOLD * 100)}%
              </p>
            </div>
            <div className="bg-surface border-2 border-border rounded-xl p-4 text-center">
              <p className="text-sm text-text-muted mb-1">
                {t(labels.timeTaken)}
              </p>
              <p className="text-3xl font-heading font-bold">
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
            <div className="mb-8 bg-surface border-2 border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-muted mb-3">
                {t(labels.timePerQuestion)}
              </h3>
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
                    <div key={q.id} className="flex items-center gap-2 text-xs">
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
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mb-10 print:hidden">
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white hover:bg-primary-dark transition-all duration-200 font-medium cursor-pointer"
            >
              <RotateCcw size={16} />
              {t(labels.retryExam)}
            </button>
            <button
              onClick={() => {
                resetExam();
                navigate("/");
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 font-medium cursor-pointer"
            >
              <Home size={16} />
              {t(labels.backToStart)}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 font-medium cursor-pointer"
              title={t(labels.exportResults)}
            >
              <Printer size={16} />
              <span className="hidden sm:inline">
                {t(labels.exportResults)}
              </span>
            </button>
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
                      className="bg-surface border-2 border-border rounded-xl p-5"
                    >
                      {/* Question header */}
                      <div className="flex items-start gap-3 mb-3">
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
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">
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
                        <div className="mt-3 p-3 rounded-lg bg-surface-alt text-sm print:hidden">
                          <p className="font-semibold text-xs text-text-muted mb-1">
                            {t(labels.explanation)}
                          </p>
                          <p className="text-text-muted leading-relaxed whitespace-pre-line">
                            {t(question.explanation)}
                          </p>
                        </div>
                      )}

                      {/* Learn more link */}
                      <ExternalLink
                        href="https://www.isaqb.org/certifications/cpsa-certifications/cpsa-foundation-level/"
                        showIcon
                        className="inline-flex items-center gap-1 mt-3 text-xs text-primary-light hover:underline print:hidden"
                      >
                        {t(labels.learnMore)}
                      </ExternalLink>

                      {/* User note */}
                      {questionNotes[qr.questionId] && (
                        <div className="mt-3 p-3 rounded-lg border-2 border-amber-500/20 bg-amber-500/5 text-sm">
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
    <div className="space-y-1.5 pl-7">
      {question.options.map((opt) => {
        const or = qr.optionResults.find((o) => o.id === opt.id)!;
        const isCorrect = or.isCorrect;
        const isSelected = or.isSelected;

        return (
          <div
            key={opt.id}
            className={`flex items-start gap-2 text-sm px-3 py-1.5 rounded-lg ${
              isCorrect && isSelected
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : isCorrect && !isSelected
                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                  : isSelected && !isCorrect
                    ? "bg-red-500/10 text-red-700 dark:text-red-400"
                    : ""
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {isCorrect && isSelected && <CheckCircle2 size={16} />}
              {isCorrect && !isSelected && <MinusCircle size={16} />}
              {isSelected && !isCorrect && <XCircle size={16} />}
              {!isSelected && !isCorrect && (
                <span className="inline-block w-4" />
              )}
            </span>
            <span className="font-mono text-xs font-bold opacity-50 shrink-0 mt-0.5">
              {opt.id}
            </span>
            <span>{t(opt.text)}</span>
          </div>
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
    <div className="space-y-1.5 pl-7">
      {question.statements.map((stmt) => {
        const sr = qr.statementResults.find((s) => s.id === stmt.id)!;
        return (
          <div
            key={stmt.id}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
              sr.isCorrect
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}
          >
            {sr.isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            <span className="font-mono text-xs font-bold opacity-50">
              {stmt.id}
            </span>
            <span className="flex-1">{t(stmt.text)}</span>
            <span className="text-xs opacity-70">
              {sr.assignedCategory ? categoryMap[sr.assignedCategory] : "—"} →{" "}
              {categoryMap[sr.correctCategory]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
