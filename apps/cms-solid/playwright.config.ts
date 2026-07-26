import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5177',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx --yes pnpm@latest dev',
    port: 5177,
    reuseExistingServer: !process.env.CI,
  },
})
