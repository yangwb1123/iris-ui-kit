import { test } from '@playwright/test'
test('probe vue', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Username' }).fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor()
  await page.locator('[data-iris-nav-item]').filter({ hasText: 'VxeGrid Example' }).click()
  await page.getByRole('heading', { name: 'vxe-grid 基础用法（Basic usage）' }).waitFor()
  await page.waitForTimeout(800)
  const info = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-iris-table]')][0]
    const out: any[] = []
    for (const el of t.querySelectorAll(
      '[data-iris-table-header], [data-iris-table-row] [role="cell"]',
    )) {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      out.push({
        key: el.getAttribute('data-iris-table-cell') ?? el.getAttribute('data-iris-table-header'),
        x: Math.round(r.x),
        w: Math.round(r.width),
        h: Math.round(r.height),
        fs: s.fontSize,
        txt: (el.textContent || '').trim().slice(0, 10),
      })
    }
    return out.slice(0, 13)
  })
  console.log('VUE', JSON.stringify(info))
})
