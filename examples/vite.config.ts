import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const p = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

// Examples run straight from source — no build step needed.
export default defineConfig({
  resolve: {
    alias: {
      '@framewave/core': p('../packages/core/src/index.ts'),
      '@framewave/gpu': p('../packages/gpu/src/index.ts'),
      '@framewave/export': p('../packages/export/src/index.ts'),
      framewave: p('../packages/framewave/src/index.ts'),
    },
  },
  build: {
    target: 'esnext', // demos use top-level await
    rollupOptions: {
      input: {
        main: p('./index.html'),
        typography: p('./kinetic-typography/index.html'),
        visualizer: p('./audio-visualizer/index.html'),
        logo: p('./logo-reveal/index.html'),
      },
    },
  },
});
