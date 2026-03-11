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

function answersReducer(state: Answers, action: AnswerAction): Answers {
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
  loading: boolean
  setLoading: (l: boolean) => void
  answers: Answers
  togglePickAnswer: (questionId: string, optionId: string) => void
  setCategoryAnswer: (questionId: string, statementId: string, categoryLabel: string) => void
  resetExam: () => void
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
}

const ExamContext = createContext<ExamContextValue | null>(null)

export function ExamProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [dataSource, setDataSource] = useState<DataSource>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, dispatch] = useReducer(answersReducer, {})
  const [examFinished, setExamFinished] = useState(false)
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [questionTimes, setQuestionTimes] = useState<QuestionTimes>({})
  const [shuffleSeed, setShuffleSeed] = useState(() => Date.now())

  // Ref-based tracking for the currently viewed question
  const activeQuestionRef = useRef<string | null>(null)
  const questionEnteredAtRef = useRef<number | null>(null)
  const hasRestoredRef = useRef(false)

  // Restore persisted state when questions load
  useEffect(() => {
    if (questions.length === 0 || hasRestoredRef.current) return
    hasRestoredRef.current = true
    const hash = computeQuestionsHash(questions)
    const persisted = loadPersistedState(hash)
    if (persisted) {
      dispatch({ type: 'RESTORE', answers: persisted.answers })
      setAccumulatedMs(persisted.accumulatedMs)
      setExamFinished(persisted.examFinished)
      setElapsedMs(persisted.elapsedMs)
      setQuestionTimes(persisted.questionTimes)
      setShuffleSeed(persisted.shuffleSeed)
      // Start a new session from the accumulated time if exam is still in progress
      if (!persisted.examFinished) {
        setSessionStartedAt(Date.now())
      }
    }
  }, [questions])

  // Persist state on changes
  useEffect(() => {
    if (questions.length === 0) return
    const hash = computeQuestionsHash(questions)
    persistState({
      questionsHash: hash,
      answers,
      accumulatedMs,
      examFinished,
      elapsedMs,
      questionTimes,
      shuffleSeed,
    })
  }, [questions, answers, accumulatedMs, examFinished, elapsedMs, questionTimes, shuffleSeed])

  // Flush accumulated time before page unload so we don't lose current session time
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStartedAt && !examFinished) {
        const currentSessionTime = Date.now() - sessionStartedAt
        const totalAccumulated = accumulatedMs + currentSessionTime
        // Flush question times too
        const qId = activeQuestionRef.current
        const enteredAt = questionEnteredAtRef.current
        const updatedQTimes = { ...questionTimes }
        if (qId && enteredAt) {
          updatedQTimes[qId] = (updatedQTimes[qId] ?? 0) + (Date.now() - enteredAt)
        }
        const hash = computeQuestionsHash(questions)
        persistState({
          questionsHash: hash,
          answers,
          accumulatedMs: totalAccumulated,
          examFinished,
          elapsedMs,
          questionTimes: updatedQTimes,
          shuffleSeed,
        })
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [sessionStartedAt, accumulatedMs, examFinished, questions, answers, elapsedMs, questionTimes])

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
    activeQuestionRef.current = null
    questionEnteredAtRef.current = null
  }, [])

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
      loading, setLoading,
      answers,
      togglePickAnswer,
      setCategoryAnswer,
      resetExam,
      finishExam,
      examFinished,
      elapsedMs,
      accumulatedMs,
      sessionStartedAt,
      onQuestionEnter,
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
