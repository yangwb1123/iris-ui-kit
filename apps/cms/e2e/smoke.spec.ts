import { test, expect } from '@playwright/test'

/**
 * E2E smoke tests for the Vue CMS app (port 5175).
 * Uses sidebar menu text click for navigation.
 */

async function login(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByPlaceholder('Username')).toBeVisible()
  await page.getByPlaceholder('Username').fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible({
    timeout: 5000,
  })
}

test('login → shell → Users table renders', async ({ page }) => {
  await login(page)

  // Navigate by clicking the "Users" sidebar item (clickable div with aria-label)
  await page.locator('[data-iris-nav-group]').filter({ hasText: 'Users' }).first().click()

  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 5000 })
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
  expect(await rows.count()).toBeGreaterThan(1)
})

test('Form Builder page — renders form fields', async ({ page }) => {
  await login(page)

  await page.locator('[data-iris-nav-group]').filter({ hasText: 'Form Builder' }).first().click()
  await expect(page.getByRole('heading', { name: /Form Builder/i })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Full Name')).toBeVisible()
})
