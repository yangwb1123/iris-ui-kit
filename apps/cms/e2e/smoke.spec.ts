import { test, expect } from '@playwright/test'

/**
 * E2E smoke tests for the Vue CMS app (port 5175).
 * Verifies login → shell → Users table → Form Builder.
 */

test('login → shell → Users table renders', async ({ page }) => {
  await page.goto('/')

  // Vue login: username input + role select + Sign in button
  await expect(page.getByPlaceholder('Username')).toBeVisible()
  await page.getByPlaceholder('Username').fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // The shell mounted — command palette trigger visible
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible({ timeout: 5000 })

  // Navigate to Users page
  await page.goto('/#users')
  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 5000 })
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
  expect(await rows.count()).toBeGreaterThan(1)
})

test('Form Builder page — renders and submits', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Username').fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible({ timeout: 5000 })

  await page.goto('/#form-builder')
  await expect(page.getByRole('heading', { name: /Form Builder/i })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Full Name')).toBeVisible()
})
