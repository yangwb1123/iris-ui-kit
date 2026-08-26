/* eslint-disable @typescript-eslint/no-unused-vars -- 拆分移入的共享测试数据 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

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

describe('IrisTable editRules (vxe editRules parity)', () => {
  it('required rule blocks empty commit with the rule message', async () => {
    const onCellEdit = vi.fn()
    const columns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ required: true, message: '必填' }],
      },
      { key: 'role', title: 'Role' },
    ]
    const rows = [{ id: 1, name: 'Alice', role: 'admin' }]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" onCellEdit={onCellEdit} />,
    )
    const cell = container.querySelector('[data-iris-table-cell="name"]')!
    fireEvent.doubleClick(cell)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(onCellEdit).not.toHaveBeenCalled()
      expect(container.querySelector('[data-iris-table-editor-error]')?.textContent).toContain(
        '必填',
      )
    })
  })

  it('pattern rule rejects invalid format, valid value commits', async () => {
    const onCellEdit = vi.fn()
    const columns = [
      {
        key: 'code',
        title: 'Code',
        editable: true,
        editRules: [{ pattern: /^\d+$/, message: '必须是数字' }],
      },
    ]
    const rows = [{ id: 1, code: '123' }]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" onCellEdit={onCellEdit} />,
    )
    const cell = container.querySelector('[data-iris-table-cell="code"]')!
    fireEvent.doubleClick(cell)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCellEdit).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '456' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onCellEdit).toHaveBeenCalled())
  })

  it('editConfig trigger click opens the editor on a single click', () => {
    const columns = [{ key: 'name', title: 'Name', editable: true }]
    const rows = [{ id: 1, name: 'Alice' }]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" editConfig={{ trigger: 'click' }} />,
    )
    const cell = container.querySelector('[data-iris-table-cell="name"]')!
    fireEvent.click(cell)
    expect(container.querySelector('[data-iris-table-editor]')).not.toBeNull()
  })
})

describe('IrisTable rowDrag (core createSortable composition)', () => {
  it('renders drag handles per row when rowDrag is configured', () => {
    const columns = [{ key: 'name', title: 'Name' }]
    const rows = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" rowDrag={{ onReorder: vi.fn() }} />,
    )
    expect(container.querySelectorAll('[data-iris-table-cell="__drag"]').length).toBe(2)
  })

  it('does not render drag handles when rowDrag is absent', () => {
    const columns = [{ key: 'name', title: 'Name' }]
    const rows = [{ id: 1, name: 'A' }]
    const { container } = render(<IrisTable columns={columns} data={rows} rowKey="id" />)
    expect(container.querySelectorAll('[data-iris-table-cell="__drag"]').length).toBe(0)
  })

  it('reorders rows through the core sortable flow (press → move → drop)', () => {
    const onReorder = vi.fn()
    const columns = [{ key: 'name', title: 'Name' }]
    const rows = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" rowDrag={{ onReorder }} />,
    )
    const handles = [...container.querySelectorAll('[data-iris-table-cell="__drag"]')]
    const table = container.querySelector('[data-iris-table]')!
    // jsdom returns 0 for getBoundingClientRect — stub per-row positions so
    // closestCenter resolves a real drop target.
    const rowsEl = [...container.querySelectorAll('[data-iris-table-row]')]
    rowsEl.forEach((el, i) => {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: i * 40,
        width: 200,
        height: 40,
        right: 200,
        bottom: (i + 1) * 40,
        x: 0,
        y: i * 40,
        toJSON: () => ({}),
      })
    })
    const makePointer = (type: string, init: Record<string, unknown>) => {
      const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
      if (typeof PointerCtor === 'function') {
        return new (PointerCtor as new (t: string, i?: EventInit) => Event)(type, {
          bubbles: true,
          ...(init as EventInit),
        })
      }
      const event = new Event(type, { bubbles: true })
      Object.assign(event, init)
      return event
    }
    // Press row 0, move past threshold, drop over row 1 (native events like
    // the useDrag tests — jsdom needs real PointerEvent construction).
    handles[0].dispatchEvent(makePointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }))
    table.dispatchEvent(makePointer('pointermove', { clientX: 12, clientY: 14 }))
    // Move to row 2's center (y = 40*2 + 20 = 100) so closestCenter resolves
    // row 2 as the drop target.
    table.dispatchEvent(makePointer('pointermove', { clientX: 12, clientY: 100 }))
    table.dispatchEvent(makePointer('pointerup', { clientX: 12, clientY: 100 }))
    expect(onReorder).toHaveBeenCalled()
    const next = onReorder.mock.calls[0][0] as { id: number }[]
    expect(next.map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('reorders static-tree siblings in the canonical root tree', () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const childA: TreeRow = { id: 11, name: 'A', age: 11 }
    const childB: TreeRow = { id: 12, name: 'B', age: 12 }
    const root: TreeRow = { id: 1, name: 'Root', age: 1, children: [childA, childB] }
    const sibling: TreeRow = { id: 2, name: 'Sibling', age: 2 }
    const source = [root, sibling]
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={source}
        rowKey="id"
        getSubRows={(row) => row.children}
        defaultExpandedRowKeys={[1]}
        rowDrag={{ onReorder }}
      />,
    )
    const handles = [...container.querySelectorAll('[data-iris-table-cell="__drag"]')]
    const table = container.querySelector('[data-iris-table]')!
    const rowsEl = [...container.querySelectorAll('[data-iris-table-row]')]
    rowsEl.forEach((el, i) => {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: i * 40,
        width: 200,
        height: 40,
        right: 200,
        bottom: (i + 1) * 40,
        x: 0,
        y: i * 40,
        toJSON: () => ({}),
      })
    })
    const pointer = (type: string, init: Record<string, unknown>): Event => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.assign(event, init)
      return event
    }

    // Child A is the second body row; drop below child B. The
    // callback must receive the two roots with only their child sibling order
    // changed — never the flattened [root, child, child, sibling] projection.
    act(() => {
      handles[1]!.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }))
      table.dispatchEvent(pointer('pointermove', { clientX: 12, clientY: 14 }))
      table.dispatchEvent(pointer('pointermove', { clientX: 12, clientY: 150 }))
      table.dispatchEvent(pointer('pointerup', { clientX: 12, clientY: 150 }))
    })

    expect(onReorder).toHaveBeenCalledTimes(1)
    const next = onReorder.mock.calls[0]![0] as TreeRow[]
    expect(next.map((row) => row.id)).toEqual([1, 2])
    expect(next[0]?.children?.map((row) => row.id)).toEqual([12, 11])
    expect(next[0]).not.toBe(root)
    expect(source).toEqual([root, sibling])
    expect(root.children).toEqual([childA, childB])
  })
})

describe('IrisTable seq + spanMethod (vxe-grid parity)', () => {
  it('seq renders a leading sequence column', () => {
    const columns = [{ key: 'name', title: 'Name' }]
    const rows = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]
    const { container } = render(<IrisTable columns={columns} data={rows} rowKey="id" seq />)
    const seqCells = [...container.querySelectorAll('[data-iris-table-cell="__seq"]')]
    expect(seqCells.length).toBe(2)
    expect(seqCells[0]?.textContent).toBe('1')
    expect(seqCells[1]?.textContent).toBe('2')
  })

  it('spanMethod colspan merges cells in a row', () => {
    const columns = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
    ]
    const rows = [{ id: 1, a: 'x', b: 'y' }]
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        spanMethod={({ columnIndex }) => (columnIndex === 0 ? { colspan: 2 } : null)}
      />,
    )
    const cells = [...container.querySelectorAll('[role="cell"]')]
    // first cell spans 2 columns; second cell is skipped
    expect(cells.length).toBe(1)
  })

  it('spanMethod rowspan skips the covered cell in the next row', () => {
    const columns = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
    ]
    const rows = [
      { id: 1, a: 'x', b: 'y' },
      { id: 2, a: 'p', b: 'q' },
    ]
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        spanMethod={({ rowIndex, columnIndex }) =>
          rowIndex === 0 && columnIndex === 0 ? { rowspan: 2 } : null
        }
      />,
    )
    // row 0 col 0 spans 2 rows; row 1 col 0 is skipped → row 1 has 1 cell
    const row1 = container.querySelector('[data-iris-table-row="2"]')!
    expect(row1.querySelectorAll('[role="cell"]').length).toBe(1)
  })
})

describe('IrisTable columnDrag (vxe columnDragConfig parity)', () => {
  it('reorders leaf columns through the sortable flow', () => {
    const onReorder = vi.fn()
    const columns = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    const rows = [{ id: 1, a: 'x', b: 'y', c: 'z' }]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    const headers = [...container.querySelectorAll('[data-iris-table-header]')]
    const makePointer = (type: string, init: Record<string, unknown>) => {
      const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
      if (typeof PointerCtor === 'function') {
        return new (PointerCtor as new (t: string, i?: EventInit) => Event)(type, {
          bubbles: true,
          ...(init as EventInit),
        })
      }
      const event = new Event(type, { bubbles: true })
      Object.assign(event, init)
      return event
    }
    headers.forEach((el, i) => {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: i * 100,
        top: 0,
        width: 100,
        height: 30,
        right: (i + 1) * 100,
        bottom: 30,
        x: i * 100,
        y: 0,
        toJSON: () => ({}),
      })
    })
    const table = container.querySelector('[data-iris-table]')!
    // drag column A onto column C
    headers[0].dispatchEvent(makePointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }))
    table.dispatchEvent(makePointer('pointermove', { clientX: 12, clientY: 14 }))
    table.dispatchEvent(makePointer('pointermove', { clientX: 250, clientY: 14 }))
    table.dispatchEvent(makePointer('pointerup', { clientX: 250, clientY: 14 }))
    expect(onReorder).toHaveBeenCalled()
    const next = onReorder.mock.calls[0][0] as { key: string }[]
    expect(next.map((c) => c.key)).toEqual(['b', 'c', 'a'])
  })
})

describe('IrisTable columnVisibility / filters / toolbar (批 4)', () => {
  it('columnVisibility hides columns', () => {
    const columns = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
    ]
    const rows = [{ id: 1, a: 'x', b: 'y' }]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" columnVisibility={{ b: false }} />,
    )
    expect(container.querySelectorAll('[data-iris-table-cell="a"]').length).toBe(1)
    expect(container.querySelectorAll('[data-iris-table-cell="b"]').length).toBe(0)
  })

  it('filters rows with the core filterSort material', () => {
    const columns = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const rows = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" filters={{ name: 'ali' }} />,
    )
    const rowsEl = [...container.querySelectorAll('[data-iris-table-row]')]
    // header + 1 matching row
    expect(rowsEl.length).toBe(2)
    expect(rowsEl[1]?.textContent).toContain('Alice')
  })

  it('toolbar renders title + refresh + column settings menu', () => {
    const onRefresh = vi.fn()
    const columns = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
    ]
    const rows = [{ id: 1, a: 'x', b: 'y' }]
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{ title: 'Users', onRefresh, columnSettings: true }}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />,
    )
    const toolbar = container.querySelector('[data-iris-table-toolbar]')!
    expect(toolbar?.textContent).toContain('Users')
    fireEvent.click(toolbar.querySelector('[data-iris-table-toolbar-refresh]')!)
    expect(onRefresh).toHaveBeenCalled()
    fireEvent.click(toolbar.querySelector('[data-iris-table-toolbar-columns]')!)
    expect(container.querySelector('[data-iris-table-column-settings]')).not.toBeNull()
  })
})

describe('IrisTable import button + printable (批 5)', () => {
  it('printable marks the root for print styling', () => {
    const columns = [{ key: 'a', title: 'A' }]
    const rows = [{ id: 1, a: 'x' }]
    const { container } = render(<IrisTable columns={columns} data={rows} rowKey="id" printable />)
    expect(container.querySelector('[data-iris-table]')?.getAttribute('data-printable')).toBe(
      'true',
    )
  })

  it('toolbar onImport renders the CSV import button', () => {
    const onImport = vi.fn()
    const columns = [{ key: 'a', title: 'A' }]
    const rows = [{ id: 1, a: 'x' }]
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" toolbar={{ onImport }} />,
    )
    expect(container.querySelector('[data-iris-table-toolbar-import]')).not.toBeNull()
  })
})
