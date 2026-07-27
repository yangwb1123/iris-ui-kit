import { defineConfig } from 'vitest/config'

/**
 * Real, v8-instrumented coverage for `@iris-ui-kit/core` — the counterpart to
 * `scripts/test-coverage-report.mjs`'s test-file line-count heuristic (which
 * only measures how much test CODE exists, not how much source it actually
 * exercises; incremental source changes can pass it with 0% real coverage).
 *
 * No custom `test` block beyond coverage: this repo's packages otherwise run
 * on vitest's zero-config defaults (`*.test.ts` discovery), so this file
 * exists solely to opt core into coverage instrumentation via `vitest run
 * --coverage` / `pnpm test:coverage:v8`.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.bench.ts',
        'src/**/__tests__/**',
        'src/contracts/scenarios/**', // cross-framework scenario fixtures, not core logic
      ],
      // Measured baseline (2026-07-16): 91.94% stmts / 90.58% branches /
      // 93.37% functions. Thresholds set with headroom below that baseline —
      // raise them deliberately (in a reviewed commit) as coverage improves,
      // matching this repo's scripts/check-size.mjs budget convention.
      thresholds: {
        statements: 80,
        branches: 78,
        functions: 80,
        lines: 80,
      },
    },
  },
})
