# framewave

GPU-first, deterministic motion graphics for the web.

`framewave` is the umbrella package: the frame-pure animation core, WebGPU renderer with Canvas2D fallback, browser video export, and real-time player in one install.

```bash
npm install framewave
```

```ts
import { Composition, Player, createRenderer, spring } from 'framewave';

const composition = new Composition({ width: 1280, height: 720, fps: 60, durationInFrames: 300 });
const renderer = await createRenderer({ width: composition.width, height: composition.height, canvas });

const player = new Player({
  composition,
  renderer,
  build: ({ frame, fps }) => ({
    background: '#080910',
    nodes: [{
      type: 'rect',
      width: 160,
      height: 160,
      fill: '#7dd3fc',
      transform: { x: 640, y: 360 + spring({ time: frame / fps, from: 120, to: 0 }) },
    }],
  }),
});

player.play();
```

Explore the [interactive demos](https://vfitter.github.io/framewave/) and [source repository](https://github.com/VFitter/framewave).

MIT licensed.
