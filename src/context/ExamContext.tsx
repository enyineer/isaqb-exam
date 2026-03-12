import { createContext, useContext, useState, useCallback, useReducer, useRef, useEffect, type ReactNode } from 'react'
import type { Question } from '../data/schema'
import type { Answers } from '../utils/scoring'

const STORAGE_KEY = 'isaqb-exam-state'

interface PersistedState {
  /** Hash of question content — used to invalidate if questions change */
  questionsHash: string
  answers: Answers
  /** Total accumulated active time in ms (excluding current session) */
  accumulatedMs: number
  examFinished: boolean
  elapsedMs: number | null
  questionTimes: QuestionTimes
  /** Seed for deterministic answer shuffling per attempt */
  shuffleSeed: number
  /** Question IDs flagged for review */
  flaggedQuestions: string[]
  /** User notes per question */
  questionNotes: Record<string, string>
}

/** djb2 hash — fast and sufficient for cache invalidation */
export function computeQuestionsHash(questions: Question[]): string {
  const content = JSON.stringify(questions)
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

function loadPersistedState(questionsHash: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (parsed.questionsHash !== questionsHash) return null
    return parsed
  } catch {
    return null
  }
}

export interface SavedExamInfo {
  examFinished: boolean
  answeredCount: number
  totalQuestions: number
  accumulatedMs: number
}

/** Check if there's a saved exam matching the current questions (without restoring it) */
export function getSavedExamInfo(questions: Question[]): SavedExamInfo | null {
  if (questions.length === 0) return null
  const hash = computeQuestionsHash(questions)
  const persisted = loadPersistedState(hash)
  if (!persisted) return null
  const answeredCount = Object.keys(persisted.answers).length
  if (answeredCount === 0 && !persisted.examFinished) return null
  return {
    examFinished: persisted.examFinished,
    answeredCount,
    totalQuestions: questions.length,
    accumulatedMs: persisted.accumulatedMs,
  }
}

function persistState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

type AnswerAction =
  | { type: 'SET_PICK_ANSWER'; questionId: string; optionId: string }
  | { type: 'SET_CATEGORY_ANSWER'; questionId: string; statementId: string; categoryLabel: string }
  | { type: 'RESET' }
  | { type: 'RESTORE'; answers: Answers }

export function answersReducer(state: Answers, action: AnswerAction): Answers {
  switch (action.type) {
    case 'SET_PICK_ANSWER': {
      const current = (state[action.questionId] as string[]) || []
      const next = current.includes(action.optionId)
        ? current.filter(id => id !== action.optionId)
        : [...current, action.optionId]
      return { ...state, [action.questionId]: next }
    }
    case 'SET_CATEGORY_ANSWER': {
      const current = (state[action.questionId] as Record<string, string>) || {}
      if (current[action.statementId] === action.categoryLabel) {
        const { [action.statementId]: _, ...rest } = current
        return { ...state, [action.questionId]: rest }
      }
      return {
        ...state,
        [action.questionId]: { ...current, [action.statementId]: action.categoryLabel },
      }
    }
    case 'RESET':
      return {}
    case 'RESTORE':
      return action.answers
    default:
      return state
  }
}

export type DataSource = 'live' | 'fallback' | 'cached' | null

/** Accumulated time per question (in ms) */
export type QuestionTimes = Record<string, number>

/**
 * Computes the current elapsed active time.
 * accumulatedMs = time from previous sessions
 * sessionStartedAt = when the current browser session started (null if not in exam)
 * now = current timestamp (defaults to Date.now())
 */
export function computeActiveElapsed(
  accumulatedMs: number,
  sessionStartedAt: number | null,
  now: number = Date.now(),
): number {
  if (sessionStartedAt === null) return accumulatedMs
  return accumulatedMs + (now - sessionStartedAt)
}

