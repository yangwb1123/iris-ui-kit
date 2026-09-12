import { test, expect, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible({ timeout: 10_000 })
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

test('Dashboard operations', async ({ page }) => {
  await login(page)

  const section = page.locator('[data-iris-dashboard-section="operations"]')
  const output = section.locator('[data-iris-dashboard-action]')
  const trigger = section.getByRole('button', { name: 'Operations', exact: true })
  const rootMenu = page.locator('[data-iris-dashboard-menu]')
  const feed = section.locator('[data-iris-dashboard-activity-feed]')
  const rows = feed.locator('[data-iris-dashboard-activity-row]')

  await expect(section).toHaveCount(1)
  await expect(section.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible()
  await expect(output).toHaveText('Last action: none')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(rootMenu).toHaveCount(0)

  await trigger.click()
  await expect(rootMenu).toBeVisible()

  const exportItem = rootMenu.getByRole('menuitem', { name: 'Export report', exact: true })
  await expect(exportItem).toHaveAttribute('aria-disabled', 'true')
  await exportItem.click()
  await expect(output).toHaveText('Last action: none')
  await expect(rootMenu).toBeVisible()

  await rootMenu.getByRole('menuitem', { name: 'Refresh activity', exact: true }).click()
  await expect(output).toHaveText('Last action: Refresh activity')
  await expect(rootMenu).toHaveCount(0)

  await trigger.click()
  await expect(rootMenu).toBeVisible()
  await rootMenu.getByRole('menuitem', { name: 'More operations', exact: true }).click()
  const auditItem = page.getByRole('menuitem', { name: 'View audit log', exact: true })
  await expect(auditItem).toBeVisible()
  await auditItem.click()
  await expect(output).toHaveText('Last action: View audit log')
  await expect(rootMenu).toHaveCount(0)

  await expect(rows).toHaveCount(8)
  await expect(feed).toHaveAttribute('data-axis', 'vertical')
  await expect(feed).toHaveAttribute('tabindex', '0')
  await expect(feed).toHaveCSS('max-height', '180px')

  await feed.focus()
  await expect(feed).toBeFocused()
  await feed.hover()
  const beforeScrollTop = await feed.evaluate((element) => (element as HTMLElement).scrollTop)
  await page.mouse.wheel(0, 240)
  await expect
    .poll(() => feed.evaluate((element) => (element as HTMLElement).scrollTop))
    .toBeGreaterThan(beforeScrollTop)
})
