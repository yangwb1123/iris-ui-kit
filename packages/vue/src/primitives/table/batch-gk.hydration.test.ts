import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
]
const data: Row[] = [{ id: 1, name: 'Alice', age: 25 }]

function tableVNode(columnFade: boolean, columnVisibility: Record<string, boolean>) {
  return h(IrisTable, {
    columns,
    data,
    rowKey: 'id',
    columnVisibility,
    columnFade,
  })
}

function hydrateMarkup(html: string): HTMLElement {
  const container = document.createElement('div')
  const fragment = document.createRange().createContextualFragment(html)
  container.appendChild(fragment)
  container.setAttribute('data-server-rendered', '')
  document.body.appendChild(container)
  return container
}

function isHydrationMismatch(args: unknown[]): boolean {
  return args.some(
    (value) => typeof value === 'string' && /hydration/i.test(value) && /mismatch/i.test(value),
  )
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('IrisTable columnFade hydration (Vue)', () => {
  it('hydrates enabled settled markup without a mismatch or client-only overlay', async () => {
    const render = () => tableVNode(true, {})
    const html = await renderToString(createSSRApp({ render }))
    const container = hydrateMarkup(html)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = createSSRApp({ render })
    try {
      app.mount(container)
      expect([...warn.mock.calls, ...error.mock.calls].filter(isHydrationMismatch)).toEqual([])
      expect(container.querySelector('[data-iris-table]')).not.toBeNull()
      expect(container.querySelector('[data-iris-column-fade-active]')).toBeNull()
      expect(container.querySelector('[data-iris-column-fade]')).toBeNull()
      expect(container.querySelector('[data-iris-table-cell="age"]')).not.toBeNull()
    } finally {
      app.unmount()
      warn.mockRestore()
      error.mockRestore()
    }
  })

  it('hydrates the default-off initially hidden path without a fade surface', async () => {
    const render = () => tableVNode(false, { age: false })
    const html = await renderToString(createSSRApp({ render }))
    const container = hydrateMarkup(html)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = createSSRApp({ render })
    try {
      app.mount(container)
      expect(warn.mock.calls.filter(isHydrationMismatch)).toEqual([])
      expect(container.querySelector('[data-iris-table-cell="age"]')).toBeNull()
      expect(container.querySelector('[data-iris-column-fade]')).toBeNull()
    } finally {
      app.unmount()
      warn.mockRestore()
    }
  })
})
