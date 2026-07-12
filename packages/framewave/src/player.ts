import type { Composition, FrameContext, Scene } from '@framewave/core';
import type { Renderer } from '@framewave/gpu';

export interface PlayerOptions {
  composition: Composition;
  renderer: Renderer;
  build: (ctx: FrameContext) => Scene;
  loop?: boolean;
  /** Playback rate multiplier. Default 1. */
  rate?: number;
  onFrame?: (frame: number) => void;
}

/**
 * Real-time preview player. Deterministic mapping of wall clock → frame, so
 * what you preview is exactly what exports (same frames, same math).
 */
export class Player {
  private opts: PlayerOptions;
  private raf = 0;
  private startedAt = 0;
  private pausedFrame = 0;
  private _playing = false;

  constructor(opts: PlayerOptions) {
    this.opts = opts;
    this.seek(0);
  }

  get playing(): boolean {
    return this._playing;
  }

  play(): void {
    if (this._playing) return;
    this._playing = true;
    const { fps } = this.opts.composition;
    this.startedAt = performance.now() - (this.pausedFrame / fps / (this.opts.rate ?? 1)) * 1000;
    const tick = (): void => {
      if (!this._playing) return;
      const { composition } = this.opts;
      const elapsed = ((performance.now() - this.startedAt) / 1000) * (this.opts.rate ?? 1);
      let frame = Math.floor(elapsed * composition.fps);
      if (frame >= composition.durationInFrames) {
        if (this.opts.loop) {
          frame %= composition.durationInFrames;
          this.startedAt = performance.now() - (frame / composition.fps / (this.opts.rate ?? 1)) * 1000;
        } else {
          this.pause();
          this.seek(composition.durationInFrames - 1);
          return;
        }
      }
      this.renderFrame(frame);
      this.pausedFrame = frame;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause(): void {
    this._playing = false;
    cancelAnimationFrame(this.raf);
  }

  seek(frame: number): void {
    const clamped = Math.max(0, Math.min(this.opts.composition.durationInFrames - 1, frame));
    this.pausedFrame = clamped;
    this.renderFrame(clamped);
  }

  private renderFrame(frame: number): void {
    const ctx = this.opts.composition.contextAt(frame);
    this.opts.renderer.render(this.opts.build(ctx));
    this.opts.onFrame?.(frame);
  }

  dispose(): void {
    this.pause();
  }
}
