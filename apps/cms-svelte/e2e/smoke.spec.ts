import { test, expect } from '@playwright/test'

/**
 * E2E smoke tests for the Svelte CMS app (port 5178).
 * Verifies login → shell → Users table → Form Builder.
 */

test('login → shell → Users table renders', async ({ page }) => {
  await page.goto('/')

  // Svelte login: pre-filled username/password, click Sign in
  await expect(page.getByRole('heading', { name: /iris cms/i })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  // Shell mounted
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible({ timeout: 5000 })

  // Navigate to Users page
  await page.goto('/#users')
  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 5000 })
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
  expect(await rows.count()).toBeGreaterThan(1)
})

test('Form Builder page — renders form fields', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible({ timeout: 5000 })

  await page.goto('/#form-builder')
  await expect(page.getByRole('heading', { name: /Form Builder/i })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Full Name')).toBeVisible()
})
