import { randomAt } from '../random.js';

export type StaggerOrigin = 'first' | 'last' | 'center' | 'edges' | 'random';

export interface StaggerOptions {
  /** Delay between consecutive items (frames or seconds — your unit). */
  each: number;
  /** Where the wave starts. Default 'first'. */
  from?: StaggerOrigin | number;
  /** Redistribute delays with an ease curve across the group. */
  ease?: (t: number) => number;
  /** Seed for 'random' origin. */
  seed?: number | string;
}

/**
 * Choreography primitive: compute the start delay of item `index` in a group
 * of `count`. Feed the result into interpolate/spring/track offsets.
 *
 *   const delay = stagger(i, chars.length, { each: 3, from: 'center' });
 *   const y = spring({ time: (frame - delay) / fps });
 */
export function stagger(index: number, count: number, opts: StaggerOptions): number {
  if (count <= 0) return 0;
  const { each, from = 'first', ease, seed = 'stagger' } = opts;

  let order: number;
  if (typeof from === 'number') {
    order = Math.abs(index - from);
  } else {
    switch (from) {
      case 'first': order = index; break;
      case 'last': order = count - 1 - index; break;
      case 'center': order = Math.abs(index - (count - 1) / 2); break;
      case 'edges': order = (count - 1) / 2 - Math.abs(index - (count - 1) / 2); break;
      case 'random': order = randomAt(seed, index) * (count - 1); break;
    }
  }

  if (ease && count > 1) {
    const maxOrder = maxStaggerOrder(count, from);
    const t = maxOrder === 0 ? 0 : order / maxOrder;
    order = ease(t) * maxOrder;
  }
  return order * each;
}

function maxStaggerOrder(count: number, from: StaggerOrigin | number): number {
  if (typeof from === 'number') return Math.max(from, count - 1 - from);
  switch (from) {
    case 'first':
    case 'last':
    case 'random':
      return count - 1;
    case 'center':
    case 'edges':
      return (count - 1) / 2;
  }
}

/** Total time the whole stagger wave takes (delay of the latest item). */
export function staggerDuration(count: number, opts: StaggerOptions): number {
  let max = 0;
  for (let i = 0; i < count; i++) max = Math.max(max, stagger(i, count, opts));
  return max;
}
