import { defineConfig, devices } from '@playwright/test'

/**
 * E2E smoke coverage for the flagship React CMS demo — the first Playwright
 * suite in this repo (all ~1500+ other tests run in jsdom, which never
 * exercises a real browser, real layout, or the actual login→shell→data
 * journey end to end). Runs against the dev server on the app's own fixed
 * port (5176) so it doesn't collide with the other three CMS apps' ports.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5176',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5176',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
