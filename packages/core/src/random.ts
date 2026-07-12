/**
 * Seeded, splittable randomness. Every "random" value in Framewave is a pure
 * function of its seed — renders are reproducible across machines and workers.
 */

/** mulberry32 — fast, high-quality 32-bit PRNG. */
export function createRandom(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless: one deterministic number per (seed, index). Safe in parallel renders. */
export function randomAt(seed: number | string, index: number): number {
  const base = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  let a = (base + Math.imul(index | 0, 0x9e3779b9)) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