interface ExamContextValue {
  questions: Question[]
  setQuestions: (q: Question[]) => void
  dataSource: DataSource
  setDataSource: (s: DataSource) => void
  fetchedAt: number | null
  setFetchedAt: (t: number | null) => void
  /** Commit SHA of the upstream question source (null for fallback) */
  questionsCommitSha: string | null
  setQuestionsCommitSha: (s: string | null) => void
  loading: boolean
  setLoading: (l: boolean) => void
  /** True if question loading was rate-limited by GitHub API */
  questionsRateLimited: boolean
  setQuestionsRateLimited: (r: boolean) => void
  answers: Answers
  togglePickAnswer: (questionId: string, optionId: string) => void
  setCategoryAnswer: (questionId: string, statementId: string, categoryLabel: string) => void
  resetExam: () => void
  /** Restore persisted state and resume (call from StartPage continue button) */
  continueExam: () => void
  finishExam: () => void
  examFinished: boolean
  elapsedMs: number | null
  /** Accumulated active time from previous sessions (used with sessionStartedAt for live timer) */
  accumulatedMs: number
  /** When the current browser session started (null if exam not active) */
  sessionStartedAt: number | null
  /** Call when navigating to a question — flushes time for previous question */
  onQuestionEnter: (questionId: string) => void
  /** Accumulated time per question */
  questionTimes: QuestionTimes
  /** Seed for deterministic answer shuffling (set per attempt) */
  shuffleSeed: number
  /** Question IDs flagged for review */
  flaggedQuestions: Set<string>
  /** Toggle flag on a question */
  toggleFlag: (questionId: string) => void
  /** User notes per question */
  questionNotes: Record<string, string>
  /** Set or clear a note for a question */
  setNote: (questionId: string, note: string) => void
}

const ExamContext = createContext<ExamContextValue | null>(null)

