import { test, expect, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible({ timeout: 10_000 })
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function gotoTreeExample(page: Page) {
  await login(page)
  const treeNavItem = page.locator('[data-iris-nav-item][data-key="tree-example"]')
  await expect(treeNavItem).toBeVisible()
  await treeNavItem.click()
  const pageRoot = page.locator('[data-page="tree-example"]')
  await expect(pageRoot).toBeVisible()
  await expect(pageRoot.getByRole('heading', { name: 'Tree Example', exact: true })).toBeVisible()
  return pageRoot
}

test('Tree Example — route, selection, and permission cascade', async ({ page }) => {
  const pageRoot = await gotoTreeExample(page)
  await expect(pageRoot.getByRole('tree', { name: 'Permission selection tree' })).toBeVisible()

  const selectedReadout = pageRoot.getByTestId('tree-selected-readout')
  const checkedReadout = pageRoot.getByTestId('tree-checked-readout')
  await expect(selectedReadout).toHaveText('Selected IDs: none')
  await expect(checkedReadout).toHaveText('Checked IDs: none')

  const tree = pageRoot.locator('[data-iris-tree]')
  const workspace = tree.locator('[data-iris-tree-node="workspace"]')
  await expect(tree.locator('[data-iris-tree-node="workspace-read"]')).toHaveCount(0)
  await workspace.locator('[data-iris-tree-expand]').click()
  await expect(tree.locator('[data-iris-tree-node="workspace-read"]')).toBeVisible()

  await tree.locator('[data-iris-tree-node="workspace-read"] [data-iris-tree-node-row]').click()
  await expect(selectedReadout).toContainText('workspace-read')

  await tree.locator('[data-iris-tree-checkbox="workspace"]').check()
  await expect(checkedReadout).toContainText('workspace-read')
  await expect(checkedReadout).toContainText('workspace-users')
  await expect(checkedReadout).not.toContainText('workspace-billing')

  await tree.locator('[data-iris-tree-node="workspace-manage"] [data-iris-tree-expand]').click()
  await expect(tree.locator('[data-iris-tree-node="workspace-users"]')).toBeVisible()
  await expect(tree.locator('[data-iris-tree-node="workspace-billing"]')).toBeVisible()
  await expect(tree.locator('[data-iris-tree-checkbox="workspace-users"]')).toBeChecked()
  await expect(tree.locator('[data-iris-tree-checkbox="workspace-billing"]')).toBeDisabled()
  await expect(tree.locator('[data-iris-tree-checkbox="workspace-billing"]')).not.toBeChecked()
})

test('Tree Example — audit log lazy loading', async ({ page }) => {
  const pageRoot = await gotoTreeExample(page)
  const tree = pageRoot.locator('[data-iris-tree]')
  const auditLog = tree.locator('[data-iris-tree-node="audit-log"]')

  await expect(tree.locator('[data-iris-tree-node="audit-log-events"]')).toHaveCount(0)
  await auditLog.locator('[data-iris-tree-expand]').click()
  await expect(auditLog).toHaveAttribute('aria-busy', 'true')
  await expect(auditLog.locator('[data-iris-tree-loading]')).toBeVisible()
  await expect(tree.locator('[data-iris-tree-node="audit-log-events"]')).toHaveCount(0)
  await expect(tree.locator('[data-iris-tree-node="audit-log-events"]')).toBeVisible({
    timeout: 5000,
  })
})
