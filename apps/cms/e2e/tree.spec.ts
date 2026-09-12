import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible()
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

test('Tree Example — route, nested selection, and disabled cascade', async ({ page }) => {
  const pageRoot = await gotoTreeExample(page)
  const tree = pageRoot.locator('[data-iris-tree]')

  await expect(pageRoot.getByRole('tree', { name: 'Permission selection tree' })).toBeVisible()
  await expect(pageRoot.getByTestId('tree-selected-readout')).toHaveText('Selected IDs: none')
  await expect(pageRoot.getByTestId('tree-checked-readout')).toHaveText('Checked IDs: none')

  const workspace = tree.locator('[data-iris-tree-item][data-id="workspace"]')
  const workspaceRead = tree.locator('[data-iris-tree-item][data-id="workspace-read"]')
  const workspaceManage = tree.locator('[data-iris-tree-item][data-id="workspace-manage"]')
  await expect(workspaceRead).toHaveCount(0)

  await workspace.locator('[data-iris-tree-chevron]').click()
  await expect(workspaceRead).toBeVisible()

  await workspaceRead.getByText('Read workspace', { exact: true }).click()
  await workspaceManage.getByText('Manage workspace', { exact: true }).click()
  await expect(pageRoot.getByTestId('tree-selected-readout')).toHaveText(
    'Selected IDs: workspace-read, workspace-manage',
  )

  await workspaceManage.locator('[data-iris-tree-chevron]').click()
  const workspaceUsers = tree.locator('[data-iris-tree-item][data-id="workspace-users"]')
  const workspaceBilling = tree.locator('[data-iris-tree-item][data-id="workspace-billing"]')
  await expect(workspaceUsers).toBeVisible()
  await expect(workspaceBilling).toBeVisible()

  await workspace.locator('[data-iris-tree-checkbox]').check()
  await expect(workspaceUsers.locator('[data-iris-tree-checkbox]')).toBeChecked()
  await expect(workspaceRead.locator('[data-iris-tree-checkbox]')).toBeChecked()
  await expect(workspaceBilling.locator('[data-iris-tree-checkbox]')).toBeDisabled()
  await expect(workspaceBilling.locator('[data-iris-tree-checkbox]')).not.toBeChecked()

  const checkedReadout = pageRoot.getByTestId('tree-checked-readout')
  await expect(checkedReadout).toContainText('workspace-read')
  await expect(checkedReadout).toContainText('workspace-users')
  await expect(checkedReadout).not.toContainText('workspace-billing')
})

test('Tree Example — deterministic audit log lazy loading', async ({ page }) => {
  const pageRoot = await gotoTreeExample(page)
  const tree = pageRoot.locator('[data-iris-tree]')
  const auditLog = tree.locator('[data-iris-tree-item][data-id="audit-log"]')
  const auditEvents = tree.locator('[data-iris-tree-item][data-id="audit-log-events"]')

  await expect(auditEvents).toHaveCount(0)
  await auditLog.locator('[data-iris-tree-chevron]').click()
  await expect(auditLog).toHaveAttribute('data-loading', '', { timeout: 1000 })
  const loadingAuditLog = tree.locator('[data-iris-tree-item][data-id="audit-log"][data-loading]')
  await expect(loadingAuditLog).toBeVisible()
  await expect(loadingAuditLog.locator('.iris-button-spinner')).toBeVisible()
  await expect(auditEvents).toHaveCount(0)

  await expect(auditEvents).toBeVisible({ timeout: 5000 })
  await expect(loadingAuditLog).toHaveCount(0)
})
