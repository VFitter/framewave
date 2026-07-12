import { describe, expect, it } from 'vitest';
import { interpolate, interpolateColors } from '../src/animation/interpolate.js';
import { easeInQuad } from '../src/animation/easing.js';

describe('interpolate', () => {
  it('maps linearly across a range', () => {
    expect(interpolate(15, [0, 30], [0, 100])).toBe(50);
    expect(interpolate(0, [0, 30], [0, 100])).toBe(0);
    expect(interpolate(30, [0, 30], [0, 100])).toBe(100);
  });

  it('supports multi-breakpoint ranges', () => {
    expect(interpolate(15, [0, 10, 20, 30], [0, 100, 100, 0])).toBe(100);
    expect(interpolate(25, [0, 10, 20, 30], [0, 100, 100, 0])).toBe(50);
  });

  it('clamps, extends, wraps, and mirrors', () => {
    expect(interpolate(40, [0, 30], [0, 100], { extrapolateRight: 'clamp' })).toBe(100);
    expect(interpolate(45, [0, 30], [0, 100], { extrapolateRight: 'extend' })).toBe(150);
    expect(interpolate(40, [0, 30], [0, 100], { extrapolateRight: 'wrap' })).toBeCloseTo(interpolate(10, [0, 30], [0, 100]));
    expect(interpolate(40, [0, 30], [0, 100], { extrapolateRight: 'mirror' })).toBeCloseTo(interpolate(20, [0, 30], [0, 100]));
  });

  it('applies easing per segment', () => {
    const v = interpolate(15, [0, 30], [0, 100], { easing: easeInQuad });
    expect(v).toBeCloseTo(25);
  });

  it('rejects invalid ranges', () => {
    expect(() => interpolate(0, [0], [0])).toThrow();
    expect(() => interpolate(0, [0, 10], [0])).toThrow();
    expect(() => interpolate(0, [10, 0], [0, 1])).toThrow();
  });
});

describe('interpolateColors (OKLab)', () => {
  it('returns endpoints exactly', () => {
    expect(interpolateColors(0, [0, 1], ['#000000', '#ffffff'])).toBe('rgba(0, 0, 0, 1)');
    expect(interpolateColors(1, [0, 1], ['#000000', '#ffffff'])).toBe('rgba(255, 255, 255, 1)');
  });

  it('midpoint of black→white is perceptual mid-gray (not 128 rgb)', () => {
    const mid = interpolateColors(0.5, [0, 1], ['#000000', '#ffffff']);
    const m = mid.match(/rgba\((\d+), (\d+), (\d+)/)!;
    const r = Number(m[1]);
    // OKLab L=0.5 gray ≈ sRGB 99 — distinctly not the naive rgb-lerp 128
    expect(r).toBeGreaterThan(90);
    expect(r).toBeLessThan(110);
  });
});
