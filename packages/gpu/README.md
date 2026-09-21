# @framewave/gpu

The WebGPU and Canvas2D rendering layer for [Framewave](https://github.com/VFitter/framewave).

It renders Framewave scene trees with a WebGPU backend when available and an automatic Canvas2D fallback. The package includes instanced SDF shapes, text and image nodes, glow, additive blending, and the shared renderer interface used by the player and export pipeline.

```bash
npm install @framewave/core @framewave/gpu
```

```ts
import { createRenderer } from '@framewave/gpu';

const renderer = await createRenderer({ width: 1280, height: 720, canvas });
await renderer.render(scene);
```

Try the [interactive demos](https://vfitter.github.io/framewave/) or read the [monorepo documentation](https://github.com/VFitter/framewave).

MIT licensed.
