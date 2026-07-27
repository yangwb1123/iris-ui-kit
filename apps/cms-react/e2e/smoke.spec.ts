import { test, expect } from '@playwright/test'

/**
 * The E2E gap this repo's own analysis flagged repeatedly: every other test
 * (1500+) runs in jsdom, so nothing exercises a REAL browser rendering a REAL
 * login → shell → data journey. This is that smoke test for the flagship
 * React CMS demo: log in (the demo auth client pre-fills valid credentials),
 * land on the shell, navigate to a data page, and see real rows render.
 */

test('login → shell → Users table renders real data', async ({ page }) => {
  await page.goto('/')

  // Demo auth pre-fills the fixed admin account: 'ada' / 'secret'.
  await expect(page.getByRole('heading', { name: /iris cms/i })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  // The shell mounted: the admin layout's nav + command palette trigger exist.
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible()

  // Navigate to the Users page (hash route) and verify the table has real rows.
  await page.goto('/#users')
  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
  // Header row + at least one data row.
  await expect(rows).toHaveCount(await rows.count())
  expect(await rows.count()).toBeGreaterThan(1)

  // The composite User column is backed by the real `name` accessor. Sorting
  // must change row order, not merely its aria-sort attribute.
  const userHeader = page.getByRole('columnheader', { name: 'User' })
  const firstRowBefore = await rows.nth(1).textContent()
  await userHeader.click()
  await userHeader.click()
  await expect(userHeader).toHaveAttribute('aria-sort', 'descending')
  await expect.poll(() => rows.nth(1).textContent()).not.toBe(firstRowBefore)
})

test('viewer session cannot see or deep-link to admin routes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Username' }).fill('viewer')
  // Roles come from the authentication response; the login form has no
  // client-controlled role picker.
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await expect(page.getByText('Admin', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Settings', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Roles & access', { exact: true })).toHaveCount(0)

  await page.goto('/#settings')
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.goto('/#admin')
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('theme toggle actually flips the skin and the applied CSS variable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible()

  // Themes are applied as CSS custom properties on the root element (no
  // data-theme attribute / class toggle in this system) — assert the actual
  // written value changes, not just a label.
  const bgVar = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--iris-background').trim(),
    )
  const before = await bgVar()

  // The toggle button's own accessible name reflects the CURRENT mode (i.e.
  // clicking "Dark mode" switches TO dark). Click it, then confirm both the
  // label flipped and the underlying CSS variable actually changed.
  const toggle = page.getByRole('button', { name: /dark mode|light mode/i })
  const labelBefore = await toggle.getAttribute('aria-label')
  await toggle.click()
  await expect(page.getByRole('button', { name: /dark mode|light mode/i })).not.toHaveAttribute(
    'aria-label',
    labelBefore!,
  )
  await expect.poll(bgVar).not.toBe(before)
})

test('settings save persists across a full reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible()

  await page.goto('/#settings')
  const siteName = page.getByRole('textbox', { name: 'Site name' })
  await siteName.fill('Iris Production CMS')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Settings saved.')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Site name' })).toHaveValue('Iris Production CMS')
})
