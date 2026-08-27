// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

type Row = { id: number; name: string; age: number; status: string }

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'age', title: 'Age', width: 90 },
  { key: 'status', title: 'Status' },
]
const data: Row[] = [{ id: 1, name: 'Alice', age: 32, status: 'active' }]

describe('Solid IrisTable Grid Core columns SSR bridge', () => {
  it('renders controlled state deterministically without browser access or emits', () => {
    const updates: unknown[] = []
    const renderTable = (): string =>
      renderToString(() => (
        <IrisTable
          columns={columns}
          data={data}
          rowKey="id"
          columnWidths={{ name: 150, age: 80 }}
          columnVisibility={{ status: false }}
          onColumnWidthsChange={(next) => updates.push(next)}
          onColumnVisibilityChange={(next) => updates.push(next)}
        />
      ))

    const first = renderTable()
    const second = renderTable()

    expect(first).toBe(second)
    expect(first).toContain('150px 80px')
    expect(first).not.toContain('data-iris-table-header="status"')
    expect(first).not.toContain('data-iris-table-cell="status"')
    expect(updates).toEqual([])
    expect(typeof document).toBe('undefined')
  })
})
