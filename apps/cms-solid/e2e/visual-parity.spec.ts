import { test, expect, type Page } from '@playwright/test'

/**
 * 四框架渲染一致性终验：同一产品旅程（登录 → Users 页）在 Vue/React/
 * Solid/Svelte 四个真实 bundle 中渲染，与 React 渲染的基线像素对比。
 *
 * 阈值策略（诚实分级）：
 * - Solid/Svelte：maxDiffPixelRatio 0.02 —— 已知与 React 像素一致（硬门）
 * - Vue：maxDiffPixelRatio 0.05 —— 已知 2.8% 渲染基线（border 1px
 *   抗锯齿/DOM 结构微差，h() 渲染固有），>5% 视为回归（回归门）
 *   已知基线归因见 docs/ui-audit/visual/REPORT-v2.md
 */

const THEMES = ['light', 'dark'] as const

test.use({ viewport: { width: 1280, height: 1000 } })

async function login(page: Page): Promise<void> {
  await page.goto('/')
  const usernameInput = page.getByRole('textbox', { name: 'Username' })
  await expect(usernameInput).toBeVisible()
  await usernameInput.fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

async function openUsers(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Users', exact: true }).click()
  await page.getByRole('button', { name: 'All users', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All users' })).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).not.toHaveCount(0)
}

const FRAMEWORK = process.env.PARITY_FRAMEWORK ?? 'react'

for (const theme of THEMES) {
  test(`users-${theme} matches React baseline`, async ({ page }) => {
    await login(page)
    await openUsers(page)
    if (theme === 'dark') {
      const toggle = page.getByRole('banner').getByRole('button', { name: /^(Dark|Light) mode$/ })
      await expect(toggle).toBeVisible()
      await toggle.click()
      await expect(toggle).toHaveAccessibleName('Light mode')
    }
    // 消除焦点态差异（focus ring 会引入 primary 紫像素噪声）
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
    await page.waitForTimeout(400)
    const tolerance = FRAMEWORK === 'vue' ? 0.05 : 0.02
    await expect(page).toHaveScreenshot(`crossfw-${theme}-react.png`, {
      threshold: 0.2,
      maxDiffPixelRatio: tolerance,
      animations: 'disabled',
    })
  })
}

/**
 * VxeGrid 示例页 parity（batch AF）：与 users 块同旅程、同阈值，换页不换主题。
 * 页面内容高 ~1913px > 1280×1000 视口，故本 describe 用更高视口（1280×2000）
 * 单屏容纳 —— 刻意不用 fullPage（sticky header 拼接陷阱见 visual.spec.ts），
 * 更高视口直接免滚动。数据静态，基线确定；截图前先等代理区 400ms 模拟延迟
 * 出数。Solid 壳无 hash router，用菜单点击进页（React 用 /#vxe-example）。
 */
test.describe('vxe example', () => {
  test.use({ viewport: { width: 1280, height: 2000 } })

  async function openVxeExample(page: Page): Promise<void> {
    await page.locator('[data-iris-nav-item]').filter({ hasText: 'VxeGrid Example' }).click()
    await expect(
      page.getByRole('heading', { name: 'vxe-grid 基础用法（Basic usage）' }),
    ).toBeVisible()
    // 代理区（服务端数据源）初始加载有 400ms 模拟延迟——出数后才截图。
    const proxySection = page.locator('section').filter({ hasText: '服务端数据源' })
    await expect(proxySection.getByText('Test1', { exact: true })).toBeVisible({
      timeout: 8000,
    })
  }

  for (const theme of THEMES) {
    test(`vxe-${theme} matches React baseline`, async ({ page }) => {
      await login(page)
      await openVxeExample(page)
      if (theme === 'dark') {
        const toggle = page.getByRole('banner').getByRole('button', { name: /^(Dark|Light) mode$/ })
        await expect(toggle).toBeVisible()
        await toggle.click()
        await expect(toggle).toHaveAccessibleName('Light mode')
      }
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
      await page.waitForTimeout(400)
      const tolerance = FRAMEWORK === 'vue' ? 0.05 : 0.02
      await expect(page).toHaveScreenshot(`vxe-${theme}-react.png`, {
        threshold: 0.2,
        maxDiffPixelRatio: tolerance,
        animations: 'disabled',
      })
    })
  }
})
