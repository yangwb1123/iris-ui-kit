import { test, expect } from '@playwright/test'

/**
 * E2E smoke tests for the Svelte CMS app (port 5178).
 */

test('login and shell loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /iris cms/i })).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await expect(page.locator('[data-iris-nav-menu]')).toBeVisible({ timeout: 8000 })
})

test('Users table renders after login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('[data-iris-nav-menu]')).toBeVisible({ timeout: 8000 })

  const usersNav = page.locator('[data-iris-nav-item]').filter({ hasText: 'Users' })
  await expect(usersNav).toBeVisible({ timeout: 5000 })
  await usersNav.click()

  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 8000 })
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
})
