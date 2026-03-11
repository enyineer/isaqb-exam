/**
 * Seeded pseudo-random number generator (mulberry32).
 * Given a numeric seed, produces a deterministic sequence of values in [0, 1).
 */
export function createRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Returns a new array with elements shuffled using a seeded PRNG (Fisher-Yates).
 * The original array is not modified.
 */
export function seededShuffle<T>(array: readonly T[], seed: number): T[] {
  const result = [...array]
  const rng = createRng(seed)
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
