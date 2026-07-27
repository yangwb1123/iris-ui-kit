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
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // `threshold` (0-1, per-pixel YIQ color-distance tolerance) absorbs
      // ordinary anti-aliasing/subpixel-rendering jitter; Playwright's own
      // docs suggest ~0.2 as a sane non-strict default, so we keep it.
      // `maxDiffPixelRatio` additionally caps how much of the WHOLE image
      // may differ (2%) — generous enough to survive font-hinting/GPU-
      // rasterization drift between the machine that generated a baseline
      // and the one comparing against it, but far below what a real CSS/
      // design-token regression would produce (that flips large, contiguous
      // regions, not a scattered few percent of pixels).
      threshold: 0.2,
      maxDiffPixelRatio: 0.02,
      // Freeze CSS animations/transitions (dialog fade-in, hover/focus
      // transitions, the sort-indicator, etc.) so their in-flight state
      // can't land differently between the baseline and a later run.
      animations: 'disabled',
    },
  },
  // channel: 'chrome' pins the system-installed Google Chrome stable rather than
  // downloading Playwright's bundled Chromium build. This is load-bearing for the
  // visual-regression spec (e2e/visual.spec.ts): pixel screenshots need a browser
  // binary that's actually installable in every environment this suite runs in,
  // and it also means local baseline generation and CI compare against the same
  // browser family (GitHub's ubuntu-latest images ship Chrome stable preinstalled).
  projects: [
    {
      // Keep this name stable: the committed visual snapshots include it.
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: 'http://localhost:5176',
      },
    },
    {
      name: 'vue',
      testMatch: /cross-framework\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: 'http://localhost:5175',
      },
    },
    {
      name: 'solid',
      testMatch: /cross-framework\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: 'http://localhost:5177',
      },
    },
    {
      name: 'svelte',
      testMatch: /cross-framework\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL: 'http://localhost:5178',
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --dir ../cms dev',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5176',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm --dir ../cms-solid dev',
      url: 'http://localhost:5177',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm --dir ../cms-svelte dev',
      url: 'http://localhost:5178',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
