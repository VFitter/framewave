import type { EasingFn } from './easing.js';
import { linear } from './easing.js';
import { mixColors } from '../color/color.js';

export type ExtrapolateMode = 'extend' | 'clamp' | 'wrap' | 'mirror';

export interface InterpolateOptions {
  easing?: EasingFn;
  extrapolateLeft?: ExtrapolateMode;
  extrapolateRight?: ExtrapolateMode;
}

/**
 * Map `input` across breakpoint ranges — the workhorse of frame-driven motion.
 *
 *   interpolate(frame, [0, 30], [0, 100])
 *   interpolate(frame, [0, 15, 30], [0, 1.2, 1], { easing: easeOutCubic })
 *
 * Adds `wrap` and `mirror` extrapolation (loops and ping-pongs for free).
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: InterpolateOptions = {},
): number {
  if (inputRange.length < 2) throw new Error('inputRange needs at least 2 breakpoints');
  if (inputRange.length !== outputRange.length) {
    throw new Error(`inputRange (${inputRange.length}) and outputRange (${outputRange.length}) must match`);
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (inputRange[i]! <= inputRange[i - 1]!) throw new Error('inputRange must be strictly increasing');
  }

  const easing = options.easing ?? linear;
  const first = inputRange[0]!;
  const last = inputRange[inputRange.length - 1]!;
  const span = last - first;

  let x = input;
  if (x < first) {
    const mode = options.extrapolateLeft ?? 'extend';
    if (mode === 'clamp') x = first;
    else if (mode === 'wrap') x = first + mod(x - first, span);
    else if (mode === 'mirror') x = first + mirror(x - first, span);
  } else if (x > last) {
    const mode = options.extrapolateRight ?? 'extend';
    if (mode === 'clamp') x = last;
    else if (mode === 'wrap') x = first + mod(x - first, span);
    else if (mode === 'mirror') x = first + mirror(x - first, span);
  }

  // find segment
  let i = 0;
  while (i < inputRange.length - 2 && x >= inputRange[i + 1]!) i++;
  const x0 = inputRange[i]!;
  const x1 = inputRange[i + 1]!;
  const y0 = outputRange[i]!;
  const y1 = outputRange[i + 1]!;

  const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
  return y0 + (y1 - y0) * easing(t);
}

/** Color-aware interpolate across CSS color stops (OKLab-perceptual). */
export function interpolateColors(
  input: number,
  inputRange: readonly number[],
  colors: readonly string[],
  options: InterpolateOptions = {},
): string {
  if (inputRange.length !== colors.length) throw new Error('inputRange and colors must have equal length');
  const easing = options.easing ?? linear;
  const first = inputRange[0]!;
  const last = inputRange[inputRange.length - 1]!;
  const x = Math.min(last, Math.max(first, input));
  let i = 0;
  while (i < inputRange.length - 2 && x >= inputRange[i + 1]!) i++;
  const x0 = inputRange[i]!;
  const x1 = inputRange[i + 1]!;
  const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
  return mixColors(colors[i]!, colors[i + 1]!, easing(t));
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;
const mirror = (n: number, m: number): number => {
  const p = mod(n, 2 * m);
  return p <= m ? p : 2 * m - p;
};
