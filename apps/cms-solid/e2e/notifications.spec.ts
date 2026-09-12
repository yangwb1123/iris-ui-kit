import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible({ timeout: 10_000 })
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function gotoNotifications(page: Page) {
  await login(page)
  const notificationsNavItem = page.locator('[data-iris-nav-item][data-key="notifications"]')
  await expect(notificationsNavItem).toBeVisible()
  await notificationsNavItem.click()

  const pageRoot = page.locator('[data-page="notifications"]')
  await expect(pageRoot).toBeVisible()
  await expect(pageRoot.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible()
  return pageRoot
}

test('Notifications — route and deterministic initial state', async ({ page }) => {
  const pageRoot = await gotoNotifications(page)
  const panel = pageRoot.locator('[data-iris-notifications]')

  await expect(panel.locator('[data-iris-notification]')).toHaveCount(2)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('2')
  await expect(panel.locator('[data-iris-notification-title]')).toHaveText([
    'Weekly analytics report ready',
    'Content review needed',
  ])
})

test('Notifications — read one and mark all read', async ({ page }) => {
  const pageRoot = await gotoNotifications(page)
  const panel = pageRoot.locator('[data-iris-notifications]')
  const review = panel
    .locator('[data-iris-notification]')
    .filter({ hasText: 'Content review needed' })

  await review.locator('[data-iris-notification-body]').click()
  await expect(review).toHaveAttribute('data-read', '')
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('1')

  await panel.locator('[data-iris-notifications-mark-all]').click()
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveCount(0)
  await expect(panel.locator('[data-iris-notification]')).toHaveCount(2)
})

test('Notifications — dismiss and clear', async ({ page }) => {
  const pageRoot = await gotoNotifications(page)
  const panel = pageRoot.locator('[data-iris-notifications]')
  const weekly = panel
    .locator('[data-iris-notification]')
    .filter({ hasText: 'Weekly analytics report ready' })

  await weekly.locator('[data-iris-notification-dismiss]').click()
  await expect(panel.locator('[data-iris-notification]')).toHaveCount(1)
  await expect(panel.getByText('Weekly analytics report ready', { exact: true })).toHaveCount(0)

  await panel.locator('[data-iris-notifications-clear]').click()
  await expect(panel.locator('[data-iris-notifications-empty]')).toHaveText('No notifications')
  await expect(panel.locator('[data-iris-notifications-list]')).toHaveCount(0)
  await expect(panel.locator('[data-iris-notification]')).toHaveCount(0)
})

test('Notifications — push a new unread notification', async ({ page }) => {
  const pageRoot = await gotoNotifications(page)
  const panel = pageRoot.locator('[data-iris-notifications]')

  await expect(panel.locator('[data-iris-notification]')).toHaveCount(2)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('2')

  await pageRoot.getByRole('button', { name: 'Push test notification', exact: true }).click()

  await expect(panel.locator('[data-iris-notification]')).toHaveCount(3)
  await expect(panel.locator('[data-iris-notifications-badge]')).toHaveText('3')
  const first = panel.locator('[data-iris-notification]').first()
  await expect(first.locator('[data-iris-notification-title]')).toHaveText(
    'Test notification pushed',
  )
  await expect(first).not.toHaveAttribute('data-read', '')
})
