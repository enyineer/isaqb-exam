import { describe, it, expect } from 'bun:test'
import { seededShuffle, createRng } from '../src/utils/shuffle'

describe('createRng', () => {
  it('produces deterministic values for the same seed', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('produces different values for different seeds', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(99)
    const seq1 = Array.from({ length: 5 }, () => rng1())
    const seq2 = Array.from({ length: 5 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })

  it('produces values in [0, 1)', () => {
    const rng = createRng(12345)
    for (let i = 0; i < 100; i++) {
      const val = rng()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })
})

describe('seededShuffle', () => {
  const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

  it('returns the same shuffle for the same seed', () => {
    const a = seededShuffle(items, 42)
    const b = seededShuffle(items, 42)
    expect(a).toEqual(b)
  })

  it('returns a different order for a different seed', () => {
    const a = seededShuffle(items, 42)
    const b = seededShuffle(items, 99)
    // Technically could match by chance, but with 7 items it's astronomically unlikely
    expect(a).not.toEqual(b)
  })

  it('does not modify the original array', () => {
    const original = [...items]
    seededShuffle(items, 42)
    expect(items).toEqual(original)
  })

  it('preserves all elements', () => {
    const shuffled = seededShuffle(items, 42)
    expect(shuffled.sort()).toEqual([...items].sort())
  })

  it('preserves length', () => {
    const shuffled = seededShuffle(items, 42)
    expect(shuffled.length).toBe(items.length)
  })

  it('works with single-element array', () => {
    expect(seededShuffle(['X'], 42)).toEqual(['X'])
  })

  it('works with empty array', () => {
    expect(seededShuffle([], 42)).toEqual([])
  })

  it('actually shuffles (not identity)', () => {
    // With 7 items and a good RNG, the identity permutation is 1/5040 chance
    // Test multiple seeds to confirm at least one shuffles
    const anyShuffle = [1, 2, 3, 4, 5].some(seed => {
      const shuffled = seededShuffle(items, seed)
      return shuffled.some((val, idx) => val !== items[idx])
    })
    expect(anyShuffle).toBe(true)
  })
})
