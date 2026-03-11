import { describe, it, expect } from 'bun:test'
import { computeActiveElapsed, computeQuestionsHash } from '../src/context/ExamContext'
import type { Question } from '../src/data/schema'

// Minimal question fixtures for testing
const makePickQuestion = (id: string, stemEn: string): Question => ({
  id,
  type: 'pick' as const,
  points: 1,
  stem: { de: stemEn, en: stemEn },
  options: [
    { id: 'A', text: { de: 'Option A', en: 'Option A' }, correct: true },
    { id: 'B', text: { de: 'Option B', en: 'Option B' }, correct: false },
  ],
})

describe('computeActiveElapsed', () => {
  it('returns accumulatedMs when sessionStartedAt is null', () => {
    expect(computeActiveElapsed(5000, null)).toBe(5000)
  })

  it('returns accumulatedMs + session duration when session is active', () => {
    const now = 110_000
    const sessionStart = 100_000
    const accumulated = 30_000
    expect(computeActiveElapsed(accumulated, sessionStart, now)).toBe(40_000)
  })

  it('returns 0 for fresh exam with no accumulated time', () => {
    const now = 100_000
    expect(computeActiveElapsed(0, now, now)).toBe(0)
  })

  it('accumulates across multiple sessions', () => {
    // Session 1: 10 seconds active
    const session1Accumulated = 10_000

    // Session 2: 5 seconds into current session
    const session2Start = 200_000
    const now = 205_000
    expect(computeActiveElapsed(session1Accumulated, session2Start, now)).toBe(15_000)
  })
})

describe('computeQuestionsHash', () => {
  it('returns the same hash for identical questions', () => {
    const questions = [makePickQuestion('q1', 'What is X?')]
    expect(computeQuestionsHash(questions)).toBe(computeQuestionsHash(questions))
  })

  it('returns a different hash when question text changes', () => {
    const q1 = [makePickQuestion('q1', 'What is X?')]
    const q2 = [makePickQuestion('q1', 'What is Y?')]
    expect(computeQuestionsHash(q1)).not.toBe(computeQuestionsHash(q2))
  })

  it('returns a different hash when question ID changes', () => {
    const q1 = [makePickQuestion('q1', 'What is X?')]
    const q2 = [makePickQuestion('q2', 'What is X?')]
    expect(computeQuestionsHash(q1)).not.toBe(computeQuestionsHash(q2))
  })

  it('returns a different hash when question count changes', () => {
    const single = [makePickQuestion('q1', 'What is X?')]
    const double = [makePickQuestion('q1', 'What is X?'), makePickQuestion('q2', 'What is Y?')]
    expect(computeQuestionsHash(single)).not.toBe(computeQuestionsHash(double))
  })

  it('returns a different hash when option text changes', () => {
    const q1: Question[] = [{
      id: 'q1',
      type: 'pick',
      points: 1,
      stem: { de: 'Test', en: 'Test' },
      options: [
        { id: 'A', text: { de: 'Original', en: 'Original' }, correct: true },
        { id: 'B', text: { de: 'Option B', en: 'Option B' }, correct: false },
      ],
    }]
    const q2: Question[] = [{
      id: 'q1',
      type: 'pick',
      points: 1,
      stem: { de: 'Test', en: 'Test' },
      options: [
        { id: 'A', text: { de: 'Modified', en: 'Modified' }, correct: true },
        { id: 'B', text: { de: 'Option B', en: 'Option B' }, correct: false },
      ],
    }]
    expect(computeQuestionsHash(q1)).not.toBe(computeQuestionsHash(q2))
  })

  it('returns a different hash when correct answer changes', () => {
    const q1: Question[] = [{
      id: 'q1',
      type: 'pick',
      points: 1,
      stem: { de: 'Test', en: 'Test' },
      options: [
        { id: 'A', text: { de: 'A', en: 'A' }, correct: true },
        { id: 'B', text: { de: 'B', en: 'B' }, correct: false },
      ],
    }]
    const q2: Question[] = [{
      id: 'q1',
      type: 'pick',
      points: 1,
      stem: { de: 'Test', en: 'Test' },
      options: [
        { id: 'A', text: { de: 'A', en: 'A' }, correct: false },
        { id: 'B', text: { de: 'B', en: 'B' }, correct: true },
      ],
    }]
    expect(computeQuestionsHash(q1)).not.toBe(computeQuestionsHash(q2))
  })
})
