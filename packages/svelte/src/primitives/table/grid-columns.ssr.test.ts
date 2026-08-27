// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import IrisTable from './IrisTable.svelte'

const columns = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'age', title: 'Age', width: 90 },
  { key: 'status', title: 'Status' },
]
const data = [{ id: 1, name: 'Alice', age: 32, status: 'active' }]

describe('Svelte IrisTable Grid Core columns SSR/hydration guard', () => {
  it('renders controlled columns deterministically without browser access or callbacks', () => {
    const updates: unknown[] = []
    const renderTable = (): string =>
      render(IrisTable, {
        props: {
          columns,
          data,
          rowKey: 'id',
          columnWidths: { name: 150, age: 80 },
          columnVisibility: { status: false },
          onColumnWidthsChange: (next) => updates.push(next),
        },
      }).body

    const first = renderTable()
    const second = renderTable()

    expect(first).toBe(second)
    expect(first).toContain('150px 80px')
    expect(first).not.toContain('data-iris-table-header="status"')
    expect(first).not.toContain('data-iris-table-cell="status"')
    expect(updates).toEqual([])
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })
})
