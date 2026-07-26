import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    port: 5175,
    reuseExistingServer: !process.env.CI,
  },
})
