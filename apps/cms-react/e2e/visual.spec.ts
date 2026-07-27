import { test, expect, type Page } from '@playwright/test'

/**
 * Visual-regression scaffold — the first pixel-level check in this repo (see
 * smoke.spec.ts's doc comment for the functional-only gap this closes). Every
 * other gate here — contract tests, a11y audits, unit tests — verifies
 * behavior/ARIA, never actual rendering, so a CSS/design-token regression
 * (wrong color variable, broken spacing scale, a skin that stops applying)
 * could ship through all of CI undetected. This is a small, curated set, not
 * exhaustive component coverage: it exists to prove the mechanism works and
 * to catch that specific class of regression on the highest-value surfaces.
 *
 * Screens captured:
 *  1. Users page, light theme (the default skin) — a real data table + shell.
 *  2. The SAME page in dark theme — proves the toggle actually re-renders the
 *     CSS custom properties visually, not just that a label/attribute
 *     flipped (which is all smoke.spec.ts's theme test checks).
 *  3. The Users table with a sort applied + a delete confirmation Dialog
 *     open on top of it — the highest-regression-risk composite state
 *     (overlay + portal + focus trap + an actively-sorted column header).
 *
 * Deliberately NOT using `fullPage: true`: IrisAdminLayout's header is
 * `position: sticky` and IrisDialog portals a `position: fixed` backdrop to
 * `document.body` — both are known Playwright gotchas where full-page
 * screenshots (stitched from multiple scrolled captures) can duplicate or
 * misplace fixed/sticky elements. The viewport is sized generously (see
 * `test.use` below) so every captured screen fits in a single viewport
 * without scrolling, which sidesteps the issue entirely while still
 * capturing "the whole visible page".
 *
 * Tolerance: see playwright.config.ts's `expect.toHaveScreenshot` block for
 * the reasoning behind the chosen threshold/maxDiffPixelRatio values.
 */

test.use({ viewport: { width: 1280, height: 1000 } })

async function login(page: Page): Promise<void> {
  await page.goto('/')
  // The demo auth form pre-fills the fixed admin account, `ada` / `secret`.
  const submit = page.getByRole('button', { name: 'Sign in', exact: true })
  await expect(submit).toBeVisible()
  await submit.click()
  // The heading is the stable signal that authentication completed and the
  // default dashboard route mounted.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function gotoUsers(page: Page): Promise<void> {
  await page.goto('/#users')
  await expect(page.getByRole('table')).toBeVisible()
  // Let the resource controller's initial fetch settle so rows are rendered
  // (fetchUsers reads a static in-memory array, but the resource controller
  // still goes through its normal async pipeline).
  await expect(page.getByRole('table').getByRole('row')).not.toHaveCount(0)
}

test.describe('visual regression', () => {
  test('Users page — light theme', async ({ page }) => {
    await login(page)
    await gotoUsers(page)
    await expect(page).toHaveScreenshot('users-light.png')
  })

  test('Users page — dark theme', async ({ page }) => {
    await login(page)
    await gotoUsers(page)

    // IrisButton forwards the shell's accessible label, so the icon-only
    // control is located the same way assistive technology identifies it.
    const toggle = page.getByRole('banner').getByRole('button', { name: /^(Dark|Light) mode$/ })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAccessibleName('Dark mode')

    // Confirm the skin actually flipped (icon swapped + the underlying CSS
    // variable actually changed — same assertion style as smoke.spec.ts's
    // theme test) before screenshotting.
    const bgVar = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--iris-background').trim(),
      )
    const before = await bgVar()
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Light mode')
    await expect.poll(bgVar).not.toBe(before)

    await expect(page).toHaveScreenshot('users-dark.png')
  })

  test('Users table — sorted, with delete-confirmation Dialog open', async ({ page }) => {
    await login(page)
    await gotoUsers(page)

    // The composite "User" display column is backed by the controller's `name`
    // accessor, so this verifies that its sort is behavioral, not aria-only.
    const userHeader = page.getByRole('columnheader', { name: 'User' })
    const firstRowBefore = await page.getByRole('table').getByRole('row').nth(1).textContent()
    await userHeader.click()
    await expect(userHeader).toHaveAttribute('aria-sort', 'ascending')
    await userHeader.click()
    await expect(userHeader).toHaveAttribute('aria-sort', 'descending')
    const firstRowAfter = await page.getByRole('table').getByRole('row').nth(1).textContent()
    expect(firstRowAfter).not.toBe(firstRowBefore)

    await page.getByRole('table').getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await expect(page).toHaveScreenshot('users-table-sorted-dialog-open.png')
  })
})
