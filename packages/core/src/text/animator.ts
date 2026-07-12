import { stagger, type StaggerOptions } from '../animation/stagger.js';

export type TextSplit = 'chars' | 'words' | 'lines';

export interface TextUnit {
  text: string;
  index: number;
  count: number;
  /** Index within its word / line for nested choreography. */
  localIndex: number;
}

/** Split text into animatable units (the AE "text animator" primitive). */
export function splitText(text: string, by: TextSplit = 'chars'): TextUnit[] {
  let parts: string[];
  if (by === 'chars') parts = [...text];
  else if (by === 'words') parts = text.split(/(\s+)/).filter((w) => w.trim().length > 0);
  else parts = text.split(/\r?\n/);

  let local = 0;
  return parts.map((p, i) => {
    if (by === 'chars' && /\s/.test(p)) local = 0;
    else local += 1;
    return { text: p, index: i, count: parts.length, localIndex: local - 1 };
  });
}

export interface TextAnimatorOptions extends Omit<StaggerOptions, 'each'> {
  /** Delay between units (frames or seconds — your unit). */
  each: number;
}

/**
 * Per-unit animation driver. Returns, for each unit, the local time you feed
 * into springs/easings:
 *
 *   const anim = textAnimator('FRAMEWAVE', { each: 2, from: 'center' });
 *   for (const u of anim.units) {
 *     const t = anim.localTime(u.index, frame);
 *     const y = spring({ time: t / fps, from: 40, to: 0 });
 *   }
 */
export function textAnimator(
  text: string,
  opts: TextAnimatorOptions,
  by: TextSplit = 'chars',
): {
  units: TextUnit[];
  delay: (index: number) => number;
  localTime: (index: number, time: number) => number;
  totalDelay: number;
} {
  const units = splitText(text, by);
  const delays = units.map((u) => stagger(u.index, u.count, opts));
  const totalDelay = delays.reduce((m, d) => Math.max(m, d), 0);
  return {
    units,
    delay: (index) => delays[index] ?? 0,
    localTime: (index, time) => Math.max(0, time - (delays[index] ?? 0)),
    totalDelay,
  };
}
