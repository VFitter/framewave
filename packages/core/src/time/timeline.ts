/**
 * The deterministic clock. A Composition is a pure description; a frame number
 * plus that description fully determines every pixel. No wall-clock time, no
 * hidden state — which is what makes distributed / parallel rendering trivial.
 */
export interface CompositionConfig {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  id?: string;
}

export interface FrameContext {
  /** Current frame within this (possibly nested) time context. */
  frame: number;
  /** Seconds — frame / fps. */
  time: number;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  /** Normalized progress 0..1 across the context duration. */
  progress: number;
}

export class Composition {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
  readonly id: string;

  constructor(config: CompositionConfig) {
    if (config.fps <= 0) throw new Error('fps must be positive');
    if (config.durationInFrames <= 0) throw new Error('durationInFrames must be positive');
    this.width = config.width;
    this.height = config.height;
    this.fps = config.fps;
    this.durationInFrames = config.durationInFrames;
    this.id = config.id ?? 'composition';
  }

  get durationInSeconds(): number {
    return this.durationInFrames / this.fps;
  }

  contextAt(frame: number): FrameContext {
    return {
      frame,
      time: frame / this.fps,
      fps: this.fps,
      durationInFrames: this.durationInFrames,
      width: this.width,
      height: this.height,
      progress: this.durationInFrames <= 1 ? 0 : frame / (this.durationInFrames - 1),
    };
  }
}

export interface SequenceConfig {
  /** Start frame within the parent context. */
  from: number;
  /** Length in frames. Defaults to the remainder of the parent. */
  durationInFrames?: number;
  name?: string;
}

/**
 * A Sequence shifts and clips time: children see a local frame starting at 0.
 * Compose these to build complex choreography that stays frame-pure.
 */
export class Sequence {
  readonly from: number;
  readonly durationInFrames: number | undefined;
  readonly name: string;

  constructor(config: SequenceConfig) {
    this.from = config.from;
    this.durationInFrames = config.durationInFrames;
    this.name = config.name ?? 'sequence';
  }

  /** Local context, or null when the parent frame is outside this sequence. */
  localContext(parent: FrameContext): FrameContext | null {
    const local = parent.frame - this.from;
    const dur = this.durationInFrames ?? parent.durationInFrames - this.from;
    if (local < 0 || local >= dur) return null;
    return {
      ...parent,
      frame: local,
      time: local / parent.fps,
      durationInFrames: dur,
      progress: dur <= 1 ? 0 : local / (dur - 1),
    };
  }

  /** True when the parent frame falls inside this sequence. */
  active(parentFrame: number, parentDuration: number): boolean {
    const dur = this.durationInFrames ?? parentDuration - this.from;
    const local = parentFrame - this.from;
    return local >= 0 && local < dur;
  }
}

/** Retime a context: slow-mo, speed-ups, reverse, freeze — all pure. */
export function remapTime(
  ctx: FrameContext,
  map: (frame: number) => number,
): FrameContext {
  const f = map(ctx.frame);
  return { ...ctx, frame: f, time: f / ctx.fps };
}

/** Frame ↔ seconds helpers. */
export const framesToSeconds = (frames: number, fps: number): number => frames / fps;
export const secondsToFrames = (seconds: number, fps: number): number => Math.round(seconds * fps);
