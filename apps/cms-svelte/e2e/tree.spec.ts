import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible({ timeout: 10_000 })
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

async function openTreeExample(page: Page) {
  await login(page)
  const treeNavItem = page.locator('[data-iris-nav-item][data-key="tree-example"]')
  await expect(treeNavItem).toBeVisible()
  await treeNavItem.click()

  const pageRoot = page.locator('[data-page="tree-example"]')
  await expect(pageRoot.getByRole('heading', { name: 'Tree Example', exact: true })).toBeVisible()
  return pageRoot
}

test('Tree Example — nested selection and disabled cascade', async ({ page }) => {
  const pageRoot = await openTreeExample(page)
  const tree = pageRoot.locator('[data-iris-tree]')
  await expect(pageRoot.getByRole('tree', { name: 'Permission selection tree' })).toBeVisible()

  const treeItem = (label: string) =>
    tree.locator('[data-iris-tree-item]').filter({ hasText: label }).first()

  await expect(tree.getByText('Read workspace', { exact: true })).toHaveCount(0)

  const workspace = treeItem('Workspace')
  await workspace.locator('button').click()
  await expect(tree.getByText('Read workspace', { exact: true })).toBeVisible()

  await treeItem('Read workspace').getByText('Read workspace', { exact: true }).click()
  await treeItem('Manage workspace').getByText('Manage workspace', { exact: true }).click()
  const selectedReadout = pageRoot.getByTestId('tree-selected-readout')
  await expect(selectedReadout).toContainText('workspace-read')
  await expect(selectedReadout).toContainText('workspace-manage')

  await treeItem('Manage workspace').locator('button').click()
  await workspace.locator('[data-iris-tree-checkbox]').check()

  const checkedReadout = pageRoot.getByTestId('tree-checked-readout')
  await expect(checkedReadout).toContainText('workspace-read')
  await expect(checkedReadout).toContainText('workspace-users')
  await expect(checkedReadout).not.toContainText('workspace-billing')

  const billingCheckbox = treeItem('Manage billing').locator('[data-iris-tree-checkbox]')
  await expect(billingCheckbox).toBeDisabled()
  await expect(billingCheckbox).not.toBeChecked()
})

test('Tree Example — deterministic lazy loading', async ({ page }) => {
  const pageRoot = await openTreeExample(page)
  const tree = pageRoot.locator('[data-iris-tree]')
  const treeItem = (label: string) =>
    tree.locator('[data-iris-tree-item]').filter({ hasText: label }).first()
  const auditLog = treeItem('Audit log')
  const auditEvents = tree.getByText('View audit events', { exact: true })

  await expect(auditEvents).toHaveCount(0)
  await auditLog.locator('button').click()
  await expect(auditLog).toHaveAttribute('data-loading', '')
  await expect(auditLog.getByText('…', { exact: true })).toBeVisible()
  await expect(auditEvents).toHaveCount(0)
  await expect(auditEvents).toBeVisible({ timeout: 5_000 })
})
