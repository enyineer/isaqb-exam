import type { Question } from '../data/schema'
import type { Answers } from './scoring'

export type AnswerStatus = 'none' | 'too-few' | 'correct' | 'too-many'

/**
 * Determine the answer completeness status for a single question.
 *
 * - Pick questions: "required" = number of correct options
 * - Category questions: "required" = number of statements (can never be "too-many")
 */
export function getQuestionAnswerStatus(question: Question, answer: Answers[string] | undefined): AnswerStatus {
  if (question.type === 'pick') {
    const selected = Array.isArray(answer) ? answer.length : 0
    const required = question.options.filter(o => o.correct).length

    if (selected === 0) return 'none'
    if (selected < required) return 'too-few'
    if (selected === required) return 'correct'
    return 'too-many'
  }

  // Category question
  const assigned = (answer && typeof answer === 'object' && !Array.isArray(answer))
    ? Object.keys(answer).length
    : 0
  const required = question.statements.length

  if (assigned === 0) return 'none'
  if (assigned < required) return 'too-few'
  // Category questions can't have "too-many" since each statement maps to exactly one category
  return 'correct'
}
