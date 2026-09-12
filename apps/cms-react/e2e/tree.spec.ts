import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible()
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

async function openTreeExample(page: Page) {
  await login(page)
  const treeNavItem = page.locator('[data-iris-nav-item][data-key="tree-example"]')
  await expect(treeNavItem).toBeVisible()
  await expect(treeNavItem).toBeEnabled()
  await treeNavItem.click()
  await expect(page).toHaveURL(/#\/tree-example$/)

  const pageRoot = page.locator('[data-page="tree-example"]')
  await expect(pageRoot).toBeVisible()
  await expect(pageRoot.getByRole('heading', { name: 'Tree Example', exact: true })).toBeVisible()
  return pageRoot
}

test('Tree Example — route, nested selection, and disabled cascade', async ({ page }) => {
  const pageRoot = await openTreeExample(page)
  const tree = pageRoot.locator('[data-iris-tree]')

  await expect(pageRoot.getByRole('tree', { name: 'Permission selection tree' })).toBeVisible()
  await expect(pageRoot.getByTestId('tree-selected-readout')).toHaveText('Selected IDs: none')
  await expect(pageRoot.getByTestId('tree-checked-readout')).toHaveText('Checked IDs: none')

  const treeNode = (id: string) => tree.locator(`[data-iris-tree-node="${id}"]`)
  const workspace = treeNode('workspace')
  const workspaceRead = treeNode('workspace-read')
  const workspaceManage = treeNode('workspace-manage')
  await expect(workspaceRead).toHaveCount(0)

  await workspace.locator('[data-iris-tree-toggle]').click()
  await expect(workspaceRead).toBeVisible()

  await workspaceRead.locator('[data-iris-tree-label]').click()
  await workspaceManage.locator('[data-iris-tree-label]').click()
  await expect(pageRoot.getByTestId('tree-selected-readout')).toHaveText(
    'Selected IDs: workspace-read, workspace-manage',
  )

  await workspaceManage.locator('[data-iris-tree-toggle]').click()
  const workspaceUsers = treeNode('workspace-users')
  const workspaceBilling = treeNode('workspace-billing')
  await expect(workspaceUsers).toBeVisible()
  await expect(workspaceBilling).toBeVisible()

  const workspaceCheckbox = workspace.locator('[data-iris-tree-checkbox]')
  await workspaceCheckbox.check()
  await expect(workspaceCheckbox).toBeChecked()
  await expect(workspaceRead.locator('[data-iris-tree-checkbox]')).toBeChecked()
  await expect(workspaceUsers.locator('[data-iris-tree-checkbox]')).toBeChecked()

  const billingCheckbox = workspaceBilling.locator('[data-iris-tree-checkbox]')
  await expect(billingCheckbox).toBeDisabled()
  await expect(billingCheckbox).not.toBeChecked()

  const checkedReadout = pageRoot.getByTestId('tree-checked-readout')
  await expect(checkedReadout).toContainText('workspace-read')
  await expect(checkedReadout).toContainText('workspace-users')
  await expect(checkedReadout).not.toContainText('workspace-billing')
})

test('Tree Example — deterministic audit log lazy loading', async ({ page }) => {
  const pageRoot = await openTreeExample(page)
  const tree = pageRoot.locator('[data-iris-tree]')
  const auditLog = tree.locator('[data-iris-tree-node="audit-log"]')
  const auditEvents = tree.locator('[data-iris-tree-node="audit-log-events"]')

  await expect(auditEvents).toHaveCount(0)
  await auditLog.locator('[data-iris-tree-toggle]').click()
  await expect(auditLog).toHaveAttribute('data-loading', '')
  await expect(auditLog.locator('.iris-button-spinner')).toBeVisible()
  await expect(auditEvents).toHaveCount(0)

  await expect(auditEvents).toBeVisible({ timeout: 5000 })
  await expect(auditLog).not.toHaveAttribute('data-loading', '')
})
