import { test, expect, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible()
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function gotoTransfer(page: Page): Promise<void> {
  await login(page)
  await page.locator('[data-iris-nav-item]').filter({ hasText: 'Transfer' }).click()
  await expect(page.locator('[data-page="transfer"]')).toBeVisible()
}

test('Transfer page is reachable from the CMS menu', async ({ page }) => {
  await gotoTransfer(page)

  await expect(page.getByRole('heading', { name: 'Transfer', exact: true })).toBeVisible()
})

test('Transfer page assigns and restores a searchable permission', async ({ page }) => {
  await gotoTransfer(page)

  const transferPage = page.locator('[data-page="transfer"]')
  const source = transferPage.locator('[data-iris-transfer-pane][data-side="source"]')
  const target = transferPage.locator('[data-iris-transfer-pane][data-side="target"]')
  const summary = transferPage.locator('[data-testid="assignment-summary"]')

  await expect(
    target.locator('[data-iris-transfer-item][data-value="read-articles"]'),
  ).toBeVisible()
  await expect(summary).toContainText('Read articles')

  const sourceSearch = source.locator('[data-iris-transfer-search]')
  await sourceSearch.fill('publish')
  await expect(source.locator('[data-iris-transfer-item]')).toHaveCount(1)
  const publishSource = source.locator('[data-iris-transfer-item][data-value="publish-articles"]')
  const publishSourceCheckbox = publishSource.locator('input[type="checkbox"]')
  await expect(publishSource).toBeVisible()
  await expect(publishSourceCheckbox).toBeEnabled()
  await publishSourceCheckbox.check()
  await transferPage.locator('[data-iris-transfer-to-target]').click()

  await expect(
    target.locator('[data-iris-transfer-item][data-value="publish-articles"]'),
  ).toBeVisible()
  await expect(summary).toContainText('Read articles, Publish articles')

  const publishTarget = target.locator('[data-iris-transfer-item][data-value="publish-articles"]')
  await publishTarget.locator('input[type="checkbox"]').check()
  await transferPage.locator('[data-iris-transfer-to-source]').click()
  await expect(
    source.locator('[data-iris-transfer-item][data-value="publish-articles"]'),
  ).toBeVisible()
  await expect(summary).toContainText('Read articles')
  await expect(summary).not.toContainText('Publish articles')

  await sourceSearch.fill('')
  const deleteSource = source.locator('[data-iris-transfer-item][data-value="delete-users"]')
  const deleteCheckbox = deleteSource.locator('input[type="checkbox"]')
  await expect(deleteSource).toBeVisible()
  await expect(deleteCheckbox).toBeDisabled()
  await expect(deleteCheckbox).not.toBeChecked()
  await expect(summary).not.toContainText('Delete users')

  await source.locator('[data-iris-transfer-select-all]').check()
  await expect(deleteCheckbox).not.toBeChecked()
})
