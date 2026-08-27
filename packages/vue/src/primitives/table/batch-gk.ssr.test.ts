// @vitest-environment node

import { describe, expect, it } from 'vitest'
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

async function renderTable(columnFade: boolean, columnVisibility: Record<string, boolean>) {
  return renderToString(
    createSSRApp({
      render: () =>
        h(IrisTable, {
          columns,
          data,
          rowKey: 'id',
          columnVisibility,
          columnFade,
        }),
    }),
  )
}

describe('IrisTable columnFade SSR (Vue)', () => {
  it('keeps the enabled path settled and browser-free during SSR', async () => {
    const html = await renderTable(true, {})
    expect(html).toContain('data-iris-table')
    expect(html).toContain('data-iris-table-cell="age"')
    expect(html).not.toContain('data-iris-column-fade-active')
    expect(html).not.toContain('data-iris-column-fade=')
    expect(html).not.toContain('opacity: 0')
    expect(typeof document).toBe('undefined')
  })

  it('keeps the default-off and initially hidden paths inert during SSR', async () => {
    const html = await renderTable(false, { age: false })
    expect(html).toContain('data-iris-table-cell="name"')
    expect(html).not.toContain('data-iris-table-cell="age"')
    expect(html).not.toContain('data-iris-column-fade-active')
    expect(html).not.toContain('data-iris-column-fade=')
  })
})
