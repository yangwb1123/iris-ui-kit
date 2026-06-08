import { defineConfig } from 'vitest/config'

// core (node logic) + react (.tsx) + vue (h() render fns) — no framework vite
// plugin needed; vue authors render functions (not .vue SFCs) and React JSX is
// handled by esbuild's automatic runtime.
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
