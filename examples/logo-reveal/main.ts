import {
  Composition, type FrameContext, type Scene, type SceneNode,
  MotionPath, spring, springPresets, interpolate, interpolateColors,
  stagger, randomAt, easeInOutCubic,
  Player, createRenderer, renderToVideo, downloadVideo,
} from 'framewave';

const comp = new Composition({ width: 1280, height: 720, fps: 60, durationInFrames: 240 });

// A comet rides this curve — sampled by ARC LENGTH, so speed is constant.
const path = new MotionPath()
  .moveTo(-100, 560)
  .cubicTo(300, 700, 380, 180, 640, 330)
  .cubicTo(900, 480, 1000, 200, 1380, 160);

const PARTICLES = 26;

function build(ctx: FrameContext): Scene {
  const { frame, fps, width, height } = ctx;
  const nodes: SceneNode[] = [];

  const travel = interpolate(frame, [0, 150], [0, 1], {
    easing: easeInOutCubic,
    extrapolateRight: 'clamp',
  });

  // Particle trail behind the comet
  for (let i = 0; i < PARTICLES; i++) {
    const lag = (i + 1) * 0.012;
    const u = Math.max(0, travel - lag);
    const s = path.at(u);
    const size = interpolate(i, [0, PARTICLES - 1], [10, 1.5]);
    const drift = (randomAt('drift', i) - 0.5) * i * 1.6;
    nodes.push({
      type: 'ellipse', rx: size, ry: size,
      fill: interpolateColors(i / PARTICLES, [0, 1], ['#fbbf24', '#dc2626']),
      glow: 14, blend: 'add',
      opacity: (1 - i / PARTICLES) * (travel > 0.01 ? 1 : 0) * (1 - travel * 0.6),
      transform: { x: s.point.x - s.tangent.x * i * 3, y: s.point.y - s.tangent.y * i * 3 + drift },
    });
  }

  // The comet head, oriented along the path tangent
  const head = path.at(travel);
  nodes.push({
    type: 'ellipse', rx: 14, ry: 9,
    fill: '#fef3c7', glow: 36, blend: 'add',
    opacity: 1 - Math.max(0, travel - 0.94) * 16,
    transform: { x: head.point.x, y: head.point.y, rotation: head.angle },
  });

  // Impact: logo mark assembles when the comet lands
  const impactFrame = 150;
  const t = Math.max(0, frame - impactFrame) / fps;
  const blocks = 5;
  for (let i = 0; i < blocks; i++) {
    const delay = stagger(i, blocks, { each: 0.05, from: 'center' });
    const bt = Math.max(0, t - delay);
    const s = spring({ time: bt, from: 0, to: 1, ...springPresets.wobbly });
    const barH = 26 + Math.abs(i - 2) * -4 + 34; // wave silhouette
    nodes.push({
      type: 'rect',
      width: 26, height: barH * (0.5 + 0.5 * Math.cos((i - 2) * 0.7)),
      cornerRadius: 8,
      fill: interpolateColors(i / (blocks - 1), [0, 1], ['#38bdf8', '#a78bfa']),
      glow: 16 * s,
      opacity: Math.min(1, bt * 8),
      transform: { x: width / 2 + (i - 2) * 38, y: height / 2 - 20, scale: s },
    });
  }

  // Wordmark fades up
  const wt = Math.max(0, frame - impactFrame - 18) / fps;
  nodes.push({
    type: 'text', text: 'FRAMEWAVE', fontSize: 56, fontWeight: 800,
    fill: '#f1f5f9',
    opacity: interpolate(wt, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
    transform: {
      x: width / 2,
      y: height / 2 + 78 + spring({ time: wt, from: 24, to: 0, ...springPresets.gentle }),
    },
  });

  // Shockwave ring on impact
  if (frame >= impactFrame) {
    const ringR = spring({ time: t, from: 10, to: 320, stiffness: 60, damping: 18 });
    nodes.push({
      type: 'ellipse', rx: ringR, ry: ringR * 0.62,
      fill: 'rgba(125, 211, 252, 0.06)',
      glow: 40, blend: 'add',
      opacity: Math.max(0, 0.9 - t * 1.4),
      transform: { x: width / 2, y: height / 2 },
    });
  }

  return { background: '#07070c', nodes };
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
      motionBlurSamples: 4,
      onProgress: (p) => (btn.textContent = `Exporting ${(p * 100).toFixed(0)}%`),
    });
    downloadVideo(result, 'framewave-logo-reveal');
    btn.textContent = `Done in ${(result.elapsedMs / 1000).toFixed(1)}s`;
  } finally {
    exportRenderer.dispose();
    btn.disabled = false;
    player.play();
  }
});
