# Contributing to Framewave

Thanks for helping build the motion engine the web deserves.

## Ground rules

1. **Frame-purity is non-negotiable.** Anything in `@framewave/core` must be a pure
   function of its inputs: no `Date.now()`, no `Math.random()` (use `createRandom`/`randomAt`),
   no mutable module state that affects output.
2. **Math ships with tests.** New animation primitives need unit tests that pin down
   behavior (endpoints, monotonicity, determinism, edge cases).
3. **Renderer parity.** New scene-node features should work in both the WebGPU and
   Canvas2D backends, or degrade gracefully with a documented note.

## Dev setup

```bash
npm install
npm run typecheck   # strict TS across all packages
npm test            # vitest
cd examples && npm install && npm run dev   # visual smoke test
```

## Project layout

- `packages/core` — timeline, animation math, scene graph, text/audio/color utilities
- `packages/gpu` — WebGPU renderer (WGSL in `src/shaders/`), Canvas2D fallback
- `packages/export` — WebCodecs encode pipeline + muxing
- `packages/framewave` — umbrella + Player
- `examples/` — Vite demos running straight from source

## PR checklist

- [ ] `npm run typecheck` and `npm test` pass
- [ ] New public APIs are exported from the package index and documented with TSDoc
- [ ] Determinism preserved (seeded randomness only)
- [ ] Example updated or added if the feature is user-visible

## Releasing

Maintainers publish from `main` only after CI and the package-consumer smoke test are green. Follow the [package publication checklist](./docs/PUBLISHING.md); do not publish the umbrella package before its three internal dependencies are available at the same version.
