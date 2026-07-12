/**
 * Analytic (closed-form) damped springs.
 *
 * Unlike step-integrated springs (Remotion, react-spring), Framewave solves the
 * damped harmonic oscillator analytically, so evaluating frame 900 costs the
 * same as frame 0 — O(1), perfectly deterministic, and resolution-independent.
 *
 *   m·x″ + c·x′ + k·x = 0
 *
 * with x(0) = from - to, x′(0) = -initialVelocity.
 */
export interface SpringConfig {
  /** Stiffness k. Default 170. */
  stiffness?: number;
  /** Damping c. Default 26. */
  damping?: number;
  /** Mass m. Default 1. */
  mass?: number;
  /** Initial velocity in units/second toward the target. Default 0. */
  initialVelocity?: number;
}

export interface SpringOptions extends SpringConfig {
  /** Seconds since the spring started. */
  time: number;
  from?: number;
  to?: number;
}

export const springPresets = {
  /** Default — snappy with slight overshoot. */
  default: { stiffness: 170, damping: 26, mass: 1 },
  /** No overshoot, fast settle. */
  gentle: { stiffness: 120, damping: 22, mass: 1 },
  /** Big playful overshoot. */
  wobbly: { stiffness: 180, damping: 12, mass: 1 },
  /** Aggressive snap. */
  stiff: { stiffness: 300, damping: 30, mass: 1 },
  /** Slow cinematic drift. */
  molasses: { stiffness: 40, damping: 20, mass: 2 },
} as const satisfies Record<string, SpringConfig>;

/**
 * Position of the spring at `time` seconds. Pure & analytic.
 */
export function spring(opts: SpringOptions): number {
  const { time, from = 0, to = 1 } = opts;
  const k = opts.stiffness ?? 170;
  const c = opts.damping ?? 26;
  const m = opts.mass ?? 1;
  // x = position − target, so velocity toward the target is x′(0) = +v.
  const v0 = opts.initialVelocity ?? 0;

  if (time <= 0) return from;

  const x0 = from - to;
  const omega0 = Math.sqrt(k / m); // natural frequency
  const zeta = c / (2 * Math.sqrt(k * m)); // damping ratio

  let x: number;
  if (zeta < 1) {
    // Underdamped
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const A = x0;
    const B = (v0 + zeta * omega0 * x0) / omegaD;
    x = Math.exp(-zeta * omega0 * time) * (A * Math.cos(omegaD * time) + B * Math.sin(omegaD * time));
  } else if (zeta === 1) {
    // Critically damped
    const A = x0;
    const B = v0 + omega0 * x0;
    x = (A + B * time) * Math.exp(-omega0 * time);
  } else {
    // Overdamped
    const s = omega0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega0 + s;
    const r2 = -zeta * omega0 - s;
    const B = (v0 - r1 * x0) / (r2 - r1);
    const A = x0 - B;
    x = A * Math.exp(r1 * time) + B * Math.exp(r2 * time);
  }
  return to + x;
}

/** Velocity of the spring at `time` seconds (units/second). Analytic derivative. */
export function springVelocity(opts: SpringOptions): number {
  const h = 1 / 240;
  // Central difference on the analytic solution is exact enough for chaining
  // (error O(h²) ≈ 1e-5) while keeping the code auditable.
  return (spring({ ...opts, time: opts.time + h }) - spring({ ...opts, time: Math.max(0, opts.time - h) })) / (2 * h);
}

/**
 * Seconds until the spring stays within `epsilon` of its target.
 * Uses the analytic envelope for the underdamped case, sampling otherwise.
 */
export function springDuration(config: SpringConfig = {}, epsilon = 0.005): number {
  const k = config.stiffness ?? 170;
  const c = config.damping ?? 26;
  const m = config.mass ?? 1;
  const omega0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));

  if (zeta < 1 && zeta > 0) {
    // envelope: |x| <= amp·e^(−ζω₀t); solve e^(−ζω₀t) = ε
    const amp = Math.max(1, Math.sqrt(1 + Math.pow((zeta * omega0) / (omega0 * Math.sqrt(1 - zeta * zeta)), 2)));
    return Math.log(amp / epsilon) / (zeta * omega0);
  }
  // Sample until settled
  let t = 0;
  const step = 1 / 60;
  for (let i = 0; i < 60 * 60; i++) {
    t = i * step;
    if (Math.abs(spring({ time: t, ...config }) - 1) < epsilon && Math.abs(springVelocity({ time: t, ...config })) < epsilon * 10) {
      return t;
    }
  }
  return t;
}
