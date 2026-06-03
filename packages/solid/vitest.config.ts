import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// Solid under vitest: the solid plugin auto-configures the transform; the
// `development`/`browser` resolve conditions + a single (non-isolated) module
// instance avoid the classic "solid-js loaded twice" reactivity bug.
export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    isolate: false,
  },
})
