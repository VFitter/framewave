# @framewave/export

The browser video-export pipeline for [Framewave](https://github.com/VFitter/framewave).

It connects a Framewave composition and renderer to WebCodecs, producing MP4 or WebM output with progress reporting, cancellation, and temporal supersampling for motion blur.

```bash
npm install @framewave/core @framewave/gpu @framewave/export
```

```ts
import { renderToVideo } from '@framewave/export';

const result = await renderToVideo({ composition, renderer, build });
```

WebCodecs availability varies by browser and codec. See the [interactive demos](https://vfitter.github.io/framewave/) for a working export example and the [monorepo](https://github.com/VFitter/framewave) for full source.

MIT licensed.
