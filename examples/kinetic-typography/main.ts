import {
  Composition, type FrameContext, type Scene, type SceneNode,
  spring, springPresets, interpolate, interpolateColors,
  textAnimator, wiggle, easeOutCubic,
  Player, createRenderer, renderToVideo, downloadVideo,
} from 'framewave';

const comp = new Composition({ width: 1280, height: 720, fps: 60, durationInFrames: 300 });

const TITLE = 'FRAMEWAVE';
const anim = textAnimator(TITLE, { each: 4, from: 'center' });
const SUB = 'motion, engineered';
const subAnim = textAnimator(SUB, { each: 1.5, from: 'first' });

function build(ctx: FrameContext): Scene {
  const { frame, fps, width, height } = ctx;
  const nodes: SceneNode[] = [];

  // Title characters: spring up from below, center-out stagger
  const charW = 92;
  const startX = width / 2 - ((anim.units.length - 1) * charW) / 2;
  for (const u of anim.units) {
    const t = anim.localTime(u.index, frame) / fps;
    const y = spring({ time: t, from: 140, to: 0, ...springPresets.wobbly });
    const scale = spring({ time: t, from: 0.3, to: 1, ...springPresets.default });
    const opacity = interpolate(t, [0, 0.25], [0, 1], { extrapolateRight: 'clamp' });
    const idleWiggle = wiggle(frame / fps, { frequency: 0.7, amplitude: 4, seed: u.index });
    const color = interpolateColors(
      (u.index / (anim.units.length - 1) + frame / 240) % 1,
      [0, 0.5, 1],
      ['#65d6ff', '#c084fc', '#65d6ff'],
    );
    nodes.push({
      type: 'text',
      text: u.text,
      fontSize: 110,
      fontWeight: 800,
      fill: color,
      opacity,
      transform: { x: startX + u.index * charW, y: height / 2 - 30 + y + idleWiggle },
    });
  }

  // Subtitle: fade/slide in after the title settles
  const subStart = 70;
  for (const u of subAnim.units) {
    const t = Math.max(0, frame - subStart - subAnim.delay(u.index)) / fps;
    const opacity = interpolate(t, [0, 0.3], [0, 0.85], { extrapolateRight: 'clamp' });
    const x = interpolate(t, [0, 0.5], [14, 0], { easing: easeOutCubic, extrapolateRight: 'clamp' });
    nodes.push({
      type: 'text',
      text: u.text,
      fontSize: 30,
      fontWeight: 400,
      fill: '#9aa3b2',
      opacity,
      transform: {
        x: width / 2 - ((subAnim.units.length - 1) * 17) / 2 + u.index * 17 + x,
        y: height / 2 + 80,
      },
    });
  }

  // Accent line that draws itself under the title
  const lineT = Math.max(0, frame - 55) / fps;
  const lineW = spring({ time: lineT, from: 0, to: 420, ...springPresets.gentle });
  nodes.push({
    type: 'rect',
    width: Math.max(1, lineW),
    height: 3,
    fill: '#65d6ff',
    glow: 12,
    cornerRadius: 2,
    opacity: interpolate(lineT, [0, 0.2], [0, 1], { extrapolateRight: 'clamp' }),
    transform: { x: width / 2, y: height / 2 + 38 },
  });

  return { background: '#0a0a0f', nodes };
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
    downloadVideo(result, 'framewave-typography');
    btn.textContent = `Done in ${(result.elapsedMs / 1000).toFixed(1)}s`;
  } finally {
    exportRenderer.dispose();
    btn.disabled = false;
    player.play();
  }
});
