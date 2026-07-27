import { fileURLToPath } from 'node:url'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '@iris-ui-kit/plugin-admin/core': fileURLToPath(
        new URL('./src/core/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/solid/**/*.test.{ts,tsx}'],
    globals: false,
    isolate: false,
  },
})
