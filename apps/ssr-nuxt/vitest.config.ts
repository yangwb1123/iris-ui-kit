import { defineConfig } from 'vitest/config'

// App-level SSR-hydration test runs in jsdom. We deliberately do NOT pull in
// Nuxt's vite/router/auto-import machinery here: the test reproduces the iris
// composition from `components/HydrationDemo.vue` directly with render functions
// (see hydration.test.ts), so it needs nothing beyond `vue` + `@iris-ui-kit/vue`.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
})
