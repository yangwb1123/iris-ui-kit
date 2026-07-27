import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  resolve: {
    alias: {
      '@iris-ui-kit/plugin-admin/core': fileURLToPath(
        new URL('./src/core/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/svelte/**/*.test.ts'],
  },
})
