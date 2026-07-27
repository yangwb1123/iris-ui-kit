import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@iris-ui-kit/plugin-query-builder/core': fileURLToPath(
        new URL('./src/core/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'src/core/**/*.test.{ts,tsx}',
      'src/react/**/*.test.{ts,tsx}',
      'src/vue/**/*.test.{ts,tsx}',
    ],
    globals: false,
  },
  esbuild: {
    jsx: 'automatic',
  },
})
