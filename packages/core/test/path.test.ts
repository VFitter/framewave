import { describe, expect, it } from 'vitest';
import { MotionPath } from '../src/path/path.js';

describe('MotionPath', () => {
  it('measures straight-line length exactly', () => {
    const p = new MotionPath().moveTo(0, 0).lineTo(300, 400);
    expect(p.length).toBeCloseTo(500, 0);
  });

  it('samples by arc length — constant speed on mixed segments', () => {
    // Two segments: short line then long line. Raw-t sampling would spend
    // half the time on each; arc-length sampling must not.
    const p = new MotionPath().moveTo(0, 0).lineTo(10, 0).lineTo(110, 0);
    const mid = p.at(0.5).point;
    expect(mid.x).toBeCloseTo(55, 0); // halfway along 110 total length
  });

  it('returns unit tangents and angles', () => {
    const p = new MotionPath().moveTo(0, 0).lineTo(100, 100);
    const s = p.at(0.5);
    expect(Math.hypot(s.tangent.x, s.tangent.y)).toBeCloseTo(1, 5);
    expect(s.angle).toBeCloseTo(Math.PI / 4, 3);
  });

  it('clamps u outside [0,1]', () => {
    const p = new MotionPath().moveTo(0, 0).lineTo(100, 0);
    expect(p.at(-1).point.x).toBeCloseTo(0, 0);
    expect(p.at(2).point.x).toBeCloseTo(100, 0);
  });

  it('close() returns to start', () => {
    const p = new MotionPath().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).close();
    const end = p.at(1).point;
    expect(end.x).toBeCloseTo(0, 0);
    expect(end.y).toBeCloseTo(0, 0);
  });

  it('handles cubic curves with sensible length', () => {
    const p = new MotionPath().moveTo(0, 0).cubicTo(50, 0, 100, 50, 100, 100);
    expect(p.length).toBeGreaterThan(Math.hypot(100, 100)); // longer than chord
    expect(p.length).toBeLessThan(200); // shorter than control polygon
  });
});
