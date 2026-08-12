import { test } from '@playwright/test'
test('probe solid2', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Username' }).fill('ada')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor()
  await page.locator('[data-iris-nav-item]').filter({ hasText: 'VxeGrid Example' }).click()
  await page.getByRole('heading', { name: 'vxe-grid 基础用法（Basic usage）' }).waitFor()
  await page.waitForTimeout(600)
  const info = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-iris-table]')][0]
    const hdr = t.querySelector('[data-iris-table-header="name"]')!
    const s = getComputedStyle(hdr)
    return {
      inline: hdr.getAttribute('style'),
      fs: s.fontSize,
      // find stylesheet rules matching the header
      rules: [...document.styleSheets]
        .flatMap((sh) => {
          try {
            return [...sh.cssRules]
          } catch {
            return []
          }
        })
        .filter(
          (r: any) =>
            r.selectorText &&
            (r.selectorText.includes('columnheader') ||
              r.selectorText.includes('iris-table-header') ||
              r.selectorText.includes('font-size')),
        )
        .slice(0, 10)
        .map((r: any) => `${r.selectorText} { ${r.style.cssText} }`),
    }
  })
  console.log('SOLID2', JSON.stringify(info))
})
