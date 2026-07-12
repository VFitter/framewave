/**
 * Motivd promo — "Your words. Working software."
 * A real-world brand piece built on Framewave: springs, staggers, OKLab
 * sweeps, wiggle, motion paths. 1920x1080 @ 30fps, 16s. Frame-pure.
 */
import {
  Composition, type FrameContext, type Scene, type SceneNode,
  spring, springPresets, interpolate, interpolateColors,
  textAnimator, stagger, wiggle, randomAt,
  easeOutCubic, easeInOutCubic,
  MotionPath,
} from '@framewave/core';

export const composition = new Composition({
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 480,
  id: 'motivd-promo',
});

// ── Motivd brand ────────────────────────────────────────────────────────────
const YELLOW = '#E7F900';
const BLUE = '#5170ff';
const BG = '#0b0b10';
const CARD = '#171722';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';

const wordmark = textAnimator('MOTIVD', { each: 3, from: 'center' });

const FEATURES = [
  { title: 'Describe it', sub: 'Plain words. Any language.' },
  { title: 'Watch it build', sub: 'AI agents write, test, fix.' },
  { title: 'Ship everywhere', sub: 'One source → every app store.' },
];

const orbit = new MotionPath()
  .moveTo(-260, 0)
  .cubicTo(-260, -145, 260, -145, 260, 0)
  .cubicTo(260, 145, -260, 145, -260, 0);

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const fadeIn = (t: number, dur = 0.3): number =>
  interpolate(t, [0, dur], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

export function build(ctx: FrameContext): Scene {
  const { frame, fps, width, height } = ctx;
  const cx = width / 2;
  const cy = height / 2;
  const nodes: SceneNode[] = [];

  // ── Ambient background: drifting glow orbs ────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const ox = cx + (randomAt('orb-x', i) - 0.5) * width * 0.9 + wiggle(frame / fps, { frequency: 0.08, amplitude: 60, seed: `ox${i}` });
    const oy = cy + (randomAt('orb-y', i) - 0.5) * height * 0.9 + wiggle(frame / fps, { frequency: 0.06, amplitude: 40, seed: `oy${i}` });
    nodes.push({
      type: 'ellipse', rx: 190 + i * 40, ry: 190 + i * 40,
      fill: i % 2 === 0 ? 'rgba(81, 112, 255, 0.05)' : 'rgba(231, 249, 0, 0.03)',
      glow: 120, blend: 'add', opacity: 0.8,
      transform: { x: ox, y: oy },
    });
  }

  // ═══ BEAT 1 (0–75): wordmark springs in, center-out ═══
  const beat1Out = interpolate(frame, [66, 78], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (beat1Out > 0) {
    const charW = 150;
    const startX = cx - ((wordmark.units.length - 1) * charW) / 2;
    const wordNodes: SceneNode[] = [];
    for (const u of wordmark.units) {
      const t = wordmark.localTime(u.index, frame) / fps;
      const y = spring({ time: t, from: 220, to: 0, ...springPresets.wobbly });
      const sc = spring({ time: t, from: 0.4, to: 1, ...springPresets.default });
      wordNodes.push({
        type: 'text', text: u.text, fontSize: 180, fontWeight: 800, fill: YELLOW,
        opacity: fadeIn(t, 0.2),
        transform: { x: startX + u.index * charW, y: cy - 40 + y, scale: sc },
      });
    }
    const lineT = Math.max(0, frame - 26) / fps;
    wordNodes.push({
      type: 'rect', width: Math.max(1, spring({ time: lineT, from: 0, to: 760, ...springPresets.gentle })),
      height: 6, cornerRadius: 3, fill: BLUE, glow: 18,
      opacity: fadeIn(lineT, 0.2),
      transform: { x: cx, y: cy + 92 },
    });
    const subT = Math.max(0, frame - 34) / fps;
    wordNodes.push({
      type: 'text', text: 'human ⇄ computer, no translation needed', fontSize: 40, fontWeight: 400,
      fill: MUTED, opacity: fadeIn(subT, 0.4) * 0.95,
      transform: { x: cx, y: cy + 165 + spring({ time: subT, from: 26, to: 0, ...springPresets.gentle }) },
    });
    nodes.push({ type: 'group', children: wordNodes, opacity: beat1Out });
  }

  // ═══ BEAT 2 (78–165): tagline ═══
  if (frame >= 78 && frame < 172) {
    const t = (frame - 78) / fps;
    const out = interpolate(frame, [158, 170], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const lines = ['Your words.', 'Working software.'];
    const tagNodes: SceneNode[] = lines.map((line, i) => {
      const lt = Math.max(0, t - i * 0.35);
      return {
        type: 'text' as const, text: line, fontSize: 130, fontWeight: 800,
        fill: i === 0 ? TEXT : YELLOW,
        opacity: fadeIn(lt, 0.35),
        transform: {
          x: cx,
          y: cy - 80 + i * 170 + spring({ time: lt, from: 90, to: 0, ...springPresets.default }),
        },
      };
    });
    nodes.push({ type: 'group', children: tagNodes, opacity: out });
  }

  // ═══ BEAT 3 (172–345): three feature cards ═══
  if (frame >= 172 && frame < 352) {
    const out = interpolate(frame, [338, 350], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const cardW = 480;
    const gap = 60;
    const rowX = cx - cardW - gap;
    const cardNodes: SceneNode[] = [];

    FEATURES.forEach((f, i) => {
      const delay = stagger(i, FEATURES.length, { each: 0.22 });
      const t = Math.max(0, (frame - 176) / fps - delay);
      const rise = spring({ time: t, from: 340, to: 0, ...springPresets.default });
      const sc = spring({ time: t, from: 0.85, to: 1, ...springPresets.gentle });
      const x = rowX + i * (cardW + gap);
      const inner: SceneNode[] = [
        { type: 'rect', width: cardW, height: 560, cornerRadius: 28, fill: CARD, glow: 0 },
        { type: 'rect', width: cardW, height: 6, cornerRadius: 3, fill: i === 1 ? BLUE : YELLOW, glow: 14, transform: { y: -277 } },
        { type: 'text', text: f.title, fontSize: 52, fontWeight: 700, fill: TEXT, transform: { y: 110 } },
        { type: 'text', text: f.sub, fontSize: 30, fontWeight: 400, fill: MUTED, transform: { y: 175 } },
      ];

      // Per-card animated illustration (frame-pure micro-scenes)
      const it = Math.max(0, t - 0.25);
      if (i === 0) {
        // Chat bubbles typing
        for (let b = 0; b < 3; b++) {
          const bt = Math.max(0, it - b * 0.4);
          const w = interpolate(bt, [0, 0.5], [0, [220, 300, 180][b]!], { easing: easeOutCubic, extrapolateRight: 'clamp' });
          cardNodes.length; // keep TS quiet about unused
          inner.push({
            type: 'rect', width: Math.max(1, w), height: 44, cornerRadius: 22,
            fill: b % 2 === 0 ? 'rgba(231,249,0,0.16)' : 'rgba(81,112,255,0.22)',
            opacity: fadeIn(bt, 0.2),
            transform: { x: (b % 2 === 0 ? -1 : 1) * 60, y: -170 + b * 70 },
          });
        }
      } else if (i === 1) {
        // Build bars filling + blinking cursor block
        for (let b = 0; b < 4; b++) {
          const bt = Math.max(0, it - b * 0.3);
          const target = [300, 240, 330, 190][b]!;
          const w = interpolate(bt, [0, 0.7], [0, target], { easing: easeInOutCubic, extrapolateRight: 'clamp' });
          inner.push({
            type: 'rect', width: Math.max(1, w), height: 22, cornerRadius: 11,
            fill: b === 3 ? BLUE : 'rgba(241,245,249,0.25)', glow: b === 3 ? 10 : 0,
            opacity: fadeIn(bt, 0.15),
            transform: { x: -170 + w / 2, y: -195 + b * 52 },
          });
        }
        const blink = interpolate(frame % 20, [0, 9, 10, 19], [1, 1, 0.15, 0.15]);
        inner.push({
          type: 'rect', width: 20, height: 34, cornerRadius: 3, fill: YELLOW, glow: 8,
          opacity: blink * clamp01(it * 2),
          transform: { x: -160, y: 10 },
        });
      } else {
        // Store dots orbiting on a motion path — constant speed via arc length
        for (let d = 0; d < 6; d++) {
          const u = ((frame / fps) * 0.12 + d / 6) % 1;
          const s = orbit.at(u);
          inner.push({
            type: 'ellipse', rx: 16, ry: 16,
            fill: d % 2 === 0 ? YELLOW : BLUE, glow: 16, blend: 'add',
            opacity: clamp01(it * 2) * 0.95,
            transform: { x: s.point.x * 0.55, y: -80 + s.point.y * 0.55 },
          });
        }
        inner.push({
          type: 'ellipse', rx: 46, ry: 46, fill: 'rgba(241,245,249,0.9)', glow: 20,
          opacity: clamp01(it * 2),
          transform: { y: -80 },
        });
      }

      cardNodes.push({
        type: 'group', children: inner,
        opacity: fadeIn(t, 0.25),
        transform: { x, y: cy + 40 + rise, scale: sc },
      });
    });

    const headT = Math.max(0, frame - 172) / fps;
    cardNodes.push({
      type: 'text', text: 'From intent to app store — one flow', fontSize: 56, fontWeight: 700, fill: TEXT,
      opacity: fadeIn(headT, 0.3),
      transform: { x: cx, y: 150 + spring({ time: headT, from: 40, to: 0, ...springPresets.gentle }) },
    });
    nodes.push({ type: 'group', children: cardNodes, opacity: out });
  }

  // ═══ BEAT 4 (352–480): CTA ═══
  if (frame >= 352) {
    const t = (frame - 352) / fps;
    const ctaNodes: SceneNode[] = [];

    // Shockwave ring
    const ringR = spring({ time: t, from: 20, to: 560, stiffness: 50, damping: 16 });
    ctaNodes.push({
      type: 'ellipse', rx: ringR, ry: ringR * 0.6,
      fill: 'rgba(231, 249, 0, 0.05)', glow: 50, blend: 'add',
      opacity: Math.max(0, 0.8 - t * 0.9),
      transform: { x: cx, y: cy },
    });

    // Comet particles spiraling in
    for (let i = 0; i < 20; i++) {
      const pt = Math.max(0, t - randomAt('cta-d', i) * 0.5);
      const angle = randomAt('cta-a', i) * Math.PI * 2 + pt * 1.4;
      const dist = interpolate(pt, [0, 1.4], [900, 120], { easing: easeOutCubic, extrapolateRight: 'clamp' });
      ctaNodes.push({
        type: 'ellipse', rx: 5 + randomAt('cta-s', i) * 6, ry: 5 + randomAt('cta-s', i) * 6,
        fill: i % 2 === 0 ? YELLOW : BLUE, glow: 14, blend: 'add',
        opacity: fadeIn(pt, 0.2) * 0.7,
        transform: { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist * 0.6 },
      });
    }

    // motivd.com — OKLab sweep between brand colors
    const sweep = interpolateColors((t * 0.4) % 1, [0, 0.5, 1], [YELLOW, BLUE, YELLOW]);
    ctaNodes.push({
      type: 'text', text: 'motivd.com', fontSize: 150, fontWeight: 800, fill: sweep,
      opacity: fadeIn(t, 0.4),
      transform: { x: cx, y: cy - 10 + spring({ time: t, from: 60, to: 0, ...springPresets.default }) },
    });
    const subT = Math.max(0, t - 0.5);
    ctaNodes.push({
      type: 'text', text: 'Build it by saying it.', fontSize: 46, fontWeight: 400, fill: MUTED,
      opacity: fadeIn(subT, 0.4),
      transform: { x: cx, y: cy + 120 + spring({ time: subT, from: 24, to: 0, ...springPresets.gentle }) },
    });
    // End fade
    const endFade = interpolate(frame, [462, 479], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    nodes.push({ type: 'group', children: ctaNodes, opacity: endFade });
  }

  return { background: BG, nodes };
}
