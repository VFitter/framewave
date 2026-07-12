import type { Scene } from '@framewave/core';

/**
 * Renderer contract shared by every backend. `render` draws one frame of a
 * scene; `readFrame` hands pixels to the export pipeline.
 */
export interface Renderer {
  readonly width: number;
  readonly height: number;
  render(scene: Scene): void;
  /** The drawing surface (for WebCodecs VideoFrame construction / preview). */
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  dispose(): void;
}

export interface RendererOptions {
  width: number;
  height: number;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  /**
   * Motion blur: samples per frame (temporal supersampling). 1 = off.
   * The render callback receives sub-frame times; backends accumulate.
   */
  motionBlurSamples?: number;
}
