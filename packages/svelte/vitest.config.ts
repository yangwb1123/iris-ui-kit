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
    setupFiles: ['./vitest-setup.ts'],
  },
})
