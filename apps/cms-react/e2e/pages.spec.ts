import { test, expect, type Page } from '@playwright/test'

/**
 * E2E smoke tests for CMS pages: Form Builder, ProTable, Users.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const submit = page.getByRole('button', { name: 'Sign in', exact: true })
  await expect(submit).toBeVisible()
  await submit.click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

test('Form Builder page — renders schema-driven form fields', async ({ page }) => {
  await login(page)
  await page.goto('/#form-builder')

  await expect(page.getByRole('heading', { name: 'Form Builder' })).toBeVisible()
  await expect(page.getByText('Full Name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible()
})

test('Form Builder — renders fields and submit button', async ({ page }) => {
  await login(page)
  await page.goto('/#form-builder')

  // The page heading
  await expect(page.getByRole('heading', { name: 'Form Builder' })).toBeVisible()

  // Check that the submit button exists
  await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible()

  // Verify the form rendered by checking for a known field label
  await expect(page.getByText('Full Name')).toBeVisible()
})

test('ProTable page — renders CRUD table', async ({ page }) => {
  await login(page)
  await page.goto('/#pro-table')

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByText('Ergonomic Keyboard')).toBeVisible()
  await expect(page.getByText('USB-C Hub')).toBeVisible()
})

test('Users page — shows table with data', async ({ page }) => {
  await login(page)
  await page.goto('/#users')

  const table = page.getByRole('table')
  await expect(table).toBeVisible()
  const rows = table.getByRole('row')
  await expect(rows).not.toHaveCount(0)
})

test('VxeGrid Example — official basic-usage grid parity', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')

  await expect(
    page.getByRole('heading', { name: 'vxe-grid 基础用法（Basic usage）' }),
  ).toBeVisible()
  // 官方数据 6 行（两个表各一份，用 first）
  await expect(page.getByText('Test1', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Test6', { exact: true }).first()).toBeVisible()
  // seq 序号列
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible()
  // 排序可点（Name 表头）
  const nameHeader = page.getByRole('columnheader', { name: /Name/ })
  await expect(nameHeader.first()).toBeVisible()
  // 行编辑标题 + 单元格点击进入编辑
  await expect(page.getByRole('heading', { name: '行编辑（Row editing）' })).toBeVisible()
  await page.getByText('Test1', { exact: true }).nth(1).click()
  await expect(page.getByRole('textbox')).toBeVisible()
})

test('VxeGrid Example — proxyConfig server-side section', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')
  await expect(
    page.getByRole('heading', { name: '服务端数据源（Server-side data source）' }),
  ).toBeVisible()
  // 初始加载（模拟 400ms 延迟）后出现第一页数据
  await expect(page.getByText('Test1', { exact: true }).last()).toBeVisible({ timeout: 8000 })
  // 远程分页：共 43 条 / 8 = 6 页
  await expect(page.getByRole('button', { name: /6/ })).toBeVisible()
})
