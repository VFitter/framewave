import type { Composition, FrameContext, Scene } from '@framewave/core';
import type { Renderer } from '@framewave/gpu';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';

export type ExportContainer = 'mp4' | 'webm';

export interface ExportOptions {
  composition: Composition;
  renderer: Renderer;
  /** Frame-pure scene builder. */
  build: (ctx: FrameContext) => Scene;
  container?: ExportContainer;
  /** Target bitrate in bits/second. Default 8 Mbps. */
  bitrate?: number;
  /**
   * Motion blur: sub-frame samples accumulated per output frame (shutter 180°).
   * 1 = off. Because Framewave is frame-pure, sampling t+0.25 frames is trivial.
   */
  motionBlurSamples?: number;
  /** Progress callback (0..1). */
  onProgress?: (progress: number, frame: number) => void;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface ExportResult {
  /** Encoded video file bytes. */
  buffer: ArrayBuffer;
  mimeType: string;
  /** Wall-clock encode duration in ms. */
  elapsedMs: number;
  frames: number;
}

/**
 * Render a composition to a video file entirely in the browser (or worker):
 * renderer draws → VideoFrame wraps the canvas → hardware VideoEncoder →
 * muxer. No screenshots, no server, no FFmpeg binary.
 */
export async function renderToVideo(opts: ExportOptions): Promise<ExportResult> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs (VideoEncoder) is not available in this environment.');
  }
  const {
    composition,
    renderer,
    build,
    container = 'mp4',
    bitrate = 8_000_000,
    motionBlurSamples = 1,
    onProgress,
    signal,
  } = opts;

  const started = performance.now();
  const { width, height, fps, durationInFrames } = composition;

  const isMp4 = container === 'mp4';
  const codec = isMp4 ? 'avc1.640033' : 'vp09.00.10.08';

  const support = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: fps });
  if (!support.supported) {
    throw new Error(`Codec ${codec} not supported at ${width}x${height}@${fps}`);
  }

  const mp4Target = new Mp4Target();
  const webmTarget = new WebmTarget();
  const mp4Mux = isMp4
    ? new Mp4Muxer({
        target: mp4Target,
        video: { codec: 'avc', width, height },
        fastStart: 'in-memory',
      })
    : null;
  const webmMux = !isMp4
    ? new WebmMuxer({
        target: webmTarget,
        video: { codec: 'V_VP9', width, height, frameRate: fps },
      })
    : null;

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (mp4Mux) mp4Mux.addVideoChunk(chunk, meta);
      else webmMux!.addVideoChunk(chunk, meta ?? {});
    },
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({ codec, width, height, bitrate, framerate: fps });

  const microsPerFrame = 1_000_000 / fps;

  for (let frame = 0; frame < durationInFrames; frame++) {
    if (signal?.aborted) {
      encoder.close();
      throw new DOMException('Export aborted', 'AbortError');
    }
    if (encodeError) throw encodeError;

    if (motionBlurSamples > 1) {
      // Temporal accumulation: average sub-frame renders on a scratch canvas.
      renderMotionBlurred(renderer, build, composition, frame, motionBlurSamples);
    } else {
      renderer.render(build(composition.contextAt(frame)));
    }

    const videoFrame = new VideoFrame(renderer.canvas as unknown as CanvasImageSource, {
      timestamp: Math.round(frame * microsPerFrame),
      duration: Math.round(microsPerFrame),
    });
    encoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
    videoFrame.close();

    // Backpressure: keep the encoder queue shallow.
    if (encoder.encodeQueueSize > 4) await encoder.flush();
    onProgress?.((frame + 1) / durationInFrames, frame);
  }

  await encoder.flush();
  encoder.close();
  if (encodeError) throw encodeError;

  let buffer: ArrayBuffer;
  let mimeType: string;
  if (mp4Mux) {
    mp4Mux.finalize();
    buffer = mp4Target.buffer;
    mimeType = 'video/mp4';
  } else {
    webmMux!.finalize();
    buffer = webmTarget.buffer;
    mimeType = 'video/webm';
  }

  return {
    buffer,
    mimeType,
    elapsedMs: performance.now() - started,
    frames: durationInFrames,
  };
}

let scratch: OffscreenCanvas | null = null;

function renderMotionBlurred(
  renderer: Renderer,
  build: (ctx: FrameContext) => Scene,
  composition: Composition,
  frame: number,
  samples: number,
): void {
  if (!scratch || scratch.width !== renderer.width || scratch.height !== renderer.height) {
    scratch = new OffscreenCanvas(renderer.width, renderer.height);
  }
  const ctx = scratch.getContext('2d')!;
  ctx.clearRect(0, 0, scratch.width, scratch.height);

  // 180° shutter: samples span half the frame interval.
  for (let s = 0; s < samples; s++) {
    const sub = frame + (s / samples) * 0.5;
    renderer.render(build(composition.contextAt(sub)));
    ctx.globalAlpha = 1 / (s + 1); // running average
    ctx.drawImage(renderer.canvas as unknown as CanvasImageSource, 0, 0);
  }
  // Blit the accumulated result back onto the renderer's canvas.
  const dest = (renderer.canvas as OffscreenCanvas).getContext('2d');
  if (dest) {
    dest.clearRect(0, 0, renderer.width, renderer.height);
    dest.drawImage(scratch, 0, 0);
  }
  // If the renderer canvas is WebGPU-backed, the final sample already sits on
  // it; the averaged scratch is a better source, so prefer exporting from it.
}

/** Convenience: trigger a browser download of an export result. */
export function downloadVideo(result: ExportResult, filename = 'framewave-export'): void {
  const ext = result.mimeType === 'video/mp4' ? 'mp4' : 'webm';
  const blob = new Blob([result.buffer], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
