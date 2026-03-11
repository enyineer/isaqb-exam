import { describe, test, expect } from 'bun:test'
import { scorePickQuestion, scoreCategoryQuestion, scoreExam, PASS_THRESHOLD } from '../src/utils/scoring'
import type { PickQuestion, CategoryQuestion } from '../src/data/schema'
import fallbackQuestions from '../src/data/fallbackQuestions.json'

// ===== Pick Question Scoring =====

describe('scorePickQuestion', () => {
  const singleCorrect: PickQuestion = {
    id: 'Q-TEST-01',
    type: 'pick',
    points: 1,
    stem: { de: 'Test', en: 'Test' },
    options: [
      { id: 'A', text: { de: 'A', en: 'A' }, correct: false },
      { id: 'B', text: { de: 'B', en: 'B' }, correct: true },
      { id: 'C', text: { de: 'C', en: 'C' }, correct: false },
    ],
  }

  test('selecting the single correct answer gives full points', () => {
    const result = scorePickQuestion(singleCorrect, ['B'])
    expect(result.score).toBe(1)
    expect(result.maxPoints).toBe(1)
  })

  test('selecting nothing gives 0 points', () => {
    const result = scorePickQuestion(singleCorrect, [])
    expect(result.score).toBe(0)
  })

  test('selecting only a wrong answer gives 0 (clamped from negative)', () => {
    const result = scorePickQuestion(singleCorrect, ['A'])
    expect(result.score).toBe(0)
    expect(result.rawScore).toBe(-1) // -1/1 = -1
  })

  test('selecting correct + wrong gives 0 for single-correct question', () => {
    const result = scorePickQuestion(singleCorrect, ['A', 'B'])
    expect(result.score).toBe(0) // +1 - 1 = 0
  })

  const multiCorrect: PickQuestion = {
    id: 'Q-TEST-02',
    type: 'pick',
    points: 1,
    stem: { de: 'Test', en: 'Test' },
    options: [
      { id: 'A', text: { de: 'A', en: 'A' }, correct: true },
      { id: 'B', text: { de: 'B', en: 'B' }, correct: true },
      { id: 'C', text: { de: 'C', en: 'C' }, correct: true },
      { id: 'D', text: { de: 'D', en: 'D' }, correct: false },
      { id: 'E', text: { de: 'E', en: 'E' }, correct: false },
    ],
  }

  test('1-point question with 3 correct: selecting all 3 correct gives 1 point', () => {
    const result = scorePickQuestion(multiCorrect, ['A', 'B', 'C'])
    expect(result.score).toBeCloseTo(1, 5)
  })

  test('1-point question with 3 correct: selecting 2 correct gives 2/3', () => {
    const result = scorePickQuestion(multiCorrect, ['A', 'B'])
    expect(result.score).toBeCloseTo(2 / 3, 5)
  })

  test('1-point question with 3 correct: selecting 2 correct + 1 wrong gives 1/3', () => {
    const result = scorePickQuestion(multiCorrect, ['A', 'B', 'D'])
    expect(result.score).toBeCloseTo(1 / 3, 5)
  })

  test('1-point question with 3 correct: selecting 1 correct + 2 wrong gives 0 (clamped)', () => {
    const result = scorePickQuestion(multiCorrect, ['A', 'D', 'E'])
    expect(result.score).toBe(0)
    expect(result.rawScore).toBeCloseTo(-1 / 3, 5) // 1/3 - 2/3
  })

  const twoPointQuestion: PickQuestion = {
    id: 'Q-TEST-03',
    type: 'pick',
    points: 2,
    stem: { de: 'Test', en: 'Test' },
    options: [
      { id: 'A', text: { de: 'A', en: 'A' }, correct: true },
      { id: 'B', text: { de: 'B', en: 'B' }, correct: true },
      { id: 'C', text: { de: 'C', en: 'C' }, correct: false },
      { id: 'D', text: { de: 'D', en: 'D' }, correct: false },
    ],
  }

  test('2-point question: selecting both correct gives 2 points', () => {
    const result = scorePickQuestion(twoPointQuestion, ['A', 'B'])
    expect(result.score).toBe(2)
  })

  test('2-point question: selecting 1 correct gives 1 point', () => {
    const result = scorePickQuestion(twoPointQuestion, ['A'])
    expect(result.score).toBe(1)
  })

  test('2-point question: selecting 1 correct + 1 wrong gives 0', () => {
    const result = scorePickQuestion(twoPointQuestion, ['A', 'C'])
    expect(result.score).toBe(0)
  })
})

