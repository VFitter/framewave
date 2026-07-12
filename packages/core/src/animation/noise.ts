import { randomAt } from '../random.js';

/**
 * Deterministic 1D value noise + wiggle() — the After Effects expression
 * everyone misses, rebuilt as a pure function of (seed, time).
 */
export function valueNoise1D(seed: number | string, x: number): number {
  const i0 = Math.floor(x);
  const i1 = i0 + 1;
  const t = x - i0;
  const s = t * t * (3 - 2 * t); // smoothstep
  const a = randomAt(seed, i0) * 2 - 1;
  const b = randomAt(seed, i1) * 2 - 1;
  return a + (b - a) * s; // −1..1
}

export interface WiggleOptions {
  /** Oscillations per second. Default 2. */
  frequency?: number;
  /** Peak amplitude. Default 1. */
  amplitude?: number;
  /** Fractal layers. Default 2. */
  octaves?: number;
  /** Per-octave amplitude falloff. Default 0.5. */
  persistence?: number;
  seed?: number | string;
}

/** Smooth organic jitter — wiggle(t) like AE, but deterministic & frame-pure. */
export function wiggle(timeSeconds: number, opts: WiggleOptions = {}): number {
  const { frequency = 2, amplitude = 1, octaves = 2, persistence = 0.5, seed = 0 } = opts;
  let sum = 0;
  let amp = 1;
  let freq = frequency;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise1D(`${String(seed)}:${o}`, timeSeconds * freq) * amp;
    norm += amp;
    amp *= persistence;
    freq *= 2;
  }
  return (sum / norm) * amplitude;
}
