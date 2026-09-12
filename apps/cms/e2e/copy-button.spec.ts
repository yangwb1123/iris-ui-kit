import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Username' }).fill('ada')
  await page.getByRole('textbox', { name: 'Password' }).fill('secret')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

async function gotoCopyButton(page: Page) {
  await login(page)
  const navItem = page.locator('[data-iris-nav-item][data-key="copy-button"]')
  await expect(navItem).toBeVisible()
  await navItem.click()

  const pageRoot = page.locator('[data-page="copy-button"]')
  await expect(pageRoot).toBeVisible()
  await expect(pageRoot.getByRole('heading', { name: 'Copy Button', exact: true })).toBeVisible()
  return pageRoot
}

test('copy button page is reachable with deterministic initial states', async ({ page }) => {
  const pageRoot = await gotoCopyButton(page)

  const activeButton = pageRoot.getByTestId('copy-active-button')
  const disabledButton = pageRoot.getByTestId('copy-disabled-button')
  await expect(pageRoot.locator('[data-iris-copy-button]')).toHaveCount(2)
  await expect(activeButton).toHaveText('Copy sample')
  await expect(activeButton).not.toHaveAttribute('data-copied')
  await expect(disabledButton).toBeDisabled()
  await expect(disabledButton).toHaveText('Copy disabled sample')
  await expect(disabledButton).not.toHaveAttribute('data-copied')
  const readout = pageRoot.getByTestId('copy-event-readout')
  await expect(readout).toHaveAttribute('role', 'status')
  await expect(readout).toHaveAttribute('aria-live', 'polite')
  await expect(readout).toHaveText('Last copied text: none')
})

test('active copy shows the event payload and resets its visual state', async ({ page }) => {
  const pageRoot = await gotoCopyButton(page)
  const activeButton = pageRoot.getByTestId('copy-active-button')
  const readout = pageRoot.getByTestId('copy-event-readout')

  await activeButton.click()
  await expect(activeButton).toHaveAttribute('data-copied', 'true')
  await expect(activeButton).toHaveText('Copied!')
  await expect(readout).toHaveText('Last copied text: Iris CMS copy-button sample')

  await expect(activeButton).not.toHaveAttribute('data-copied', { timeout: 1000 })
  await expect(activeButton).toHaveText('Copy sample')
  await expect(readout).toHaveText('Last copied text: Iris CMS copy-button sample')
})

test('disabled copy ignores activation without emitting or changing state', async ({ page }) => {
  const pageRoot = await gotoCopyButton(page)
  const disabledButton = pageRoot.getByTestId('copy-disabled-button')
  const readout = pageRoot.getByTestId('copy-event-readout')

  await disabledButton.dispatchEvent('click')
  await expect(disabledButton).toBeDisabled()
  await expect(disabledButton).not.toHaveAttribute('data-copied')
  await expect(disabledButton).toHaveText('Copy disabled sample')
  await expect(readout).toHaveText('Last copied text: none')
})
