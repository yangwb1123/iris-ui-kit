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
