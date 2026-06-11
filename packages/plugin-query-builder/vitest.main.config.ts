import { defineConfig } from 'vitest/config'

export default defineConfig({
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
