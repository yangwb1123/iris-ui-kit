import { test, expect } from '@playwright/test'

/**
 * The E2E gap this repo's own analysis flagged repeatedly: every other test
 * (1500+) runs in jsdom, so nothing exercises a REAL browser rendering a REAL
 * login → shell → data journey. This is that smoke test for the flagship
 * React CMS demo: log in (the app's mock auth pre-fills valid credentials),
 * land on the shell, navigate to a data page, and see real rows render.
 */

test('login → shell → Users table renders real data', async ({ page }) => {
  await page.goto('/')

  // Mock auth pre-fills 'ada' / 'secret' — just submit.
  await expect(page.getByRole('heading', { name: /iris cms/i })).toBeVisible()
  // Exact match: a substring match on "Sign in" also hits the "Sign in as"
  // role-select trigger button above it.
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
