import { readFile } from 'node:fs/promises'
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
  await expect(page.getByRole('row', { name: /Test1/ }).getByRole('textbox')).toBeVisible()
})

test('VxeGrid Example — controlled column widths', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')

  const section = page.locator('[data-iris-vxe-section="controlled-column-widths"]')
  const table = section.locator('[data-iris-table]')
  const readout = section.locator('[data-iris-vxe-column-widths-readout]')
  const handle = section.locator('[data-iris-table-resize-handle][data-column-key="name"]')
  const headerRow = table.locator('[data-iris-table-header-row], [data-iris-table-row="header"]')

  await expect(section).toHaveCount(1)
  await expect(table).toHaveCount(1)
  await expect(table.locator('[data-iris-table-header]')).toHaveCount(2)
  expect(
    await table
      .locator('[data-iris-table-header]')
      .evaluateAll((headers) =>
        headers.map((header) => header.getAttribute('data-iris-table-header')),
      ),
  ).toEqual(['name', 'age'])
  await expect(readout).toHaveText('{"name":200}')
  await expect(handle).toHaveCount(1)
  await expect(handle).toBeVisible()
  await expect(headerRow).toHaveCount(1)

  await handle.focus()
  await handle.press('ArrowRight')
  await expect(readout).toHaveText('{"name":216}')
  await expect
    .poll(() => headerRow.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns))
    .toContain('216px')

  await handle.press('ArrowLeft')
  await expect(readout).toHaveText('{"name":200}')
})

test('VxeGrid Example — controlled current row/column', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')

  const section = page.locator('[data-iris-vxe-section="current-row-column"]')
  await expect(
    section.getByRole('heading', {
      name: '受控当前行/列（Controlled current row/column）',
      exact: true,
    }),
  ).toBeVisible()

  await section.locator('[data-iris-table-row="10002"]').click()
  await section.locator('[data-iris-table-header="role"]').click()

  const currentRows = section.locator('[data-iris-row-current="true"]')
  await expect(currentRows).toHaveCount(1)
  await expect(currentRows).toHaveAttribute('data-iris-table-row', '10002')
  await expect(
    section.locator('[data-iris-table-row="10001"][data-iris-row-current="true"]'),
  ).toHaveCount(0)

  const currentColumns = section.locator('[data-iris-col-current="true"]')
  await expect(currentColumns).toHaveCount(1)
  await expect(currentColumns).toHaveAttribute('data-iris-table-header', 'role')
  await expect(
    section.locator('[data-iris-table-header="name"][data-iris-col-current="true"]'),
  ).toHaveCount(0)

  const readout = section.locator('[data-iris-vxe-current-readout]')
  await expect(readout).toBeVisible()
  await expect(readout).toContainText('currentRowKey: 10002')
  await expect(readout).toContainText('currentColumnKey: role')
})

test('VxeGrid Example — proxyConfig server-side section', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')
  await expect(
    page.getByRole('heading', { name: '服务端数据源（Server-side data source）' }),
  ).toBeVisible()
  // 初始加载（模拟 400ms 延迟）后出现第一页数据
  await expect(page.getByText('Test1', { exact: true }).last()).toBeVisible({ timeout: 8000 })
  // 远程分页：共 43 条 / 8 = 6 页（限定服务端数据源区）
  const proxySection = page.locator('section').filter({ hasText: '服务端数据源' })
  await expect(
    proxySection.locator('[data-iris-pagination-item]').filter({ hasText: '6' }).first(),
  ).toBeVisible()
})

test('VxeGrid Example — proxy error + built-in retry', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')

  const retrySection = page.locator('section').filter({ hasText: '代理错误与重试' })
  await expect(
    retrySection.getByRole('heading', {
      name: '代理错误与重试（Proxy error + retry）',
      exact: true,
    }),
  ).toBeVisible()

  const errorRow = retrySection.locator('[data-iris-table-row="error"]')
  await expect(errorRow).toBeVisible({ timeout: 8000 })
  const retryButton = retrySection.locator('[data-iris-table-retry]')
  await expect(retryButton).toHaveCount(1)
  await expect(retrySection.getByText('RetrySuccess', { exact: true })).toHaveCount(0)

  await retryButton.click()

  await expect(errorRow).toHaveCount(0, { timeout: 8000 })
  await expect(retrySection.getByText('RetrySuccess', { exact: true })).toBeVisible()
})