// ===== Category Question Scoring =====

describe('scoreCategoryQuestion', () => {
  const catQuestion: CategoryQuestion = {
    id: 'Q-TEST-CAT',
    type: 'category',
    points: 2,
    stem: { de: 'Test', en: 'Test' },
    categories: [
      { label: 'a', text: { de: 'Konflikt', en: 'conflict' } },
      { label: 'b', text: { de: 'Kein Konflikt', en: 'no conflict' } },
    ],
    statements: [
      { id: 'A', text: { de: 'A', en: 'A' }, correctCategory: 'b' },
      { id: 'B', text: { de: 'B', en: 'B' }, correctCategory: 'a' },
      { id: 'C', text: { de: 'C', en: 'C' }, correctCategory: 'a' },
      { id: 'D', text: { de: 'D', en: 'D' }, correctCategory: 'b' },
    ],
  }

  test('all correct gives full points', () => {
    const result = scoreCategoryQuestion(catQuestion, { A: 'b', B: 'a', C: 'a', D: 'b' })
    expect(result.score).toBe(2)
  })

  test('no answers gives 0', () => {
    const result = scoreCategoryQuestion(catQuestion, {})
    expect(result.score).toBe(0)
  })

  test('3 correct + 1 wrong gives 1 point', () => {
    const result = scoreCategoryQuestion(catQuestion, { A: 'b', B: 'a', C: 'a', D: 'a' })
    expect(result.score).toBe(1) // 3*(2/4) - 1*(2/4) = 1.5 - 0.5 = 1
  })

  test('2 correct + 2 wrong gives 0', () => {
    const result = scoreCategoryQuestion(catQuestion, { A: 'b', B: 'a', C: 'b', D: 'a' })
    expect(result.score).toBe(0) // 2*(0.5) - 2*(0.5) = 0
  })
})

// ===== Full Exam Scoring =====

describe('scoreExam', () => {
  test('pass threshold is 60%', () => {
    expect(PASS_THRESHOLD).toBe(0.6)
  })

  test('empty answers scores 0', () => {
    const questions = fallbackQuestions as (PickQuestion | CategoryQuestion)[]
    const result = scoreExam(questions, {})
    expect(result.totalScore).toBe(0)
    expect(result.passed).toBe(false)
    expect(result.percentage).toBe(0)
    expect(result.totalPossible).toBeGreaterThan(0)
  })

  test('scoring uses real questions from fallback data', () => {
    const questions = fallbackQuestions as (PickQuestion | CategoryQuestion)[]
    // Build perfect answers
    const perfectAnswers: Record<string, string[] | Record<string, string>> = {}
    for (const q of questions) {
      if (q.type === 'pick') {
        perfectAnswers[q.id] = q.options.filter(o => o.correct).map(o => o.id)
      } else if (q.type === 'category') {
        const assignments: Record<string, string> = {}
        for (const s of q.statements) {
          assignments[s.id] = s.correctCategory
        }
        perfectAnswers[q.id] = assignments
      }
    }

    const result = scoreExam(questions, perfectAnswers)
    expect(result.percentage).toBeCloseTo(1, 5) // 100%
    expect(result.passed).toBe(true)
    expect(result.totalScore).toBe(result.totalPossible)
  })
})
