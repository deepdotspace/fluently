/**
 * Deterministic seeded randomness. Motion layouts must be reproducible render
 * to render, so primitives never call Math.random(). Seed from a stable string
 * and the same sequence comes back every time. mulberry32 over an FNV-1a hash.
 */

function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Returns a generator producing floats in [0, 1) deterministically for the seed. */
export function seededRandom(seed: string): () => number {
  let a = hashSeed(seed)
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
