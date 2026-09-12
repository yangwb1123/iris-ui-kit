import { test, expect, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

async function openNotifications(page: Page) {
  await page.locator('[data-iris-nav-menu] [data-key="notifications"]').click()
  await expect(page).toHaveURL(/#\/notifications$/)
  const pageRoot = page.locator('[data-page="notifications"]')
  await expect(pageRoot.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible()
  return {
    pageRoot,
    panel: pageRoot.locator('[data-iris-notifications]'),
  }
}

test('notifications page — navigation and deterministic initial state', async ({ page }) => {
  await login(page)
  const { panel } = await openNotifications(page)
  const items = panel.locator('[data-iris-notification]')

  await expect(items).toHaveCount(2)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('2')
  await expect(panel.getByText('Weekly analytics report ready', { exact: true })).toBeVisible()
  await expect(panel.getByText('Content review needed', { exact: true })).toBeVisible()
})

test('notifications page — item read and mark all read', async ({ page }) => {
  await login(page)
  const { panel } = await openNotifications(page)
  const item = panel
    .locator('[data-iris-notification]')
    .filter({ hasText: 'Content review needed' })

  await item.locator('[data-iris-notification-body]').click()
  await expect(item).toHaveAttribute('data-read', '')
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('1')

  await panel.locator('[data-iris-notifications-mark-all]').click()
  // The public component omits the badge when its unread count reaches zero.
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveCount(0)
})

test('notifications page — dismiss and clear expose the empty state', async ({ page }) => {
  await login(page)
  const { panel } = await openNotifications(page)
  const items = panel.locator('[data-iris-notification]')
  const item = items.filter({ hasText: 'Weekly analytics report ready' })

  await item.locator('[data-iris-notification-dismiss]').click()
  await expect(items).toHaveCount(1)
  await expect(panel.getByText('Weekly analytics report ready', { exact: true })).toHaveCount(0)

  await panel.locator('[data-iris-notifications-clear]').click()
  await expect(panel.locator('[data-iris-notifications-empty]')).toBeVisible()
  await expect(panel.locator('[data-iris-notifications-list]')).toHaveCount(0)
  await expect(items).toHaveCount(0)
})

test('notifications page — push action adds a newest unread item', async ({ page }) => {
  await login(page)
  const { pageRoot, panel } = await openNotifications(page)
  const items = panel.locator('[data-iris-notification]')

  await expect(items).toHaveCount(2)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('2')

  await pageRoot.getByRole('button', { name: 'Push test notification', exact: true }).click()
  await expect(items).toHaveCount(3)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('3')
  await expect(items.first()).toContainText('Test notification pushed')
})
