# @framewave/core

The framework-agnostic, frame-pure animation core for [Framewave](https://github.com/VFitter/framewave).

It includes analytic springs, interpolation and easing, keyframe tracks, deterministic randomness, staggers, text animators, motion paths, OKLab colour utilities, audio analysis, and the scene types shared by Framewave renderers.

```bash
npm install @framewave/core
```

```ts
import { interpolateColors, spring, springPresets } from '@framewave/core';

const y = spring({ time: 0.4, from: 120, to: 0, ...springPresets.wobbly });
const colour = interpolateColors(0.5, [0, 1], ['#38bdf8', '#c084fc']);
```

Every primitive is deterministic for the same inputs. See the [documentation and interactive demos](https://vfitter.github.io/framewave/) or the [monorepo](https://github.com/VFitter/framewave) for complete examples.

MIT licensed.
