import { test, expect, type Page } from '@playwright/test'

/**
 * VxeGrid example page E2E for the Svelte CMS app — mirror of the React
 * `pages.spec.ts` vxe tests (batch AE landed identical pages in all four
 * frameworks: same section headings, data, 400ms proxy delay and search form).
 * Login uses the visual-parity flow, verified identical across all four apps.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  // Generous timeout: the Vite dev server cold-compiles on first hit.
  await expect(usernameInput).toBeVisible({ timeout: 10_000 })
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
  // 行编辑标题 + 单元格点击进入编辑。svelte 适配器缺 editConfig.trigger 支持
  // （仅 dblclick 触发，react/vue/solid 支持 trigger:'click'），故用双击。
  await expect(page.getByRole('heading', { name: '行编辑（Row editing）' })).toBeVisible()
  await page.getByText('Test1', { exact: true }).nth(1).dblclick()
  await expect(page.getByRole('row', { name: /Test1/ }).getByRole('textbox')).toBeVisible()
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
