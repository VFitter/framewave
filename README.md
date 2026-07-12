# Framewave

**GPU-first, deterministic motion graphics for the web.** WebGPU rendering, WebCodecs export, analytic animation math — no headless browser, no FFmpeg binary, no per-seat license.

[![CI](https://github.com/VFitter/framewave/actions/workflows/ci.yml/badge.svg)](https://github.com/VFitter/framewave/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

```ts
import { Composition, spring, textAnimator, createRenderer, renderToVideo } from 'framewave';

const comp = new Composition({ width: 1920, height: 1080, fps: 60, durationInFrames: 300 });
const title = textAnimator('HELLO', { each: 3, from: 'center' });

const build = ({ frame, fps }) => ({
  background: '#0a0a0f',
  nodes: title.units.map((u) => ({
    type: 'text', text: u.text, fontSize: 120, fill: '#7dd3fc',
    transform: {
      x: 660 + u.index * 150,
      y: 540 + spring({ time: title.localTime(u.index, frame) / fps, from: 120, to: 0 }),
    },
  })),
});

const renderer = await createRenderer({ width: 1920, height: 1080 });
const { buffer } = await renderToVideo({ composition: comp, renderer, build }); // → MP4 bytes
```

That's a springing kinetic title exported to MP4 — entirely in the browser, hardware-encoded.

## Why Framewave

Tools like Remotion proved that video-as-code is the right idea. Framewave rethinks the execution:

| | Remotion | **Framewave** |
|---|---|---|
| Rendering | Headless-Chrome screenshots, frame by frame | **WebGPU draws → WebCodecs hardware encoder** (Canvas2D fallback) |
| Export | Server / Lambda render farm | **Entirely client-side** — the browser is the render farm |
| Springs | Step-integrated (must simulate from t=0) | **Closed-form analytic** — frame 900 costs the same as frame 0 |
| Color blending | sRGB lerp (muddy midpoints) | **OKLab perceptual interpolation** |
| Motion paths | DIY bezier math | **Arc-length parameterized** — constant speed, tangent orientation |
| Choreography | `interpolate()` + manual math | Staggers, text animators, keyframe tracks, deterministic `wiggle()` |
| Audio reactivity | External tooling | Built-in: RMS/band envelopes, onset detection — frame-pure |
| Motion blur | Frame-stack approximation add-on | Temporal supersampling in the export pipeline (180° shutter) |
| Framework | React required | **Framework-agnostic core** (React adapter on the roadmap) |
| License | Paid for companies of 4+ | **MIT. Free for everyone, forever** |

### The core idea: frame-purity

Every Framewave composition is a pure function `(frame) → scene`. No wall-clock time, no
integration state, no hidden randomness — seeded PRNG, analytic springs, precomputed audio
features. Consequences:

- **Any frame renders independently** → parallel and distributed rendering are trivial.
- **Preview === export**, bit for bit. What you scrub is what you ship.
- **Deterministic across machines** — same seed, same pixels, CI-diffable.

## Packages

| Package | What it is |
|---|---|
| `framewave` | Umbrella: everything below + real-time `Player` |
| `@framewave/core` | Timeline, easing (30+), analytic springs, keyframe tracks, staggers, motion paths, text animators, OKLab color, audio analysis, seeded noise |
| `@framewave/gpu` | WebGPU renderer (instanced SDF shapes, glow, additive blending) + Canvas2D fallback — same scene tree |
| `@framewave/export` | WebCodecs encode pipeline → MP4 (H.264) / WebM (VP9), with progress, abort, and temporal motion blur |

## Quick start

```bash
git clone https://github.com/VFitter/framewave
cd framewave && npm install
npm test            # 32 unit tests on the animation math
cd examples && npm install && npm run dev
```

Three demos ship in `examples/`:

- **Kinetic typography** — center-out spring staggers, OKLab color sweeps, idle wiggle
- **Audio visualizer** — synthesized beat → band envelopes → radial GPU bars (swap in your own PCM)
- **Logo reveal** — comet on an arc-length motion path, particle trail, shockwave, MP4 export button

## API highlights

```ts
// Analytic springs — evaluate ANY time in O(1)
spring({ time: t, from: 0, to: 100, ...springPresets.wobbly });

// Interpolation with wrap/mirror extrapolation (loops for free)
interpolate(frame, [0, 60], [0, 360], { extrapolateRight: 'wrap' });

// Perceptual color — no muddy midpoints
interpolateColors(t, [0, 1], ['#1d4ed8', '#f43f5e']);

// Constant-speed motion along curves, with tangent orientation
const s = path.at(progress); // { point, tangent, angle }

// AE-style text animators
const anim = textAnimator('FRAMEWAVE', { each: 3, from: 'center' });

// Deterministic wiggle (pure function of seed + time)
wiggle(time, { frequency: 2, amplitude: 10, seed: 'cam-shake' });

// Audio → motion, frame-pure
const kick = bandEnvelope(pcm, 40, 120, { sampleRate, fps });
```

## Browser support

- **Rendering**: WebGPU (Chrome/Edge 113+, Safari 26+, Firefox 141+) with automatic Canvas2D fallback everywhere else.
- **Export**: WebCodecs (Chrome/Edge 94+, Safari 16.4+, Firefox 130+).

## Roadmap

- [ ] React + Vue adapters (`useFrame()` hooks over the pure core)
- [ ] Path/shape morphing & trim paths
- [ ] SVG + Lottie import
- [ ] Worker-pool parallel export (frame-purity makes this embarrassingly parallel)
- [ ] Post-processing stack: bloom, chromatic aberration, film grain, LUTs (WGSL)
- [ ] Visual timeline inspector (scrub, curve editor) on top of the code-first core
- [ ] Node.js headless export via `node-webgpu`

## Contributing

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). The bar for the core is: pure,
deterministic, tested.

## License

[MIT](./LICENSE) — including for teams and companies of any size.
