import { expect, test, type Page } from '@playwright/test'

async function gotoNotifications(page: Page): Promise<void> {
  await page.goto('/')

  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  const passwordInput = page.getByRole('textbox', { name: 'Password' })
  await expect(usernameInput).toBeVisible()
  await expect(passwordInput).toBeVisible()
  await usernameInput.fill('ada')
  await passwordInput.fill('secret')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()

  const notificationsNavItem = page.locator('[data-iris-nav-item][data-key="notifications"]')
  await expect(notificationsNavItem).toBeVisible()
  await notificationsNavItem.click()

  const pageRoot = page.locator('[data-page="notifications"]')
  await expect(pageRoot).toBeVisible()
  await expect(pageRoot.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible()
}

test('notifications — deterministic initial state', async ({ page }) => {
  await gotoNotifications(page)

  const panel = page.locator('[data-page="notifications"] [data-iris-notifications]')
  await expect(panel.locator('[data-iris-notification]')).toHaveCount(2)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('2')
  await expect(panel.getByText('Weekly analytics report ready', { exact: true })).toBeVisible()
  await expect(panel.getByText('Content review needed', { exact: true })).toBeVisible()
})

test('notifications — read and mark all read', async ({ page }) => {
  await gotoNotifications(page)

  const panel = page.locator('[data-page="notifications"] [data-iris-notifications]')
  const item = panel
    .locator('[data-iris-notification]')
    .filter({ hasText: 'Content review needed' })

  await item.locator('[data-iris-notification-body]').click()
  await expect(item).toHaveCount(1)
  await expect(item).toHaveAttribute('data-read', '')
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('1')

  await panel.locator('[data-iris-notifications-mark-all]').click()
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveCount(0)
})

test('notifications — dismiss and clear', async ({ page }) => {
  await gotoNotifications(page)

  const panel = page.locator('[data-page="notifications"] [data-iris-notifications]')
  const items = panel.locator('[data-iris-notification]')
  const item = items.filter({ hasText: 'Weekly analytics report ready' })

  await item.locator('[data-iris-notification-dismiss]').click()
  await expect(items).toHaveCount(1)
  await expect(panel.getByText('Weekly analytics report ready', { exact: true })).toHaveCount(0)

  await panel.locator('[data-iris-notifications-clear]').click()
  const empty = panel.locator('[data-iris-notifications-empty]')
  await expect(empty).toBeVisible()
  await expect(empty).toHaveText('No notifications')
  await expect(panel.locator('[data-iris-notifications-list]')).toHaveCount(0)
  await expect(items).toHaveCount(0)
})

test('notifications — push creates a newest unread item', async ({ page }) => {
  await gotoNotifications(page)

  const pageRoot = page.locator('[data-page="notifications"]')
  const panel = pageRoot.locator('[data-iris-notifications]')
  const items = panel.locator('[data-iris-notification]')

  await expect(items).toHaveCount(2)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('2')

  await pageRoot.getByRole('button', { name: 'Push test notification', exact: true }).click()
  await expect(items).toHaveCount(3)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('3')
  await expect(items.first()).toContainText('Test notification pushed')
  await expect(items.first()).not.toHaveAttribute('data-read')
})
