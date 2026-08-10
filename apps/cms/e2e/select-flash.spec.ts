import { test, expect } from '@playwright/test'

/**
 * 回归（vue 框架）：浮层定位不闪烁在视口左上角。
 * 修复：动画 keyframes opacity-only（不覆盖 Floating UI 定位 transform）
 * + 首次 computePosition 落位前 visibility: hidden。
 */
test('Select popover positions under the trigger (no origin flash)', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder(/ada or viewer/).fill('ada')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('[data-iris-nav-menu]')).toBeVisible({ timeout: 8000 })
  // 通过导航进入 Users
  await page.locator('[data-iris-nav-item]').filter({ hasText: 'Users' }).click()
  await page.getByRole('button', { name: /New user/ }).click()
  const trigger = page.locator('[data-iris-select-trigger]').first()
  await trigger.click()
  const panel = page.locator('[data-iris-select-listbox]')
  await expect(panel).toBeVisible()
  const t = await trigger.boundingBox()
  const p = await panel.boundingBox()
  expect(t).not.toBeNull()
  expect(p).not.toBeNull()
  expect(Math.abs(p!.x - t!.x)).toBeLessThan(80)
  expect(Math.abs(p!.y + p!.height / 2 - (t!.y + t!.height / 2))).toBeLessThan(120)
})
