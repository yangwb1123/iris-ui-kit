import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

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
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function handle(key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-table-resize-handle][data-column-key="${key}"]`)
}
function gridCols(): string {
  return (document.querySelector('[data-iris-table-row="header"]') as HTMLElement).style
    .gridTemplateColumns
}
function cells(key: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll(`[data-iris-table-cell="${key}"],[data-iris-table-header="${key}"]`),
  ) as HTMLElement[]
}
function stubScroll(el: HTMLElement, width: number): void {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: width })
}

describe('@iris-ui-kit/react IrisTable autoResizeColumns (batch DG)', () => {
  it('gating: no handles without resizableColumns, even with autoResizeColumns', () => {
    render(<IrisTable columns={baseColumns} data={rows} autoResizeColumns />)
    expect(document.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(0)
  })

  it('gating: autoResizeColumns does not add handles on its own', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(0)
  })

  it('renders one handle per column when both flags on', () => {
    render(<IrisTable columns={baseColumns} data={rows} resizableColumns autoResizeColumns />)
    expect(document.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(2)
  })

  it('happy path: double-click writes the measured width and updates the grid', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        onColumnWidthsChange={onChange}
      />,
    )
    // Wide content only in the name cells (scrollWidth includes 12px×2 padding).
    cells('name').forEach((el) => stubScroll(el, 132))
    cells('age').forEach((el) => stubScroll(el, 64))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).toHaveBeenCalledWith({ name: 132 })
    expect(gridCols()).toContain('132px')
    // Other columns untouched.
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('takes the max across header + body cells for a column', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        onColumnWidthsChange={onChange}
      />,
    )
    const cs = cells('name')
    stubScroll(cs[0]!, 100)
    stubScroll(cs[1]!, 250)
    stubScroll(cs[2]!, 140)
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).toHaveBeenCalledWith({ name: 250 })
  })

  it('scrollWidth already includes both-side padding (no extra term)', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        onColumnWidthsChange={onChange}
      />,
    )
    cells('name').forEach((el) => stubScroll(el, 90))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).toHaveBeenCalledWith({ name: 90 })
  })

  it('clamps to the column minWidth', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', minWidth: 120 },
      { key: 'age', title: 'Age' },
    ]
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        resizableColumns
        autoResizeColumns
        onColumnWidthsChange={onChange}
      />,
    )
    cells('name').forEach((el) => stubScroll(el, 50))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).toHaveBeenCalledWith({ name: 120 })
    expect(gridCols()).toContain('120px')
  })

  it('clamps to the column maxWidth', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', maxWidth: 90 },
      { key: 'age', title: 'Age' },
    ]
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        resizableColumns
        autoResizeColumns
        onColumnWidthsChange={onChange}
      />,
    )
    cells('name').forEach((el) => stubScroll(el, 300))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).toHaveBeenCalledWith({ name: 90 })
    expect(gridCols()).toContain('90px')
  })

  it('rounds fractional measured widths', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        onColumnWidthsChange={onChange}
      />,
    )
    cells('name').forEach((el) => stubScroll(el, 137.6))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).toHaveBeenCalledWith({ name: 138 })
  })

  it('conditional: no-op when no rendered cells measure > 0', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        onColumnWidthsChange={onChange}
      />,
    )
    // jsdom default scrollWidth is 0 on every cell.
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('controlled mode fires onColumnWidthsChange (no optimistic flip of the map)', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        columnWidths={{ name: 80, age: 70 }}
        onColumnWidthsChange={onChange}
      />,
    )
    cells('name').forEach((el) => stubScroll(el, 200))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onChange).toHaveBeenCalledWith({ name: 200, age: 70 })
    // Controlled map unchanged until parent re-renders with the new value.
    expect(gridCols()).toContain('80px')
    rerender(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        columnWidths={{ name: 200, age: 70 }}
        onColumnWidthsChange={onChange}
      />,
    )
    expect(gridCols()).toContain('200px')
  })

  it('drag (keyboard) and double-click do not interfere', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        autoResizeColumns
        defaultColumnWidths={{ name: 100 }}
        onColumnWidthsChange={onChange}
      />,
    )
    // Keyboard nudge still works.
    act(() => {
      fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' })
    })
    expect(gridCols()).toContain('116px')
    // Double-click after still auto-fits.
    cells('name').forEach((el) => stubScroll(el, 180))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(gridCols()).toContain('180px')
  })

  it('double-click on handle does not trigger header sort', () => {
    const onSort = vi.fn()
    const onWidths = vi.fn()
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable
        columns={cols}
        data={rows}
        resizableColumns
        autoResizeColumns
        onSortChange={onSort}
        onColumnWidthsChange={onWidths}
      />,
    )
    cells('name').forEach((el) => stubScroll(el, 150))
    act(() => {
      fireEvent.doubleClick(handle('name')!)
    })
    expect(onWidths).toHaveBeenCalledWith({ name: 150 })
    expect(onSort).not.toHaveBeenCalled()
  })
})
