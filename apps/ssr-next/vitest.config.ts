import { defineConfig } from 'vitest/config'

// jsdom is required: the app-level hydration test calls `hydrateRoot`, which
// needs a live `document`/`window`. This mirrors packages/react/vitest.config.ts
// so the same renderToString -> hydrate pattern runs here at the APP level
// against the app's actual iris-component composition.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['app/**/*.test.{ts,tsx}'],
    globals: false,
  },
  esbuild: {
    jsx: 'automatic',
  },
})
