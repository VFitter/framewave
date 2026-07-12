/**
 * Headless Node render — proof that frame-purity + renderer-agnostic scenes
 * pay off: the same composition that plays in the browser renders on a server
 * with zero changes. Uses @napi-rs/canvas (Canvas2D-compatible) + ffmpeg.
 *
 *   npx tsx scripts/render-node.mts examples/motivd-promo/scene.ts out.mp4
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Canvas2DRenderer } from '../packages/gpu/src/canvas2d.js';
import type { Composition, FrameContext, Scene } from '../packages/core/src/index.js';

const [, , scenePath, outPath = 'render.mp4'] = process.argv;
if (!scenePath) {
  console.error('Usage: tsx scripts/render-node.mts <scene.ts> [out.mp4]');
  process.exit(1);
}

const mod = (await import(pathToFileURL(resolve(scenePath)).href)) as {
  composition: Composition;
  build: (ctx: FrameContext) => Scene;
};
const { composition, build } = mod;
const { width, height, fps, durationInFrames } = composition;

// @napi-rs/canvas is Canvas2D-API compatible — inject it as the surface.
const canvas = createCanvas(width, height);
const renderer = new Canvas2DRenderer({
  width,
  height,
  canvas: canvas as unknown as OffscreenCanvas,
});

console.log(`Rendering ${durationInFrames} frames @ ${width}x${height} ${fps}fps → ${outPath}`);
console.log(`Fonts available: ${GlobalFonts.families.length} families`);

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'image2pipe',
  '-framerate', String(fps),
  '-i', '-',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  outPath,
], { stdio: ['pipe', 'ignore', 'inherit'] });

const started = Date.now();
for (let frame = 0; frame < durationInFrames; frame++) {
  renderer.render(build(composition.contextAt(frame)));
  const png = canvas.toBuffer('image/png');
  const ok = ffmpeg.stdin.write(png);
  if (!ok) await new Promise<void>((r) => ffmpeg.stdin.once('drain', () => r()));
  if (frame % fps === 0) {
    const pct = ((frame / durationInFrames) * 100).toFixed(0);
    process.stdout.write(`\r${pct}% (frame ${frame}/${durationInFrames})`);
  }
}
ffmpeg.stdin.end();
await new Promise<void>((resolveExit, reject) => {
  ffmpeg.on('close', (code) => (code === 0 ? resolveExit() : reject(new Error(`ffmpeg exited ${code}`))));
});
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\nDone in ${secs}s → ${outPath}`);
