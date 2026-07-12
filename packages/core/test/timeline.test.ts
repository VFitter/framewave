import { describe, expect, it } from 'vitest';
import { Composition, Sequence, remapTime } from '../src/time/timeline.js';

describe('Composition', () => {
  const comp = new Composition({ width: 1920, height: 1080, fps: 30, durationInFrames: 90 });

  it('derives time from frame deterministically', () => {
    const ctx = comp.contextAt(45);
    expect(ctx.time).toBeCloseTo(1.5);
    expect(ctx.progress).toBeCloseTo(45 / 89);
  });

  it('validates config', () => {
    expect(() => new Composition({ width: 1, height: 1, fps: 0, durationInFrames: 10 })).toThrow();
    expect(() => new Composition({ width: 1, height: 1, fps: 30, durationInFrames: 0 })).toThrow();
  });
});

describe('Sequence', () => {
  const comp = new Composition({ width: 100, height: 100, fps: 30, durationInFrames: 120 });

  it('shifts local time and clips outside its window', () => {
    const seq = new Sequence({ from: 30, durationInFrames: 60 });
    expect(seq.localContext(comp.contextAt(29))).toBeNull();
    expect(seq.localContext(comp.contextAt(30))?.frame).toBe(0);
    expect(seq.localContext(comp.contextAt(89))?.frame).toBe(59);
    expect(seq.localContext(comp.contextAt(90))).toBeNull();
  });

  it('defaults duration to the remainder of the parent', () => {
    const seq = new Sequence({ from: 100 });
    expect(seq.active(119, comp.durationInFrames)).toBe(true);
    expect(seq.active(120, comp.durationInFrames)).toBe(false);
  });
});

describe('remapTime', () => {
  const comp = new Composition({ width: 100, height: 100, fps: 30, durationInFrames: 120 });

  it('retimes purely (reverse playback)', () => {
    const ctx = comp.contextAt(30);
    const reversed = remapTime(ctx, (f) => comp.durationInFrames - 1 - f);
    expect(reversed.frame).toBe(89);
    expect(reversed.time).toBeCloseTo(89 / 30);
  });
});
