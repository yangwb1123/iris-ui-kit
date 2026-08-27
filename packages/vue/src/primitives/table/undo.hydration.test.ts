// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('IrisTable undo/redo hydration', () => {
  it('hydrates deterministic disabled controls and remains interactive', async () => {
    const factory = () =>
      h(IrisTable, {
        columns: [{ key: 'name', title: 'Name', editable: true }],
        data: [{ id: 1, name: 'Alice' }],
        rowKey: 'id',
        undo: true,
      })
    const html = await renderToString(createSSRApp({ render: factory }))
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const warnings: unknown[][] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => warnings.push(args)
    const app = createSSRApp({ render: factory })
    try {
      app.mount(container)
      expect(
        warnings.some((args) => args.some((v) => typeof v === 'string' && /hydration/i.test(v))),
      ).toBe(false)
      const table = container.querySelector('[data-iris-table]') as HTMLElement
      const undo = container.querySelector('[data-iris-table-undo]') as HTMLButtonElement
      expect(table).not.toBeNull()
      expect(undo.disabled).toBe(true)
      const cell = container.querySelector(
        '[data-iris-table-row-key="1"] [data-iris-table-cell="name"]',
      ) as HTMLElement
      cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await nextTick()
      const editor = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
      editor.value = 'Hydrated'
      editor.dispatchEvent(new Event('input', { bubbles: true }))
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await nextTick()
      table.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
      await nextTick()
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toContain(
        'Alice',
      )
    } finally {
      console.warn = originalWarn
      app.unmount()
    }
  })
})
