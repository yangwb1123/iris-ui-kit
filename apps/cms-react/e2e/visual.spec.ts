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
  // The mock-auth form pre-fills 'ada' / 'secret' / admin — just submit.
  // (`exact: true` avoids a strict-mode collision with the "Sign in as" role
  // select's trigger button, whose accessible name contains "Sign in".)
  const submit = page.getByRole('button', { name: 'Sign in', exact: true })
  await expect(submit).toBeVisible()
  await submit.click()
  // Wait for the shell to mount on its default route (not the command-palette
  // trigger smoke.spec.ts waits on: that button passes an `aria-label` IrisButton
  // doesn't currently forward to the DOM — a pre-existing a11y bug, out of scope
  // here — so its accessible name is actually its visible "⌘K" text, not the
  // label. The Dashboard heading is a reliable, unrelated mount signal.)
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

    // The theme toggle is icon-only, and IrisButton currently drops the
    // `aria-label` prop Shell.tsx passes it (the same pre-existing bug
    // login() routes around above), so its accessible name is empty rather
    // than "Dark mode"/"Light mode" — target it by its rendered icon
    // (`IrisIcon` does write a stable `data-iris-icon` attribute) instead.
    const toggle = page
      .getByRole('banner')
      .locator('button', { has: page.locator('[data-iris-icon="moon"], [data-iris-icon="sun"]') })
    await expect(toggle).toBeVisible()

    // Confirm the skin actually flipped (icon swapped + the underlying CSS
    // variable actually changed — same assertion style as smoke.spec.ts's
    // theme test) before screenshotting.
    const bgVar = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--iris-background').trim(),
      )
    const before = await bgVar()
    await toggle.click()
    await expect(toggle.locator('[data-iris-icon="sun"]')).toBeVisible()
    await expect.poll(bgVar).not.toBe(before)

    await expect(page).toHaveScreenshot('users-dark.png')
  })

  test('Users table — sorted, with delete-confirmation Dialog open', async ({ page }) => {
    await login(page)
    await gotoUsers(page)

    // Sort by Role, not the 'User' column: that column's key ('user') doesn't
    // match any accessor in data/users.ts's `userColumns` (only name/email/
    // role/status do), so clicking it flips `aria-sort` without actually
    // reordering rows — a pre-existing data/column-key mismatch in the demo,
    // out of scope here. Role sorts for real, so the screenshot honestly
    // shows a reordered table, not just an inert aria-sort attribute.
    const roleHeader = page.getByRole('columnheader', { name: 'Role' })
    await roleHeader.click()
    await expect(roleHeader).toHaveAttribute('aria-sort', 'ascending')

    await page.getByRole('table').getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await expect(page).toHaveScreenshot('users-table-sorted-dialog-open.png')
  })
})
