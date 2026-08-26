import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// Solid under vitest: the solid plugin auto-configures the transform; the
// `development`/`browser` resolve conditions keep a single solid-js instance
// per worker (avoiding the classic "loaded twice" reactivity bug). Per-file
// isolation is ON so each test file gets a fresh module/owner registry —
// without it, files sharing a worker leak Solid reactive-owner state across
// each other (e.g. a `renderHook`-in-render component silently loses
// reactivity once any predecessor file has run in the same worker), which
// makes the suite order-/packing-sensitive and flaky.
export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // The hydration / SSR test must run under the dedicated SSR config
    // (`vitest.ssr.config.ts`: server resolve condition + `generate: 'ssr'`).
    // Under this default (browser-condition, DOM-compiled) config
    // `renderToString` is an unsupported stub, so exclude it here.
    exclude: [
      'src/hydration.test.tsx',
      'src/primitives/table/batch-ft.ssr.test.tsx',
      '**/node_modules/**',
      '**/dist/**',
    ],
    globals: false,
    isolate: true,
  },
})
