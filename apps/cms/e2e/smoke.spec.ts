import { test, expect } from '@playwright/test'

/**
 * E2E smoke tests for the Vue CMS app (port 5175).
 */

test('login and shell loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 8000 })
  await page.getByPlaceholder('Username').fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // After login, expect the admin shell to show
  await expect(page.locator('[data-iris-nav-menu]')).toBeVisible({ timeout: 8000 })
})

test('Users table renders after login', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Username').fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Wait for nav menu to appear
  await expect(page.locator('[data-iris-nav-menu]')).toBeVisible({ timeout: 8000 })

  // Click the Users nav item
  const usersNav = page.locator('[data-iris-nav-item]').filter({ hasText: 'Users' })
  await expect(usersNav).toBeVisible({ timeout: 5000 })
  await usersNav.click()

  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 8000 })
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
})
