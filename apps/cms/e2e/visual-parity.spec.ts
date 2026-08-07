import { test, expect, type Page } from '@playwright/test'

/**
 * 四框架渲染一致性终验：同一产品旅程（登录 → Users 页）在 Vue/React/
 * Solid/Svelte 四个真实 bundle 中渲染，与 React 渲染的基线像素对比。
 * 快照名 crossfw-{theme}-react.png：react app 首跑 --update-snapshots
 * 生成，复制到其余 3 个 app 的快照目录后，各 app 跑本 spec 即得
 * 「本框架 vs React」像素 diff。
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
    await expect(page).toHaveScreenshot(`crossfw-${theme}-react.png`, {
      threshold: 0.2,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    })
  })
}