test('VxeGrid Example — formConfig search + toolbar buttons', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')
  await expect(page.getByRole('heading', { name: '搜索表单（Search form）' })).toBeVisible()
  // 表单字段
  await expect(page.getByText('Name', { exact: true }).last()).toBeVisible()
  // 自定义工具栏按钮（服务端数据源区）
  await expect(page.getByRole('button', { name: /共 43 条/ })).toBeVisible()
  // 搜索：输入 Name → 提交 → 远程查询带 filters（Test2 匹配 1 行）
  // 搜索表（第 4 区）容器
  const formSection = page.locator('section').filter({ hasText: '搜索表单' })
  await page.getByPlaceholder('Test2').fill('Test2')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  // 远程查询带 filters：仅 Test2 保留（加载完成后 Test2 可见）
  await expect(formSection.getByText('Test2', { exact: true })).toBeVisible({ timeout: 8000 })
  // 服务端筛选：Test1 不在当前结果
  await expect(formSection.getByText('Test1', { exact: true })).toHaveCount(0)
})

test('VxeGrid Example — mask-aware CSV download', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')

  const section = page.locator('[data-iris-vxe-section="masked-export"]')
  await expect(
    section.getByRole('heading', { name: '敏感信息导出（Masked export）' }),
  ).toBeVisible()
  const downloadButton = section.getByRole('button', { name: '下载脱敏 CSV', exact: true })
  await expect(downloadButton).toBeVisible()
  await expect(section.getByText('138****5678', { exact: true })).toBeVisible()
  await expect(section.getByText('139****1111', { exact: true })).toBeVisible()

  const renderedContent = await section.textContent()
  expect(renderedContent).not.toContain('13812345678')
  expect(renderedContent).not.toContain('13900001111')

  const downloadPromise = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('masked-contacts.csv')

  const filePath = await download.path()
  if (!filePath) throw new Error('Expected the masked CSV download to have a local path')
  const csv = (await readFile(filePath, 'utf8')).replace(/^\uFEFF/, '')
  expect(csv).toContain('138****5678')
  expect(csv).toContain('139****1111')
  expect(csv).not.toContain('13812345678')
  expect(csv).not.toContain('13900001111')
})

test('VxeGrid Example — controlled checkbox filter values', async ({ page }) => {
  await login(page)
  await page.goto('/#vxe-example')

  const section = page.locator('[data-iris-vxe-section="filter-values"]')
  const names = section.locator('[data-iris-table-cell="name"]')
  const statuses = section.locator('[data-iris-table-cell="status"]')
  const trigger = section.locator('[data-iris-filter-trigger="status"]')
  const panel = page.locator('[data-iris-table-filter-panel]')
  const readout = section.locator('[data-iris-vxe-filter-values-readout]')

  await expect(section).toHaveCount(1)
  await expect(names).toHaveText(['Active row', 'Paused row', 'Inactive row'])
  await expect(statuses).toHaveText(['active', 'paused', 'inactive'])
  await expect(readout).toHaveText('filterValues: {}')

  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-iris-filter-option]')).toHaveCount(2)
  await expect(panel.locator('[data-iris-filter-option="active"]')).toHaveCount(1)
  await expect(panel.locator('[data-iris-filter-option="paused"]')).toHaveCount(1)

  await panel
    .locator('[data-iris-filter-option="active"]')
    .evaluate((option) => (option.querySelector('label') ?? option).click())
  await panel.locator('[data-iris-filter-confirm]').click()
  await expect(names).toHaveText(['Active row'])
  await expect(statuses).toHaveText(['active'])
  await expect(trigger).toHaveAttribute('data-iris-filter-active', 'true')
  await expect(readout).toHaveText('filterValues: {"status":["active"]}')

  await trigger.click()
  await expect(panel.locator('[data-iris-filter-option="active"] input')).toBeChecked()
  await expect(panel.locator('[data-iris-filter-option="paused"] input')).not.toBeChecked()

  await panel
    .locator('[data-iris-filter-option="paused"]')
    .evaluate((option) => (option.querySelector('label') ?? option).click())
  await panel.locator('[data-iris-filter-confirm]').click()
  await expect(names).toHaveText(['Active row', 'Paused row'])
  await expect(statuses).toHaveText(['active', 'paused'])
  await expect(readout).toHaveText('filterValues: {"status":["active","paused"]}')

  await trigger.click()
  await panel.locator('[data-iris-filter-clear]').click()
  await expect(names).toHaveText(['Active row', 'Paused row', 'Inactive row'])
  await expect(statuses).toHaveText(['active', 'paused', 'inactive'])
  await expect(trigger).not.toHaveAttribute('data-iris-filter-active')
  await expect(readout).toHaveText('filterValues: {}')
})

