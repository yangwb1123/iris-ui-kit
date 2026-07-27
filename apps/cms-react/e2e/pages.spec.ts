import { test, expect, type Page } from '@playwright/test'

/**
 * E2E smoke tests for CMS pages: Form Builder, ProTable, Users.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const submit = page.getByRole('button', { name: 'Sign in', exact: true })
  await expect(submit).toBeVisible()
  await submit.click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

test('Form Builder page — renders schema-driven form fields', async ({ page }) => {
  await login(page)
  await page.goto('/#form-builder')

  await expect(page.getByRole('heading', { name: 'Form Builder' })).toBeVisible()
  await expect(page.getByText('Full Name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible()
})

test('Form Builder — renders fields and submit button', async ({ page }) => {
  await login(page)
  await page.goto('/#form-builder')

  // The page heading
  await expect(page.getByRole('heading', { name: 'Form Builder' })).toBeVisible()

  // Check that the submit button exists
  await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible()

  // Verify the form rendered by checking for a known field label
  await expect(page.getByText('Full Name')).toBeVisible()
})

test('ProTable page — renders CRUD table', async ({ page }) => {
  await login(page)
  await page.goto('/#pro-table')

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByText('Ergonomic Keyboard')).toBeVisible()
  await expect(page.getByText('USB-C Hub')).toBeVisible()
})

test('Users page — shows table with data', async ({ page }) => {
  await login(page)
  await page.goto('/#users')

  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
})
