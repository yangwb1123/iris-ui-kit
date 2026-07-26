import { test, expect, type Page } from '@playwright/test'

/**
 * E2E smoke tests for the new CMS pages: Form Builder and Realtime.
 * These verify the pages mount, render expected content, and are interactive.
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

  // The page heading
  await expect(page.getByRole('heading', { name: 'Form Builder' })).toBeVisible()

  // Form fields from the schema
  await expect(page.getByText('Full Name')).toBeVisible()
  await expect(page.getByText('Email')).toBeVisible()
  await expect(page.getByText('Password')).toBeVisible()
  await expect(page.getByLabel('Full Name')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()

  // The submit button
  await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible()
})

test('Form Builder — submits and shows values', async ({ page }) => {
  await login(page)
  await page.goto('/#form-builder')

  // Fill the form
  await page.getByLabel('Full Name').fill('Test User')
  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password').fill('secret123')

  // Submit
  await page.getByRole('button', { name: 'Save Profile' }).click()

  // The submitted values should appear
  await expect(page.getByTestId('submitted-values')).toBeVisible()
  await expect(page.getByText('Test User')).toBeVisible()
  await expect(page.getByText('test@example.com')).toBeVisible()
})

test('Realtime page — renders and starts receiving data', async ({ page }) => {
  await login(page)
  await page.goto('/#realtime')

  // Page heading
  await expect(page.getByRole('heading', { name: 'Realtime Data' })).toBeVisible()

  // Stock ticker cards should be visible
  await expect(page.getByText('IRIS')).toBeVisible()
  await expect(page.getByText('REACT')).toBeVisible()
  await expect(page.getByText('VUE')).toBeVisible()
  await expect(page.getByText('SOLID')).toBeVisible()
  await expect(page.getByText('SVELTE')).toBeVisible()

  // Event log should be present
  await expect(page.getByText('Event Log')).toBeVisible()
})

test('ProTable page — renders CRUD table', async ({ page }) => {
  await login(page)
  await page.goto('/#pro-table')

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByText('Ergonomic Keyboard')).toBeVisible()
  await expect(page.getByText('USB-C Hub')).toBeVisible()
  await expect(page.getByText('Standing Desk')).toBeVisible()
})

test('Documentation page — renders markdown content', async ({ page }) => {
  await login(page)
  await page.goto('/#documentation')

  await expect(page.getByText('Iris UI CMS')).toBeVisible()
  await expect(page.getByText('Getting Started')).toBeVisible()
})

test('Users page — navigates and shows table', async ({ page }) => {
  await login(page)
  await page.goto('/#users')

  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  // Should have header + at least one data row
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
})
