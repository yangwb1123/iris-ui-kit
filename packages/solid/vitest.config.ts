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
    globals: false,
    isolate: true,
  },
})
