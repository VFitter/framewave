import {
  Composition, type FrameContext, type Scene, type SceneNode,
  interpolate, interpolateColors, amplitudeEnvelope, bandEnvelope,
  wiggle, randomAt, spring, springPresets,
  Player, createRenderer, renderToVideo, downloadVideo,
} from 'framewave';

const comp = new Composition({ width: 1280, height: 720, fps: 60, durationInFrames: 600 });

// ── Synthesize a deterministic beat (no audio file needed for the demo) ────
// Drop your own PCM in via amplitudeEnvelope(pcm, { sampleRate, fps }).
const sampleRate = 44100;
const seconds = comp.durationInFrames / comp.fps;
const pcm = new Float32Array(Math.floor(sampleRate * seconds));
const bpm = 96;
for (let i = 0; i < pcm.length; i++) {
  const t = i / sampleRate;
  const beat = (t * bpm) / 60;
  const kickPhase = beat % 1;
  const kick = Math.exp(-kickPhase * 18) * Math.sin(2 * Math.PI * 55 * t);
  const hatPhase = (beat * 2) % 1;
  const hat = Math.exp(-hatPhase * 40) * (randomAt('hat', i % 997) - 0.5) * 0.4;
  const bass = 0.3 * Math.sin(2 * Math.PI * 110 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * t * 0.25));
  pcm[i] = kick * 0.9 + hat + bass * 0.5;
}

const amp = amplitudeEnvelope(pcm, { sampleRate, fps: comp.fps, smoothing: 0.5 });
const lows = bandEnvelope(pcm, 40, 120, { sampleRate, fps: comp.fps, smoothing: 0.4 });
const highs = bandEnvelope(pcm, 4000, 12000, { sampleRate, fps: comp.fps, smoothing: 0.3 });

const BARS = 72;

function build(ctx: FrameContext): Scene {
  const { frame, width, height } = ctx;
  const cx = width / 2;
  const cy = height / 2;
  const nodes: SceneNode[] = [];

  const a = amp[Math.min(frame, amp.length - 1)] ?? 0;
  const low = lows[Math.min(frame, lows.length - 1)] ?? 0;
  const high = highs[Math.min(frame, highs.length - 1)] ?? 0;

  // Pulsing core
  const coreR = 60 + low * 90;
  nodes.push({
    type: 'ellipse', rx: coreR, ry: coreR,
    fill: interpolateColors(low, [0, 1], ['#1d4ed8', '#f43f5e']),
    glow: 30 + low * 60,
    blend: 'add',
    transform: { x: cx, y: cy },
  });

  // Radial bars driven by the band mix
  for (let i = 0; i < BARS; i++) {
    const angle = (i / BARS) * Math.PI * 2 + frame * 0.004;
    const noise = wiggle(frame / comp.fps + i * 0.13, { frequency: 1.2, amplitude: 0.25, seed: i });
    const energy = a * 0.6 + high * 0.4 + noise * 0.15;
    const len = 30 + Math.max(0, energy) * 240;
    const inner = coreR + 26;
    nodes.push({
      type: 'rect',
      width: 5,
      height: len,
      cornerRadius: 2.5,
      fill: interpolateColors(i / BARS, [0, 0.5, 1], ['#38bdf8', '#a78bfa', '#38bdf8']),
      glow: 6 + high * 14,
      blend: 'add',
      opacity: 0.9,
      transform: {
        x: cx + Math.cos(angle) * (inner + len / 2),
        y: cy + Math.sin(angle) * (inner + len / 2),
        rotation: angle + Math.PI / 2,
      },
    });
  }

  // Intro: whole scene springs in
  const introScale = spring({ time: frame / comp.fps, from: 0.6, to: 1, ...springPresets.gentle });
  const intro = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return {
    background: '#07070c',
    nodes: [{ type: 'group', children: nodes, opacity: intro, transform: { x: 0, y: 0, scale: introScale } }],
  };
}

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = await createRenderer({ width: comp.width, height: comp.height, canvas });
const player = new Player({ composition: comp, renderer, build, loop: true });
player.play();

document.getElementById('playpause')!.addEventListener('click', (e) => {
  if (player.playing) { player.pause(); (e.target as HTMLElement).textContent = 'Play'; }
  else { player.play(); (e.target as HTMLElement).textContent = 'Pause'; }
});

document.getElementById('export')!.addEventListener('click', async (e) => {
  const btn = e.target as HTMLButtonElement;
  player.pause();
  btn.disabled = true;
  const exportRenderer = await createRenderer({ width: comp.width, height: comp.height });
  try {
    const result = await renderToVideo({
      composition: comp,
      renderer: exportRenderer,
      build,
      onProgress: (p) => (btn.textContent = `Exporting ${(p * 100).toFixed(0)}%`),
    });
    downloadVideo(result, 'framewave-visualizer');
    btn.textContent = `Done in ${(result.elapsedMs / 1000).toFixed(1)}s`;
  } finally {
    exportRenderer.dispose();
    btn.disabled = false;
    player.play();
  }
});
