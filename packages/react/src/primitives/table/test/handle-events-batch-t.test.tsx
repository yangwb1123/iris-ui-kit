import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
}

describe('IrisTable batch T events', () => {
  it('onCellDblClick fires with coordinates after the edit begins (editable column)', () => {
    const onCellDblClick = vi.fn()
    const columns = [{ ...baseColumns[0]!, editable: true }, baseColumns[1]!]
    render(<IrisTable columns={columns} data={rows} rowKey="id" onCellDblClick={onCellDblClick} />)
    const cell = document.querySelector('[data-iris-table-cell="name"]')!
    act(() => fireEvent.doubleClick(cell))
    // The inline editor opened first (vxe parity), then the event fired.
    expect(document.querySelector('[data-iris-table-editor]')).not.toBeNull()
    expect(onCellDblClick).toHaveBeenCalledWith({
      row: rows[0],
      column: columns[0],
      rowIndex: 0,
      columnIndex: 0,
    })
  })

  it('onCellDblClick fires on non-editable columns too', () => {
    const onCellDblClick = vi.fn()
    render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" onCellDblClick={onCellDblClick} />,
    )
    const cell = document.querySelector('[data-iris-table-cell="age"]')!
    act(() => fireEvent.doubleClick(cell))
    expect(onCellDblClick).toHaveBeenCalledWith({
      row: rows[0],
      column: baseColumns[1],
      rowIndex: 0,
      columnIndex: 1,
    })
  })

  it('onRowDblClick fires with the row and index', () => {
    const onRowDblClick = vi.fn()
    render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" onRowDblClick={onRowDblClick} />,
    )
    act(() => fireEvent.doubleClick(document.querySelector('[data-iris-table-row="2"]')!))
    expect(onRowDblClick).toHaveBeenCalledWith(rows[1], 1)
  })

  it('onHeaderClick fires after the sort toggle (flat header)', () => {
    const order: string[] = []
    const onHeaderClick = vi.fn(() => order.push('header'))
    const onSortChange = vi.fn(() => order.push('sort'))
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        onHeaderClick={onHeaderClick}
        onSortChange={onSortChange}
      />,
    )
    const nameHeader = headers().find((h) => h.textContent?.includes('Name'))!
    act(() => fireEvent.click(nameHeader))
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    expect(onHeaderClick).toHaveBeenCalledWith(baseColumns[0])
    // Informational event: the sort toggle runs first.
    expect(order).toEqual(['sort', 'header'])
  })

  it('onHeaderClick fires on grouped headers too', () => {
    const onHeaderClick = vi.fn()
    const columns: IrisTableColumn<Row>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [
          { key: 'name', title: 'Name', sortable: true },
          { key: 'age', title: 'Age', sortable: true },
        ],
      },
    ]
    render(<IrisTable columns={columns} data={rows} rowKey="id" onHeaderClick={onHeaderClick} />)
    const nameHeader = document.querySelector('[data-iris-table-header="name"]')!
    act(() => fireEvent.click(nameHeader))
    expect(onHeaderClick).toHaveBeenCalledWith(columns[0]!.children![0])
  })

  it('onExpandChange fires with the new state from the detail toggle', () => {
    const onExpandChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        renderDetail={(r) => <div>detail-{r.id}</div>}
        onExpandChange={onExpandChange}
      />,
    )
    // Re-query each time: the detail wrap changes the tree structure, so the
    // toggle button node is replaced after the first expand.
    const toggle = () =>
      document.querySelector('[data-iris-table-row="1"] [data-iris-table-expand-toggle]')!
    act(() => fireEvent.click(toggle()))
    expect(onExpandChange).toHaveBeenCalledWith(rows[0], true)
    act(() => fireEvent.click(toggle()))
    expect(onExpandChange).toHaveBeenLastCalledWith(rows[0], false)
  })

  it('onTreeExpandChange fires with the new state from the tree caret', () => {
    const onTreeExpandChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        getSubRows={(r) => (r.id === 1 ? [{ id: 11, name: 'child', age: 1 }] : undefined)}
        onTreeExpandChange={onTreeExpandChange}
      />,
    )
    const caret = document.querySelector('[data-iris-table-row="1"] [data-iris-table-tree-toggle]')!
    act(() => fireEvent.click(caret))
    expect(onTreeExpandChange).toHaveBeenCalledWith(rows[0], true)
    act(() => fireEvent.click(caret))
    expect(onTreeExpandChange).toHaveBeenLastCalledWith(rows[0], false)
  })
})
