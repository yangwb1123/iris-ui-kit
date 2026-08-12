import { test, expect } from '@playwright/test'
test('row rects', async ({ page }) => {
  const base = process.env.PROBE_BASE!
  await page.goto(base + '/')
  await page.getByRole('textbox', { name: 'Username' }).fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  if (base.includes('5176')) await page.goto(base + '/#vxe-example')
  else await page.locator('[data-iris-nav-item]').filter({ hasText: 'VxeGrid Example' }).click()
  await expect(
    page.getByRole('heading', { name: 'vxe-grid 基础用法（Basic usage）' }),
  ).toBeVisible()
  const info = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-iris-table]')][0]
    const rows = [...t.querySelectorAll('[data-iris-table-row]')]
    const r1 = rows[1] // first data row
    const cells = [...r1.querySelectorAll('[role="cell"]')].map((c) => {
      const r = c.getBoundingClientRect()
      return {
        d: c.getAttribute('data-iris-table-cell'),
        x: Math.round(r.x),
        w: Math.round(r.width),
        txt: (c.textContent || '').trim().slice(0, 12),
      }
    })
    const tpl = t.getAttribute('style') || ''
    const grid = getComputedStyle(t).gridTemplateColumns
    return { cells, grid, tpl: tpl.slice(0, 200) }
  })
  console.log(base, JSON.stringify(info))
})
