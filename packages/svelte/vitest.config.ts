import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

// Svelte under vitest: the svelte plugin compiles .svelte; svelteTesting adds
// auto-cleanup + the `browser` resolve condition so the client build loads.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: false,
    // The SSR / hydration-safety test must run under the dedicated SSR config
    // (`vitest.ssr.config.ts`: node env, server-compiled `.svelte`). Under this
    // default (browser-condition, DOM-compiled) config `svelte/server`'s
    // `render()` cannot consume the client build, so exclude it here.
    exclude: ['src/hydration.test.ts', '**/node_modules/**', '**/dist/**'],
    setupFiles: ['./vitest-setup.ts'],
  },
})
