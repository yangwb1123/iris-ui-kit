import { test, expect } from '@playwright/test'

/**
 * 回归：浮层定位不闪烁在视口左上角。
 * 历史根因：① 动画 keyframe 的 transform 覆盖 Floating UI 的定位 transform
 * （面板在 0,0 渲染 150ms 后跳到位）；② 首帧无定位坐标时直接可见。
 * 修复：动画 opacity-only + positioned 前 visibility: hidden。
 */
test('Select popover positions under the trigger (no origin flash)', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.goto('/#users')
  // 打开新建用户表单（内含角色/状态下拉）
  await page.getByRole('button', { name: /New user/ }).click()
  const trigger = page.locator('[data-iris-select-trigger]').first()
  await trigger.click()
  const panel = page.locator('[data-iris-select-listbox]')
  await expect(panel).toBeVisible()
  const t = await trigger.boundingBox()
  const p = await panel.boundingBox()
  expect(t).not.toBeNull()
  expect(p).not.toBeNull()
  // 面板应在触发器正下方附近（而非视口原点 0,0）
  expect(Math.abs(p!.x - t!.x)).toBeLessThan(80)
  expect(Math.abs(p!.y + p!.height / 2 - (t!.y + t!.height / 2))).toBeLessThan(120)
})