export function ExamProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [dataSource, setDataSource] = useState<DataSource>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [questionsCommitSha, setQuestionsCommitSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [questionsRateLimited, setQuestionsRateLimited] = useState(false)
  const [answers, dispatch] = useReducer(answersReducer, {})
  const [examFinished, setExamFinished] = useState(false)
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [questionTimes, setQuestionTimes] = useState<QuestionTimes>({})
  const [shuffleSeed, setShuffleSeed] = useState(() => Date.now())
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({})

  // Ref-based tracking for the currently viewed question
  const activeQuestionRef = useRef<string | null>(null)
  const questionEnteredAtRef = useRef<number | null>(null)
  /** Set to true after resetExam, continueExam, or auto-restore — prevents persisting the default/empty state on page load */
  const examActiveRef = useRef(false)

  // Auto-restore persisted state when questions load (handles mid-exam page refresh)
  useEffect(() => {
    if (questions.length === 0 || examActiveRef.current) return
    const hash = computeQuestionsHash(questions)
    const persisted = loadPersistedState(hash)
    if (persisted) {
      dispatch({ type: 'RESTORE', answers: persisted.answers })
      setAccumulatedMs(persisted.accumulatedMs)
      setExamFinished(persisted.examFinished)
      setElapsedMs(persisted.elapsedMs)
      setQuestionTimes(persisted.questionTimes)
      setShuffleSeed(persisted.shuffleSeed)
      setFlaggedQuestions(new Set(persisted.flaggedQuestions ?? []))
      setQuestionNotes(persisted.questionNotes ?? {})
      if (!persisted.examFinished) {
        setSessionStartedAt(Date.now())
      }
      examActiveRef.current = true
    }
  }, [questions])

  /** Build the current persisted state snapshot and write it to localStorage */
  const flushToStorage = useCallback((opts?: { includeActiveQuestion?: boolean }) => {
    if (questions.length === 0 || !examActiveRef.current) return
    const totalAccumulatedMs = sessionStartedAt
      ? accumulatedMs + (Date.now() - sessionStartedAt)
      : accumulatedMs
    let finalQuestionTimes = questionTimes
    if (opts?.includeActiveQuestion) {
      const qId = activeQuestionRef.current
      const enteredAt = questionEnteredAtRef.current
      if (qId && enteredAt) {
        finalQuestionTimes = { ...questionTimes, [qId]: (questionTimes[qId] ?? 0) + (Date.now() - enteredAt) }
      }
    }
    persistState({
      questionsHash: computeQuestionsHash(questions),
      answers,
      accumulatedMs: totalAccumulatedMs,
      examFinished,
      elapsedMs,
      questionTimes: finalQuestionTimes,
      shuffleSeed,
      flaggedQuestions: [...flaggedQuestions],
      questionNotes,
    })
  }, [questions, answers, accumulatedMs, sessionStartedAt, examFinished, elapsedMs, questionTimes, shuffleSeed, flaggedQuestions, questionNotes])

  // Persist state on changes (only after exam has been started or continued)
  useEffect(() => { flushToStorage() }, [flushToStorage])

  // Flush including active question time before page unload
  useEffect(() => {
    const handleBeforeUnload = () => flushToStorage({ includeActiveQuestion: true })
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [flushToStorage])

  // Periodically persist timer while the session is active (every 5s)
  useEffect(() => {
    if (!sessionStartedAt || examFinished) return
    const interval = setInterval(() => flushToStorage(), 5_000)
    return () => clearInterval(interval)
  }, [flushToStorage, sessionStartedAt, examFinished])

  /** Flush accumulated time for the currently active question */
  const flushActiveQuestion = useCallback(() => {
    const qId = activeQuestionRef.current
    const enteredAt = questionEnteredAtRef.current
    if (qId && enteredAt) {
      const spent = Date.now() - enteredAt
      setQuestionTimes(prev => ({ ...prev, [qId]: (prev[qId] ?? 0) + spent }))
    }
    activeQuestionRef.current = null
    questionEnteredAtRef.current = null
  }, [])

  const onQuestionEnter = useCallback((questionId: string) => {
    flushActiveQuestion()
    activeQuestionRef.current = questionId
    questionEnteredAtRef.current = Date.now()
  }, [flushActiveQuestion])

  const togglePickAnswer = useCallback((questionId: string, optionId: string) => {
    dispatch({ type: 'SET_PICK_ANSWER', questionId, optionId })
  }, [])

  const setCategoryAnswer = useCallback((questionId: string, statementId: string, categoryLabel: string) => {
    dispatch({ type: 'SET_CATEGORY_ANSWER', questionId, statementId, categoryLabel })
  }, [])

  const resetExam = useCallback(() => {
    dispatch({ type: 'RESET' })
    setExamFinished(false)
    setAccumulatedMs(0)
    setSessionStartedAt(Date.now())
    setElapsedMs(null)
    setQuestionTimes({})
    setShuffleSeed(Date.now())
    setFlaggedQuestions(new Set())
    setQuestionNotes({})
    activeQuestionRef.current = null
    questionEnteredAtRef.current = null
    examActiveRef.current = true
  }, [])

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }, [])

  const setNote = useCallback((questionId: string, note: string) => {
    setQuestionNotes(prev => {
      if (!note.trim()) {
        const { [questionId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [questionId]: note }
    })
  }, [])

  const continueExam = useCallback(() => {
    if (questions.length === 0) return
    const hash = computeQuestionsHash(questions)
    const persisted = loadPersistedState(hash)
    if (!persisted) return
    dispatch({ type: 'RESTORE', answers: persisted.answers })
    setAccumulatedMs(persisted.accumulatedMs)
    setExamFinished(persisted.examFinished)
    setElapsedMs(persisted.elapsedMs)
    setQuestionTimes(persisted.questionTimes)
    setShuffleSeed(persisted.shuffleSeed)
    setFlaggedQuestions(new Set(persisted.flaggedQuestions ?? []))
    setQuestionNotes(persisted.questionNotes ?? {})
    if (!persisted.examFinished) {
      setSessionStartedAt(Date.now())
    }
    examActiveRef.current = true
  }, [questions])

  const finishExam = useCallback(() => {
    flushActiveQuestion()
    setExamFinished(true)
    if (sessionStartedAt) {
      const totalElapsed = accumulatedMs + (Date.now() - sessionStartedAt)
      setElapsedMs(totalElapsed)
      setAccumulatedMs(totalElapsed)
      setSessionStartedAt(null)
    }
  }, [accumulatedMs, sessionStartedAt, flushActiveQuestion])

  return (
    <ExamContext.Provider value={{
      questions, setQuestions,
      dataSource, setDataSource,
      fetchedAt, setFetchedAt,
      questionsCommitSha, setQuestionsCommitSha,
      loading, setLoading,
      questionsRateLimited, setQuestionsRateLimited,
      answers,
      togglePickAnswer,
      setCategoryAnswer,
      resetExam,
      continueExam,
      finishExam,
      examFinished,
      elapsedMs,
      accumulatedMs,
      sessionStartedAt,
      onQuestionEnter,
      flaggedQuestions,
      toggleFlag,
      questionNotes,
      setNote,
      questionTimes,
      shuffleSeed,
    }}>
      {children}
    </ExamContext.Provider>
  )
}

export function useExam() {
  const ctx = useContext(ExamContext)
  if (!ctx) throw new Error('useExam must be inside ExamProvider')
  return ctx
}
