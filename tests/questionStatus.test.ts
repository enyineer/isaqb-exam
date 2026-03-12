import { describe, it, expect } from 'bun:test'
import { getQuestionAnswerStatus } from '../src/utils/questionStatus'
import type { Question } from '../src/data/schema'

// --- Pick question fixtures ---

const pickQuestion: Question = {
  id: 'pick-1',
  type: 'pick',
  points: 2,
  stem: { de: 'Frage', en: 'Question' },
  options: [
    { id: 'A', text: { de: 'A', en: 'A' }, correct: true },
    { id: 'B', text: { de: 'B', en: 'B' }, correct: true },
    { id: 'C', text: { de: 'C', en: 'C' }, correct: false },
    { id: 'D', text: { de: 'D', en: 'D' }, correct: false },
  ],
}

// --- Category question fixtures ---

const categoryQuestion: Question = {
  id: 'cat-1',
  type: 'category',
  points: 3,
  stem: { de: 'Kategorisiere', en: 'Categorize' },
  categories: [
    { label: 'X', text: { de: 'X', en: 'X' } },
    { label: 'Y', text: { de: 'Y', en: 'Y' } },
  ],
  statements: [
    { id: 'S1', text: { de: 'S1', en: 'S1' }, correctCategory: 'X' },
    { id: 'S2', text: { de: 'S2', en: 'S2' }, correctCategory: 'Y' },
    { id: 'S3', text: { de: 'S3', en: 'S3' }, correctCategory: 'X' },
  ],
}

describe('getQuestionAnswerStatus — pick questions', () => {
  it('returns "none" when no answer is provided', () => {
    expect(getQuestionAnswerStatus(pickQuestion, undefined)).toBe('none')
  })

  it('returns "none" when answer is an empty array', () => {
    expect(getQuestionAnswerStatus(pickQuestion, [])).toBe('none')
  })

  it('returns "too-few" when fewer than required options are selected', () => {
    // pickQuestion has 2 correct options, selecting only 1
    expect(getQuestionAnswerStatus(pickQuestion, ['A'])).toBe('too-few')
  })

  it('returns "correct" when exactly the required number of options are selected', () => {
    // pickQuestion has 2 correct options
    expect(getQuestionAnswerStatus(pickQuestion, ['A', 'B'])).toBe('correct')
  })

  it('returns "too-many" when more than the required number of options are selected', () => {
    // pickQuestion has 2 correct, selecting 3
    expect(getQuestionAnswerStatus(pickQuestion, ['A', 'B', 'C'])).toBe('too-many')
  })

  it('returns "correct" regardless of which options were chosen', () => {
    // Selecting 2 wrong options still counts as "correct" count-wise
    expect(getQuestionAnswerStatus(pickQuestion, ['C', 'D'])).toBe('correct')
  })
})

describe('getQuestionAnswerStatus — category questions', () => {
  it('returns "none" when no answer is provided', () => {
    expect(getQuestionAnswerStatus(categoryQuestion, undefined)).toBe('none')
  })

  it('returns "none" when answer is an empty object', () => {
    expect(getQuestionAnswerStatus(categoryQuestion, {})).toBe('none')
  })

  it('returns "too-few" when only some statements are assigned', () => {
    // categoryQuestion has 3 statements, only assigning 1
    expect(getQuestionAnswerStatus(categoryQuestion, { S1: 'X' })).toBe('too-few')
  })

  it('returns "too-few" when most but not all statements are assigned', () => {
    expect(getQuestionAnswerStatus(categoryQuestion, { S1: 'X', S2: 'Y' })).toBe('too-few')
  })

  it('returns "correct" when all statements are assigned', () => {
    expect(getQuestionAnswerStatus(categoryQuestion, { S1: 'X', S2: 'Y', S3: 'X' })).toBe('correct')
  })
})
