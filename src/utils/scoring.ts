import type { PickQuestion, CategoryQuestion, Question } from '../data/schema'

export const PASS_THRESHOLD = 0.6

export interface OptionResult {
  id: string
  isSelected: boolean
  isCorrect: boolean
  pointsDelta: number
}

export interface PickQuestionResult {
  questionId: string
  type: 'pick'
  score: number
  maxPoints: number
  rawScore: number
  optionResults: OptionResult[]
  correctCount: number
}

export interface StatementResult {
  id: string
  assignedCategory: string | undefined
  correctCategory: string
  isCorrect: boolean
  pointsDelta: number
}

export interface CategoryQuestionResult {
  questionId: string
  type: 'category'
  score: number
  maxPoints: number
  rawScore: number
  statementResults: StatementResult[]
}

export type QuestionResult = PickQuestionResult | CategoryQuestionResult

export interface ExamResult {
  totalScore: number
  totalPossible: number
  percentage: number
  passed: boolean
  questionResults: QuestionResult[]
}

export function scorePickQuestion(question: PickQuestion, selectedIds: string[]): PickQuestionResult {
  const correctOptions = question.options.filter(o => o.correct)
  const correctCount = correctOptions.length
  const pointsPerCorrect = question.points / correctCount
  const tooManySelected = selectedIds.length > correctCount

  let rawScore = 0
  const optionResults: OptionResult[] = question.options.map(option => {
    const isSelected = selectedIds.includes(option.id)
    const isCorrect = option.correct
    let pointsDelta = 0

    if (isSelected) {
      pointsDelta = isCorrect ? pointsPerCorrect : -pointsPerCorrect
      rawScore += pointsDelta
    }

    return { id: option.id, isSelected, isCorrect, pointsDelta: isSelected ? pointsDelta : 0 }
  })

  // Selecting more options than correct answers always results in 0 points
  const finalScore = tooManySelected ? 0 : Math.max(0, rawScore)

  return {
    questionId: question.id,
    type: 'pick',
    score: finalScore,
    maxPoints: question.points,
    rawScore,
    optionResults,
    correctCount,
  }
}

export function scoreCategoryQuestion(
  question: CategoryQuestion,
  assignments: Record<string, string>
): CategoryQuestionResult {
  const statementsCount = question.statements.length
  const pointsPerStatement = question.points / statementsCount

  let rawScore = 0
  const statementResults: StatementResult[] = question.statements.map(stmt => {
    const assignedCategory = assignments[stmt.id]
    const isCorrect = assignedCategory === stmt.correctCategory
    const pointsDelta = assignedCategory != null
      ? (isCorrect ? pointsPerStatement : -pointsPerStatement)
      : 0

    rawScore += pointsDelta

    return {
      id: stmt.id,
      assignedCategory,
      correctCategory: stmt.correctCategory,
      isCorrect,
      pointsDelta,
    }
  })

  return {
    questionId: question.id,
    type: 'category',
    score: Math.max(0, rawScore),
    maxPoints: question.points,
    rawScore,
    statementResults,
  }
}

export type PickAnswers = Record<string, string[]>
export type CategoryAnswers = Record<string, Record<string, string>>
export type Answers = Record<string, string[] | Record<string, string>>

export function scoreExam(questions: Question[], answers: Answers): ExamResult {
  let totalScore = 0
  let totalPossible = 0

  const questionResults: QuestionResult[] = questions.map(q => {
    totalPossible += q.points
    const answer = answers[q.id]

    if (q.type === 'pick') {
      const selectedIds = Array.isArray(answer) ? answer : []
      const result = scorePickQuestion(q, selectedIds)
      totalScore += result.score
      return result
    } else {
      const assignments = (answer && typeof answer === 'object' && !Array.isArray(answer))
        ? answer as Record<string, string>
        : {}
      const result = scoreCategoryQuestion(q, assignments)
      totalScore += result.score
      return result
    }
  })

  const percentage = totalPossible > 0 ? totalScore / totalPossible : 0

  return {
    totalScore,
    totalPossible,
    percentage,
    passed: percentage >= PASS_THRESHOLD,
    questionResults,
  }
}
