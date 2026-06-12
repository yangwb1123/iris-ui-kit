import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/solid/**/*.test.{ts,tsx}'],
    globals: false,
    isolate: false,
  },
})
