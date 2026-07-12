import { describe, expect, it } from 'vitest';
import { spring, springDuration, springPresets, springVelocity } from '../src/animation/spring.js';

describe('analytic spring', () => {
  it('starts at `from` and settles at `to`', () => {
    expect(spring({ time: 0, from: 10, to: 100 })).toBe(10);
    expect(spring({ time: 10, from: 10, to: 100 })).toBeCloseTo(100, 3);
  });

  it('is O(1) frame-pure: same input, same output, any order', () => {
    const a = spring({ time: 0.37, ...springPresets.wobbly });
    const b = spring({ time: 1.5, ...springPresets.wobbly });
    const a2 = spring({ time: 0.37, ...springPresets.wobbly });
    expect(a2).toBe(a);
    expect(b).not.toBe(a);
  });

  it('underdamped springs overshoot; critically damped never do', () => {
    // wobbly (zeta < 1) should exceed 1 at some point
    let overshoot = false;
    for (let t = 0; t < 2; t += 1 / 120) {
      if (spring({ time: t, ...springPresets.wobbly }) > 1.001) overshoot = true;
    }
    expect(overshoot).toBe(true);

    // critical damping: c = 2*sqrt(k*m)
    const k = 170;
    const critical = { stiffness: k, damping: 2 * Math.sqrt(k), mass: 1 };
    for (let t = 0; t < 2; t += 1 / 120) {
      expect(spring({ time: t, ...critical })).toBeLessThanOrEqual(1.0001);
    }
  });

  it('handles overdamped configs without oscillation', () => {
    const over = { stiffness: 100, damping: 40, mass: 1 }; // zeta = 2
    let prev = spring({ time: 0, ...over });
    for (let t = 1 / 60; t < 3; t += 1 / 60) {
      const v = spring({ time: t, ...over });
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9); // monotonic rise
      prev = v;
    }
    expect(prev).toBeCloseTo(1, 2);
  });

  it('respects initial velocity', () => {
    const still = spring({ time: 0.05 });
    const shoved = spring({ time: 0.05, initialVelocity: 20 });
    expect(shoved).toBeGreaterThan(still);
  });

  it('reports a sane settle duration', () => {
    const d = springDuration(springPresets.default);
    expect(d).toBeGreaterThan(0.1);
    expect(d).toBeLessThan(5);
    expect(Math.abs(spring({ time: d, ...springPresets.default }) - 1)).toBeLessThan(0.01);
  });

  it('velocity approaches zero at rest', () => {
    expect(Math.abs(springVelocity({ time: 8 }))).toBeLessThan(0.01);
  });
});
