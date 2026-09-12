import { test, expect, type Page } from '@playwright/test'

/**
 * VxeGrid example page E2E for the Vue CMS app — mirror of the React
 * `pages.spec.ts` vxe tests (batch AE landed identical pages in all four
 * frameworks: same section headings, data, 400ms proxy delay and search form).
 * Login uses the visual-parity flow, verified identical across all four apps.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible()
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function gotoVxeExample(page: Page): Promise<void> {
  await login(page)
  // Navigate via the menu key each app registered for the example page (batch
  // AE): vue/solid/svelte shells have no hash router, so the menu click is the
  // app-native navigation (React specs use the `/#vxe-example` hash route).
  await page.locator('[data-iris-nav-item]').filter({ hasText: 'VxeGrid Example' }).click()
  await expect(
    page.getByRole('heading', { name: 'vxe-grid 基础用法（Basic usage）' }),
  ).toBeVisible()
}

test('VxeGrid Example — official basic-usage grid parity', async ({ page }) => {
  await gotoVxeExample(page)

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
  await gotoVxeExample(page)

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

test('VxeGrid Example — proxyConfig server-side section', async ({ page }) => {
  await gotoVxeExample(page)
  await expect(
    page.getByRole('heading', { name: '服务端数据源（Server-side data source）' }),
  ).toBeVisible()
  // 初始加载（模拟 400ms 延迟）后出现第一页数据（限定服务端数据源区）
  const proxySection = page.locator('section').filter({ hasText: '服务端数据源' })
  await expect(proxySection.getByText('Test1', { exact: true })).toBeVisible({ timeout: 8000 })
  // 远程分页：共 43 条 / 8 = 6 页（限定服务端数据源区）
  await expect(
    proxySection.locator('[data-iris-pagination-item]').filter({ hasText: '6' }).first(),
  ).toBeVisible()
})

test('VxeGrid Example — proxy error and retry', async ({ page }) => {
  await gotoVxeExample(page)

  const retrySection = page.locator('section').filter({ hasText: '代理错误与重试' })
  const errorRow = retrySection.locator('[data-iris-table-row="error"]')

  await expect(errorRow).toBeVisible({ timeout: 8000 })
  await expect(retrySection.locator('[data-iris-table-retry]')).toHaveCount(1)

  await retrySection.locator('[data-iris-table-retry]').click()

  await expect(errorRow).toHaveCount(0, { timeout: 8000 })
  await expect(retrySection.getByText('RetrySuccess', { exact: true })).toBeVisible({
    timeout: 8000,
  })
})

test('VxeGrid Example — formConfig search + toolbar buttons', async ({ page }) => {
  await gotoVxeExample(page)
  await expect(page.getByRole('heading', { name: '搜索表单（Search form）' })).toBeVisible()
  // 表单字段
  await expect(page.getByText('Name', { exact: true }).last()).toBeVisible()
  // 自定义工具栏按钮（服务端数据源区）
  await expect(page.getByRole('button', { name: /共 43 条/ })).toBeVisible()
  // 搜索：输入 Name → 提交 → 远程查询带 filters（Test2 匹配 1 行）
  const formSection = page.locator('section').filter({ hasText: '搜索表单' })
  await page.getByPlaceholder('Test2').fill('Test2')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  // 远程查询带 filters：仅 Test2 保留（加载完成后 Test2 可见）
  await expect(formSection.getByText('Test2', { exact: true })).toBeVisible({ timeout: 8000 })
  // 服务端筛选：Test1 不在当前结果
  await expect(formSection.getByText('Test1', { exact: true })).toHaveCount(0)
})

test('VxeGrid Example — parent-controlled column drag ordering', async ({ page }) => {
  await gotoVxeExample(page)

  const section = page.locator('section').filter({ hasText: '列拖拽排序（Column drag ordering）' })
  await expect(
    section.getByRole('heading', { name: '列拖拽排序（Column drag ordering）' }),
  ).toBeVisible()
  for (const name of [
    'vxe-grid 基础用法（Basic usage）',
    '行编辑（Row editing）',
    '服务端数据源（Server-side data source）',
    '代理错误与重试（Proxy error + retry）',
    '搜索表单（Search form）',
    '行操作（Row ops）',
  ]) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }

  const table = section.locator('[data-iris-table]')
  const firstRow = table.locator('[data-iris-table-row-key="30001"]')
  const headerKeys = () =>
    table
      .locator('[data-iris-table-header]')
      .evaluateAll((headers) =>
        headers.map((header) => header.getAttribute('data-iris-table-header')),
      )
  const bodyCellKeys = () =>
    firstRow
      .locator('[data-iris-table-cell]')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-iris-table-cell')))
  const bodyValues = () =>
    firstRow
      .locator('[data-iris-table-cell]')
      .evaluateAll((cells) => cells.map((cell) => cell.textContent?.trim() ?? ''))

  await expect(table.locator('[data-iris-table-header]')).toHaveCount(3)
  await expect(firstRow).toBeVisible()
  await expect.poll(headerKeys).toEqual(['name', 'role', 'age'])
  await expect.poll(bodyCellKeys).toEqual(['name', 'role', 'age'])
  await expect.poll(bodyValues).toEqual(['DragName', 'DragRole', '42'])
  await expect(section.locator('[data-iris-vxe-column-order]')).toHaveText(
    '当前列顺序：Name, Role, Age',
  )

  const nameHeader = table.locator('[data-iris-table-header="name"]')
  const ageHeader = table.locator('[data-iris-table-header="age"]')
  await nameHeader.scrollIntoViewIfNeeded()
  const nameBox = await nameHeader.boundingBox()
  const ageBox = await ageHeader.boundingBox()
  if (!nameBox || !ageBox) throw new Error('Column drag headers have no browser geometry')

  await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(nameBox.x + nameBox.width / 2 + 12, nameBox.y + nameBox.height / 2, {
    steps: 2,
  })
  await page.mouse.move(ageBox.x + ageBox.width / 2, ageBox.y + ageBox.height / 2, {
    steps: 5,
  })
  await page.mouse.up()

  await expect.poll(headerKeys).toEqual(['role', 'age', 'name'])
  await expect.poll(bodyCellKeys).toEqual(['role', 'age', 'name'])
  await expect.poll(bodyValues).toEqual(['DragRole', '42', 'DragName'])
  await expect(section.locator('[data-iris-vxe-column-order]')).toHaveText(
    '当前列顺序：Role, Age, Name',
  )
})

test('VxeGrid Example — controlled checkbox filter values', async ({ page }) => {
  await gotoVxeExample(page)

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
  await gotoVxeExample(page)

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