test('VxeGrid Example — grouped headers + summary row', async ({ page }) => {
  await login(page)
  await page.locator('[data-iris-nav-item]').filter({ hasText: 'VxeGrid Example' }).click()

  const section = page.locator('[data-iris-vxe-section="grouped-summary"]')
  const table = section.locator('[data-iris-table]')
  const header = (key: string) => table.locator(`[data-iris-table-header="${key}"]`)

  await expect(section).toHaveCount(1)
  await expect(table).toHaveCount(1)
  await expect(
    section.getByRole('heading', {
      name: '分组表头与汇总行（Grouped headers + summary row）',
      exact: true,
    }),
  ).toBeVisible()
  await expect(table.locator('[data-iris-table-header-grouped]')).toHaveCount(1)
  await expect(table.locator('[data-iris-table-header]')).toHaveCount(4)
  expect(
    await table
      .locator('[data-iris-table-header]')
      .evaluateAll((headers) =>
        headers.map((element) => element.getAttribute('data-iris-table-header')),
      ),
  ).toEqual(['label', 'metrics', 'planned', 'actual'])

  await expect(header('metrics')).toHaveCount(1)
  await expect(header('metrics')).toContainText('Metrics')
  await expect(header('metrics')).toHaveAttribute('data-iris-table-header-group', '')
  await expect(header('metrics')).toHaveAttribute('aria-colspan', '2')

  for (const [key, title] of [
    ['label', 'Team'],
    ['planned', 'Planned'],
    ['actual', 'Actual'],
  ]) {
    await expect(header(key)).toHaveCount(1)
    await expect(header(key)).toHaveText(title)
    await expect(header(key)).not.toHaveAttribute('data-iris-table-header-group')
  }

  const bodyRows = table.locator(
    '[role="row"]:not([data-iris-table-row="header"]):not([data-iris-table-row="summary"])',
  )
  await expect(bodyRows).toHaveCount(2)
  await expect(bodyRows.nth(0).locator('[data-iris-table-cell="label"]')).toHaveText('North')
  await expect(bodyRows.nth(0).locator('[data-iris-table-cell="planned"]')).toHaveText('10')
  await expect(bodyRows.nth(0).locator('[data-iris-table-cell="actual"]')).toHaveText('20')
  await expect(bodyRows.nth(1).locator('[data-iris-table-cell="label"]')).toHaveText('South')
  await expect(bodyRows.nth(1).locator('[data-iris-table-cell="planned"]')).toHaveText('20')
  await expect(bodyRows.nth(1).locator('[data-iris-table-cell="actual"]')).toHaveText('40')
  await expect(bodyRows.locator('[data-iris-table-cell="metrics"]')).toHaveCount(0)

  const summary = table.locator('[data-iris-table-row="summary"]')
  await expect(summary).toHaveCount(1)
  const summaryCells = summary.locator('[data-iris-table-summary-cell]')
  await expect(summaryCells).toHaveCount(2)
  expect(
    await summaryCells.evaluateAll((cells) =>
      cells.map((element) => element.getAttribute('data-iris-table-cell')),
    ),
  ).toEqual(['planned', 'actual'])
  await expect(summary.locator('[data-iris-table-cell="planned"]')).toHaveAttribute(
    'data-iris-table-summary-cell',
    '',
  )
  await expect(summary.locator('[data-iris-table-cell="planned"]')).toHaveText('30')
  await expect(summary.locator('[data-iris-table-cell="actual"]')).toHaveAttribute(
    'data-iris-table-summary-cell',
    '',
  )
  await expect(summary.locator('[data-iris-table-cell="actual"]')).toHaveText('60')
})
