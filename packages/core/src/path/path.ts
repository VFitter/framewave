/**
 * Motion paths: cubic-bezier splines with arc-length parameterization, so
 * objects travel at *constant speed* along curves (raw bezier t does not —
 * the classic motion-path bug in most web animation code).
 */
export interface Vec2 {
  x: number;
  y: number;
}

interface CubicSegment {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

export interface PathSample {
  point: Vec2;
  /** Unit tangent — orient objects along the path. */
  tangent: Vec2;
  /** Rotation in radians (atan2 of tangent). */
  angle: number;
}

const LUT_STEPS = 64;

export class MotionPath {
  private segments: CubicSegment[] = [];
  private cursor: Vec2 = { x: 0, y: 0 };
  private start: Vec2 = { x: 0, y: 0 };
  private lut: { u: number; length: number }[] | null = null;
  private totalLength = 0;

  moveTo(x: number, y: number): this {
    this.cursor = { x, y };
    this.start = { x, y };
    this.invalidate();
    return this;
  }

  lineTo(x: number, y: number): this {
    const p0 = this.cursor;
    const p3 = { x, y };
    // straight line as a degenerate cubic
    const p1 = lerp2(p0, p3, 1 / 3);
    const p2 = lerp2(p0, p3, 2 / 3);
    this.segments.push({ p0, p1, p2, p3 });
    this.cursor = p3;
    this.invalidate();
    return this;
  }

  cubicTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    this.segments.push({
      p0: this.cursor,
      p1: { x: c1x, y: c1y },
      p2: { x: c2x, y: c2y },
      p3: { x, y },
    });
    this.cursor = { x, y };
    this.invalidate();
    return this;
  }

  quadTo(cx: number, cy: number, x: number, y: number): this {
    // Elevate quadratic to cubic
    const p0 = this.cursor;
    const q = { x: cx, y: cy };
    const p3 = { x, y };
    this.segments.push({
      p0,
      p1: { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
      p2: { x: p3.x + (2 / 3) * (q.x - p3.x), y: p3.y + (2 / 3) * (q.y - p3.y) },
      p3,
    });
    this.cursor = p3;
    this.invalidate();
    return this;
  }

  close(): this {
    if (this.cursor.x !== this.start.x || this.cursor.y !== this.start.y) {
      this.lineTo(this.start.x, this.start.y);
    }
    return this;
  }

  get length(): number {
    this.ensureLut();
    return this.totalLength;
  }

  /**
   * Sample the path at normalized progress u ∈ [0,1] BY ARC LENGTH —
   * u = 0.5 is exactly halfway along the curve's real distance.
   */
  at(u: number): PathSample {
    this.ensureLut();
    const clamped = Math.min(1, Math.max(0, u));
    const target = clamped * this.totalLength;

    const lut = this.lut!;
    // binary search the LUT
    let lo = 0;
    let hi = lut.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lut[mid]!.length < target) lo = mid + 1;
      else hi = mid;
    }
    const i1 = Math.max(1, lo);
    const a = lut[i1 - 1]!;
    const b = lut[i1]!;
    const segT = b.length === a.length ? 0 : (target - a.length) / (b.length - a.length);
    const u2 = a.u + (b.u - a.u) * segT;
    return this.sampleRaw(u2);
  }

  /** Sample by raw parametric t (kept public for morphing/advanced use). */
  sampleRaw(u: number): PathSample {
    if (this.segments.length === 0) {
      return { point: { ...this.cursor }, tangent: { x: 1, y: 0 }, angle: 0 };
    }
    const scaled = Math.min(0.999999, Math.max(0, u)) * this.segments.length;
    const idx = Math.floor(scaled);
    const t = scaled - idx;
    const seg = this.segments[idx]!;
    return {
      point: cubicPoint(seg, t),
      ...tangentOf(seg, t),
    };
  }

  private invalidate(): void {
    this.lut = null;
  }

  private ensureLut(): void {
    if (this.lut) return;
    const steps = LUT_STEPS * Math.max(1, this.segments.length);
    const lut: { u: number; length: number }[] = [];
    let len = 0;
    let prev = this.sampleRaw(0).point;
    lut.push({ u: 0, length: 0 });
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const p = this.sampleRaw(u).point;
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      lut.push({ u, length: len });
      prev = p;
    }
    this.lut = lut;
    this.totalLength = len;
  }
}

function cubicPoint(s: CubicSegment, t: number): Vec2 {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * s.p0.x + b * s.p1.x + c * s.p2.x + d * s.p3.x,
    y: a * s.p0.y + b * s.p1.y + c * s.p2.y + d * s.p3.y,
  };
}

function tangentOf(s: CubicSegment, t: number): { tangent: Vec2; angle: number } {
  const mt = 1 - t;
  let dx =
    3 * mt * mt * (s.p1.x - s.p0.x) + 6 * mt * t * (s.p2.x - s.p1.x) + 3 * t * t * (s.p3.x - s.p2.x);
  let dy =
    3 * mt * mt * (s.p1.y - s.p0.y) + 6 * mt * t * (s.p2.y - s.p1.y) + 3 * t * t * (s.p3.y - s.p2.y);
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-9) {
    dx = 1;
    dy = 0;
  } else {
    dx /= mag;
    dy /= mag;
  }
  return { tangent: { x: dx, y: dy }, angle: Math.atan2(dy, dx) };
}

const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
