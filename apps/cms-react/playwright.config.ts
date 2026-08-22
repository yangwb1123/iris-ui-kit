import { defineConfig, devices } from '@playwright/test'

/**
 * Real-browser coverage for all four CMS demos. The React project also owns
 * the curated pixel baselines; `cross-framework.spec.ts` is replayed against
 * Vue / React / Solid / Svelte so framework parity is exercised through each
 * app's actual Vite bundle, browser storage and navigation UI.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      // `threshold` (0-1, per-pixel YIQ color-distance tolerance) absorbs
      // ordinary anti-aliasing/subpixel-rendering jitter; Playwright's own
      // docs suggest ~0.2 as a sane non-strict default, so we keep it.
      // `maxDiffPixelRatio` additionally caps how much of the WHOLE image
      // may differ (2.5%) — calibrated against Ubuntu runner/container
      // font-hinting and GPU-rasterization drift while remaining below the
      // ~3% diff produced by the stale pre-workspace-expansion baselines.
      // This is generous enough to survive ordinary cross-environment
      // rasterization drift between the machine that generated a baseline
      // and the one comparing against it, but far below what a real CSS/
      // design-token regression would produce (that flips large, contiguous
      // regions, not a scattered few percent of pixels).
      threshold: 0.2,
      maxDiffPixelRatio: 0.025,
      // Freeze CSS animations/transitions (dialog fade-in, hover/focus
      // transitions, the sort-indicator, etc.) so their in-flight state
      // can't land differently between the baseline and a later run.
      animations: 'disabled',
    },
  },
  // CI runs these projects in the Playwright image matching @playwright/test.
  // Use its bundled Chromium instead of the mutable system Chrome channel so
  // screenshot rendering stays reproducible across runner image updates.
  projects: [
    {
      // Keep this name stable: the committed visual snapshots include it.
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5176',
      },
    },
    {
      name: 'vue',
      testMatch: /cross-framework\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5175',
      },
    },
    {
      name: 'solid',
      testMatch: /cross-framework\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5177',
      },
    },
    {
      name: 'svelte',
      testMatch: /cross-framework\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5178',
      },
    },
  ],
  webServer: [
    {
      command: 'corepack pnpm --dir ../cms exec vite preview --host 0.0.0.0 --port 5175',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'corepack pnpm exec vite preview --host 0.0.0.0 --port 5176',
      url: 'http://localhost:5176',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'corepack pnpm --dir ../cms-solid exec vite preview --host 0.0.0.0 --port 5177',
      url: 'http://localhost:5177',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'corepack pnpm --dir ../cms-svelte exec vite preview --host 0.0.0.0 --port 5178',
      url: 'http://localhost:5178',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
