export type { Renderer, RendererOptions } from './renderer.js';
export { Canvas2DRenderer } from './canvas2d.js';
export { WebGPURenderer } from './webgpu.js';
export { SDF_SHADER, TEXTURE_SHADER } from './shaders/sdf.wgsl.js';

import type { Renderer, RendererOptions } from './renderer.js';
import { Canvas2DRenderer } from './canvas2d.js';
import { WebGPURenderer } from './webgpu.js';

/**
 * Create the best available renderer: WebGPU when present, Canvas2D otherwise.
 * Both consume identical Scene trees, so your composition code never changes.
 */
export async function createRenderer(opts: RendererOptions): Promise<Renderer> {
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      return await WebGPURenderer.create(opts);
    } catch {
      // fall through to Canvas2D
    }
  }
  return new Canvas2DRenderer(opts);
}
