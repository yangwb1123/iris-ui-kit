import { test, expect } from '@playwright/test'

test('probe3', async ({ page }) => {
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
  const out = await page.evaluate(() => {
    const main =
      document.querySelector('main') ||
      document.querySelector('[data-iris-page-host]') ||
      document.body
    // find the div containing the h2
    const h2 = [...document.querySelectorAll('h2')].find((h) =>
      (h.textContent || '').includes('基础用法'),
    )
    let chain = ''
    let el: HTMLElement | null = h2
    while (el && chain.length < 600) {
      const r = el.getBoundingClientRect()
      chain += `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 30)}" style="${(el.getAttribute('style') || '').slice(0, 80)}" y=${Math.round(r.y)} h=${Math.round(r.height)}>\n`
      el = el.parentElement
    }
    return chain
  })
  console.log(base, JSON.stringify(out))
})
