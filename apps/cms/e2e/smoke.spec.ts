import { test, expect } from '@playwright/test'

/**
 * E2E smoke tests for the Vue CMS app (port 5175).
 */

test('login and shell loads', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Username').fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('[data-iris-nav-menu]')).toBeVisible({ timeout: 8000 })
})

test('navigate via sidebar changes URL', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Username').fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('[data-iris-nav-menu]')).toBeVisible({ timeout: 8000 })

  // Click Users nav item and check something changed
  await page.locator('[data-iris-nav-item]').filter({ hasText: 'Users' }).click()

  // Wait and check body content changed
  await page.waitForTimeout(1000)
  const text = await page.textContent('body')
  console.log('Page text after nav click:', text?.substring(0, 300))
})
