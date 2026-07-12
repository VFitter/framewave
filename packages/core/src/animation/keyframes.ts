import type { EasingFn } from './easing.js';
import { linear } from './easing.js';
import { interpolate } from './interpolate.js';

export interface Keyframe {
  /** Frame (or seconds — any monotonically increasing unit). */
  at: number;
  value: number;
  /** Easing INTO the next keyframe. */
  easing?: EasingFn;
  /** Hold this value until the next keyframe (step). */
  hold?: boolean;
}

/**
 * A keyframe track with per-segment easing — evaluated as a pure function of
 * time, After-Effects style but code-first.
 *
 *   const y = track([
 *     { at: 0, value: 0, easing: easeOutCubic },
 *     { at: 30, value: -120, easing: easeInOutQuad },
 *     { at: 60, value: 0 },
 *   ]);
 *   y(frame) // → number
 */
export function track(keyframes: readonly Keyframe[]): (time: number) => number {
  if (keyframes.length === 0) throw new Error('track() needs at least one keyframe');
  const sorted = [...keyframes].sort((a, b) => a.at - b.at);

  return (time: number): number => {
    const firstKf = sorted[0]!;
    const lastKf = sorted[sorted.length - 1]!;
    if (time <= firstKf.at) return firstKf.value;
    if (time >= lastKf.at) return lastKf.value;
    let i = 0;
    while (i < sorted.length - 2 && time >= sorted[i + 1]!.at) i++;
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (a.hold) return a.value;
    return interpolate(time, [a.at, b.at], [a.value, b.value], { easing: a.easing ?? linear });
  };
}

/** Multi-property variant: tracks for x/y/scale/rotation/opacity in one call. */
export function tracks<T extends Record<string, readonly Keyframe[]>>(
  defs: T,
): (time: number) => { [K in keyof T]: number } {
  const compiled = Object.fromEntries(
    Object.entries(defs).map(([k, v]) => [k, track(v)]),
  ) as { [K in keyof T]: (t: number) => number };
  return (time) => {
    const out = {} as { [K in keyof T]: number };
    for (const k in compiled) out[k] = compiled[k](time);
    return out;
  };
}
