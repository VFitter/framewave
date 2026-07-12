import { describe, expect, it } from 'vitest';
import { stagger, staggerDuration } from '../src/animation/stagger.js';
import { textAnimator } from '../src/text/animator.js';
import { wiggle } from '../src/animation/noise.js';
import { randomAt } from '../src/random.js';
import { track } from '../src/animation/keyframes.js';

describe('stagger', () => {
  it('waves from first / last / center', () => {
    expect(stagger(0, 5, { each: 2, from: 'first' })).toBe(0);
    expect(stagger(4, 5, { each: 2, from: 'first' })).toBe(8);
    expect(stagger(4, 5, { each: 2, from: 'last' })).toBe(0);
    expect(stagger(2, 5, { each: 2, from: 'center' })).toBe(0);
    expect(stagger(0, 5, { each: 2, from: 'center' })).toBe(4);
  });

  it('random origin is deterministic per seed', () => {
    const a = stagger(3, 10, { each: 1, from: 'random', seed: 'x' });
    const b = stagger(3, 10, { each: 1, from: 'random', seed: 'x' });
    const c = stagger(3, 10, { each: 1, from: 'random', seed: 'y' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('duration covers the slowest item', () => {
    expect(staggerDuration(5, { each: 2, from: 'first' })).toBe(8);
  });
});

describe('textAnimator', () => {
  it('splits and assigns delays per char', () => {
    const anim = textAnimator('WAVE', { each: 3 });
    expect(anim.units.length).toBe(4);
    expect(anim.delay(0)).toBe(0);
    expect(anim.delay(3)).toBe(9);
    expect(anim.localTime(3, 10)).toBe(1);
    expect(anim.localTime(3, 5)).toBe(0); // clamped before its start
  });
});

describe('determinism primitives', () => {
  it('randomAt is stateless and reproducible', () => {
    expect(randomAt('seed', 7)).toBe(randomAt('seed', 7));
    expect(randomAt('seed', 7)).not.toBe(randomAt('seed', 8));
  });

  it('wiggle is pure across evaluation order', () => {
    const at2 = wiggle(2.0, { seed: 'w' });
    wiggle(1.0, { seed: 'w' });
    expect(wiggle(2.0, { seed: 'w' })).toBe(at2);
    expect(Math.abs(at2)).toBeLessThanOrEqual(1);
  });
});

describe('track', () => {
  it('evaluates keyframes with holds', () => {
    const y = track([
      { at: 0, value: 0 },
      { at: 10, value: 100, hold: true },
      { at: 20, value: 200 },
    ]);
    expect(y(5)).toBe(50);
    expect(y(15)).toBe(100); // held
    expect(y(25)).toBe(200); // clamped after last
  });
});
