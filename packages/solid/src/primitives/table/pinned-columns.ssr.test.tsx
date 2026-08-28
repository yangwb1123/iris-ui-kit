// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

type Row = { id: number; name: string; total: number }

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', pinned: 'left', width: 100 },
  { key: 'total', title: 'Total', width: 80, summary: 'sum' },
]
const data: Row[] = [{ id: 1, name: 'Alice', total: 2 }]

describe('Solid IrisTable pinnedColumns SSR', () => {
  it('is deterministic, projects controlled pins, and emits no callbacks', () => {
    const updates: unknown[] = []
    const renderTable = (): string =>
      renderToString(() => (
        <IrisTable
          columns={columns}
          data={data}
          pinnedColumns={{ name: null, total: 'right' }}
          onColumnPinnedChange={(key, side) => updates.push([key, side])}
        />
      ))

    const first = renderTable()
    expect(first).toBe(renderTable())
    expect(first).toContain('data-iris-table-header="total"')
    expect(first).not.toContain('data-iris-table-pinned="left"')
    expect(first).toContain('data-iris-table-pinned="right"')
    expect(updates).toEqual([])
  })

  it('keeps the header pin menu absent and side-effect free during SSR', () => {
    const updates: unknown[] = []
    const html = renderToString(() => (
      <IrisTable
        columns={columns}
        data={data}
        columnPinMenu
        onColumnPinnedChange={(key, side) => updates.push([key, side])}
      />
    ))

    expect(html).not.toContain('data-iris-table-context-menu')
    expect(html).not.toContain('__iris-pin-left')
    expect(updates).toEqual([])
  })
})
