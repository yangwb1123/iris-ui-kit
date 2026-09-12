// @vitest-environment jsdom

import { createApp, nextTick, type App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import TransferPage from './TransferPage.vue'

describe('Vue CMS Transfer page', () => {
  let app: App<Element> | undefined

  afterEach(() => {
    app?.unmount()
    app = undefined
  })

  it('renders searchable panes with the initial assignment and disabled permission', async () => {
    const container = document.createElement('div')
    app = createApp(TransferPage)
    app.mount(container)
    await nextTick()

    expect(container.querySelector('[data-page="transfer"]')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toContain('Transfer')
    expect(container.querySelectorAll('[data-iris-transfer-pane]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-iris-transfer-search]')).toHaveLength(2)

    const targetRead = container.querySelector(
      '[data-side="target"] [data-iris-transfer-item][data-value="read-articles"]',
    )
    expect(targetRead).not.toBeNull()

    const sourceDelete = container.querySelector(
      '[data-side="source"] [data-iris-transfer-item][data-value="delete-users"]',
    )
    expect(sourceDelete).not.toBeNull()
    const deleteInput = sourceDelete!.querySelector('input') as HTMLInputElement
    expect(deleteInput.disabled).toBe(true)
    expect(deleteInput.checked).toBe(false)

    expect(container.querySelectorAll('[data-iris-transfer-select-all]')).toHaveLength(2)
    expect(container.querySelector('[data-testid="assignment-summary"]')?.textContent).toContain(
      'Read articles',
    )
    expect(
      container.querySelector('[data-testid="assignment-summary"]')?.textContent,
    ).not.toContain('Delete users')
  })
})
