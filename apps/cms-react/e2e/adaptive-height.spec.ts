import { test, expect, type Page } from '@playwright/test'

/**
 * Batch EC (iris 独有 — vxe autoHeight fills rows to the VIEWPORT, only this
 * feature releases the one-line clamp so DATA rows grow to their content):
 * real-browser verification of `adaptiveRowHeight` on the React CMS example
 * page. The clamp-feedback trap is precisely what jsdom cannot see: a pinned
 * row's layout box IS the pin, so a naive re-measure reads the pin back and
 * the row is frozen. Here a real layout engine resolves each row's box, and
 * the spec asserts (1) content-wrapped rows differ in height, (2) growing
 * row 1's content self-heals to a TALLER natural height after it was
 * already pinned short, and (3) the header row stays single-line.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function gotoAdaptiveSection(page: Page): Promise<void> {
  await login(page)
  await page.goto('/#vxe-example')
  await expect(
    page.getByRole('heading', { name: '内容自适应行高（adaptiveRowHeight，iris 独有）' }),
  ).toBeVisible()
}

test('adaptiveRowHeight — data rows wrap and grow to their content', async ({ page }) => {
  await gotoAdaptiveSection(page)
  const section = page.locator('section').filter({ hasText: '内容自适应行高' })
  // Root marker is on (activation gate: no fixed rowHeight, no virtual).
  await expect(section.locator('[data-iris-table][data-iris-adaptive-height="true"]')).toHaveCount(
    1,
  )
  const shortRow = section.locator('[data-iris-table-row="1"]')
  const tallRow = section.locator('[data-iris-table-row="2"]')
  await expect(shortRow).toBeVisible()
  await expect(tallRow).toBeVisible()
  const shortH = await shortRow.evaluate((el) => el.getBoundingClientRect().height)
  const tallH = await tallRow.evaluate((el) => el.getBoundingClientRect().height)
  expect(tallH).toBeGreaterThan(shortH + 8)
})

test('adaptiveRowHeight — clamp-trap self-heal: a pinned row grows to its natural height', async ({
  page,
}) => {
  await gotoAdaptiveSection(page)
  const section = page.locator('section').filter({ hasText: '内容自适应行高' })
  const shortRow = section.locator('[data-iris-table-row="1"]')
  await expect(shortRow).toBeVisible()
  const before = await shortRow.evaluate((el) => el.getBoundingClientRect().height)
  // Commit much longer content into row 1. In a real browser the row was
  // already pinned (its layout box IS the pin); re-measure must clear the
  // pin first or the growth stays clipped and the height never changes.
  await section.getByRole('button', { name: '增长第 1 行内容' }).click()
  await expect
    .poll(async () => shortRow.evaluate((el) => el.getBoundingClientRect().height))
    .toBeGreaterThan(before + 8)
})

test('adaptiveRowHeight — reserved roles stay single-line (header never wraps)', async ({
  page,
}) => {
  await gotoAdaptiveSection(page)
  const section = page.locator('section').filter({ hasText: '内容自适应行高' })
  const header = section.locator('[data-iris-table-row="header"]')
  await expect(header).toBeVisible()
  const headerH = await header.evaluate((el) => el.getBoundingClientRect().height)
  // One-line header: padding 8px + 14px font + borders ≈ 34px.
  expect(headerH).toBeLessThanOrEqual(44)
  // Header stays single-line even after a data commit.
  await section.getByRole('button', { name: '增长第 1 行内容' }).click()
  const after = await header.evaluate((el) => el.getBoundingClientRect().height)
  expect(after).toBeLessThanOrEqual(44)
})
