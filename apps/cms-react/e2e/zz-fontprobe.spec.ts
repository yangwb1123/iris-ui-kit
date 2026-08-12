import { test } from '@playwright/test'

async function probe(page: any, label: string) {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Username' }).fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor()
  if (label === 'REACT') await page.goto('/#vxe-example')
  else await page.locator('[data-iris-nav-item]').filter({ hasText: 'VxeGrid Example' }).click()
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
        tag: el.getAttribute('data-iris-table-header') !== null ? 'H' : 'C',
        key: el.getAttribute('data-iris-table-cell') ?? el.getAttribute('data-iris-table-header'),
        x: Math.round(r.x),
        w: Math.round(r.width),
        h: Math.round(r.height),
        fs: s.fontSize,
        pad: s.padding,
        lh: s.lineHeight,
        border: s.borderBottomWidth,
        txt: (el.textContent || '').trim().slice(0, 10),
      })
    }
    return out.slice(0, 20)
  })
  console.log(label, JSON.stringify(info))
}

test('probe react', async ({ page }) => probe(page, 'REACT'))
