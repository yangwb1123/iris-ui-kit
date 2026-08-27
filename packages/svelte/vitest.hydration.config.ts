import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

// Client-side companion for the dedicated SSR config. It exercises Svelte's
// real hydrate() path against markup produced by the SSR compiler.
export default defineConfig({
  plugins: [svelte(), svelteTesting({ autoCleanup: false })],
  resolve: { conditions: ['development', 'browser'] },
  test: {
    environment: 'jsdom',
    include: ['src/primitives/table/batch-fade-svelte.hydration.test.ts'],
    globals: false,
    isolate: true,
    setupFiles: ['./vitest-setup.ts'],
  },
})
