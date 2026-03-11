import { useEffect, useCallback, useRef, useState, useMemo, type RefObject } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useExam, computeActiveElapsed } from '../context/ExamContext'
import { useLocation, useParams } from 'wouter'
import { ThemePicker, LanguageToggle } from '../components/ThemePicker'
import { PickQuestion } from '../components/PickQuestion'
import { CategoryQuestion } from '../components/CategoryQuestion'
import { labels } from '../utils/labels'
import { ChevronLeft, ChevronRight, Flag, Clock } from 'lucide-react'
import { seededShuffle } from '../utils/shuffle'

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function QuestionPage() {
  const { t } = useLanguage()
  const { questions, answers, finishExam, togglePickAnswer, accumulatedMs, sessionStartedAt, onQuestionEnter, shuffleSeed } = useExam()
  const [, navigate] = useLocation()
  const params = useParams<{ number: string }>()
  const questionNumber = parseInt(params.number || '1', 10)
  const questionIndex = questionNumber - 1
  const question = questions[questionIndex]
  const totalQuestions = questions.length

  // Live timer state (updates every second)
  const [elapsed, setElapsed] = useState(() => computeActiveElapsed(accumulatedMs, sessionStartedAt))

  useEffect(() => {
    if (sessionStartedAt === null) return
    setElapsed(computeActiveElapsed(accumulatedMs, sessionStartedAt))
    const interval = setInterval(() => {
      setElapsed(computeActiveElapsed(accumulatedMs, sessionStartedAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [accumulatedMs, sessionStartedAt])

  // Track time on this question
  useEffect(() => {
    if (question) {
      onQuestionEnter(question.id);
    }
  }, [question?.id, onQuestionEnter]);

  // Shuffled options for keyboard handler (must match PickQuestion's shuffle)
  const shuffledOptions = useMemo(
    () => question?.type === 'pick' ? seededShuffle(question.options, shuffleSeed + question.id.length) : [],
    [question, shuffleSeed],
  )
  const shuffledOptionsRef = useRef(shuffledOptions)
  shuffledOptionsRef.current = shuffledOptions

  // Auto-scroll dots to current question
  const dotsContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = dotsContainerRef.current;
    if (!container) return;
    const activeDot = container.children[questionIndex] as
      | HTMLElement
      | undefined;
    activeDot?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [questionIndex]);

  // Keep refs for keyboard handler closures
  const questionRef = useRef(question);
  const toggleRef = useRef(togglePickAnswer);
  questionRef.current = question;
  toggleRef.current = togglePickAnswer;

  const goTo = useCallback(
    (num: number) => {
      if (num >= 1 && num <= totalQuestions) {
        navigate(`/question/${num}`);
      }
    },
    [navigate, totalQuestions],
  );

  const handleFinish = useCallback(() => {
    finishExam();
    navigate("/results");
  }, [finishExam, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(questionNumber - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (questionNumber < totalQuestions) {
          goTo(questionNumber + 1);
        }
      } else if (e.key >= "1" && e.key <= "9") {
        const q = questionRef.current;
        if (q?.type === "pick") {
          const idx = parseInt(e.key) - 1;
          const opts = shuffledOptionsRef.current;
          if (idx < opts.length) {
            toggleRef.current(q.id, opts[idx].id);
          }
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [goTo, questionNumber, totalQuestions]);

  // Focus main on question change
  useEffect(() => {
    document.getElementById("main-content")?.focus();
  }, [questionNumber]);

  if (!question) {
    navigate("/");
    return null;
  }

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (q.type === "pick") return Array.isArray(a) && a.length > 0;
    return (
      a &&
      typeof a === "object" &&
      !Array.isArray(a) &&
      Object.keys(a).length > 0
    );
  }).length;

  const progressPercent = (answeredCount / totalQuestions) * 100;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="font-heading font-bold text-lg hover:text-primary transition-colors cursor-pointer"
            >
              iSAQB
            </button>
            <div className="flex items-center gap-3">
              {/* Live timer */}
              <span className="flex items-center gap-1.5 text-sm text-text-muted font-mono tabular-nums">
                <Clock size={14} />
                {formatTimer(elapsed)}
              </span>
              <span className="text-sm text-text-muted hidden sm:block">
                {t(labels.question)} {questionNumber} {t(labels.of)}{" "}
                {totalQuestions}
              </span>
              <LanguageToggle />
              <ThemePicker />
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 -mx-4 bg-surface-alt">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={answeredCount}
              aria-valuemin={0}
              aria-valuemax={totalQuestions}
            />
          </div>
        </div>
      </header>

      {/* Question content */}
      <main
        id="main-content"
        className="flex-1 max-w-3xl mx-auto w-full px-4 py-8"
        tabIndex={-1}
      >
        {question.type === "pick" ? (
          <PickQuestion
            question={question}
            questionNumber={questionNumber}
            key={question.id}
          />
        ) : (
          <CategoryQuestion
            question={question}
            questionNumber={questionNumber}
            key={question.id}
          />
        )}
      </main>

      {/* Navigation footer */}
      <footer className="sticky bottom-0 bg-bg/80 backdrop-blur-lg border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => goTo(questionNumber - 1)}
            disabled={questionNumber <= 1}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">{t(labels.prevQuestion)}</span>
          </button>

          {/* Question dots */}
          <div
            ref={dotsContainerRef}
            className="flex-1 min-w-0 flex items-center justify-center gap-1 flex-wrap px-1 py-1"
            role="navigation"
            aria-label="Questions"
          >
            {questions.map((q, i) => {
              const isAnswered = (() => {
                const a = answers[q.id];
                if (q.type === "pick") return Array.isArray(a) && a.length > 0;
                return (
                  a &&
                  typeof a === "object" &&
                  !Array.isArray(a) &&
                  Object.keys(a).length > 0
                );
              })();
              const isCurrent = i === questionIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => goTo(i + 1)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
                    isCurrent
                      ? "bg-primary scale-150"
                      : isAnswered
                        ? "bg-primary-light opacity-60"
                        : "bg-border"
                  }`}
                  aria-label={`${t(labels.question)} ${i + 1}${isAnswered ? " ✓" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                />
              );
            })}
          </div>

          {questionNumber < totalQuestions ? (
            <button
              onClick={() => goTo(questionNumber + 1)}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-all duration-200 text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              <span className="hidden sm:inline">{t(labels.nextQuestion)}</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-success text-white hover:opacity-90 transition-all duration-200 text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Flag size={16} />
              <span className="hidden sm:inline">{t(labels.finishExam)}</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
