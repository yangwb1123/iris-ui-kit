import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
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

describe('@iris-ui/react IrisTable column resize', () => {
  function handle(key: string): HTMLElement | null {
    return document.querySelector(`[data-iris-table-resize-handle][data-column-key="${key}"]`)
  }
  function gridCols(): string {
    // The column template lives on each row's grid (header row here), not the root.
    return (document.querySelector('[data-iris-table-row="header"]') as HTMLElement).style
      .gridTemplateColumns
  }

  it('renders no resize handles unless resizableColumns', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(0)
  })

  it('renders a separator handle per column when resizableColumns', () => {
    render(<IrisTable columns={baseColumns} data={rows} resizableColumns />)
    expect(document.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(2)
    expect(handle('name')!.getAttribute('role')).toBe('separator')
    expect(handle('name')!.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('ArrowRight grows the column width (uncontrolled)', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        defaultColumnWidths={{ name: 100 }}
      />,
    )
    expect(gridCols()).toContain('100px')
    act(() => {
      fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' })
    })
    expect(gridCols()).toContain('116px')
  })

  it('ArrowLeft shrinks but clamps to the column minWidth', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', minWidth: 90 },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable columns={cols} data={rows} resizableColumns defaultColumnWidths={{ name: 100 }} />,
    )
    act(() => {
      fireEvent.keyDown(handle('name')!, { key: 'ArrowLeft' }) // 100-16=84 → clamp to 90
    })
    expect(gridCols()).toContain('90px')
  })

  it('ArrowRight clamps to the column maxWidth', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', maxWidth: 110 },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable columns={cols} data={rows} resizableColumns defaultColumnWidths={{ name: 100 }} />,
    )
    act(() => {
      fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' }) // 100+16=116 → clamp to 110
    })
    expect(gridCols()).toContain('110px')
  })

  it('onColumnWidthsChange fires with the new widths', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        defaultColumnWidths={{ name: 100 }}
        onColumnWidthsChange={onChange}
      />,
    )
    act(() => {
      fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' })
    })
    expect(onChange).toHaveBeenCalledWith({ name: 116 })
  })

  it('controlled columnWidths render the given widths', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        resizableColumns
        columnWidths={{ name: 150, age: 80 }}
      />,
    )
    expect(gridCols()).toContain('150px')
    expect(gridCols()).toContain('80px')
  })

  it('clicking the resize handle does not trigger sort', () => {
    const onSort = vi.fn()
    render(<IrisTable columns={baseColumns} data={rows} resizableColumns onSortChange={onSort} />)
    act(() => {
      fireEvent.click(handle('name')!)
    })
    expect(onSort).not.toHaveBeenCalled()
  })
})

describe('@iris-ui/react IrisTable inline editing', () => {
  const editableCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', editable: true },
    { key: 'age', title: 'Age', editable: true, editor: 'number' },
  ]
  function cell(rowId: string | number, key: string): HTMLElement {
    return document.querySelector(
      `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
    ) as HTMLElement
  }
  function editor(): HTMLInputElement | null {
    return document.querySelector('[data-iris-table-editor]')
  }

  it('non-editable cell does not open an editor on double-click', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    expect(editor()).toBeNull()
  })

  it('double-click opens an editor seeded with the cell value', () => {
    render(<IrisTable columns={editableCols} data={rows} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    expect(editor()).not.toBeNull()
    expect(editor()!.value).toBe('Charlie')
  })

  it('Enter commits + calls onCellEdit with the new value, then closes', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={editableCols} data={rows} onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Charlie Edited' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: 'Charlie', newValue: 'Charlie Edited', rowIndex: 0 }),
    )
    expect(editor()).toBeNull()
  })

  it('Escape cancels without emitting', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={editableCols} data={rows} onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'changed' } })
      fireEvent.keyDown(editor()!, { key: 'Escape' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editor()).toBeNull()
  })

  it('number editor coerces the committed value', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={editableCols} data={rows} onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'age'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: '99' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 99 }))
  })

  it('Enter with an unchanged value does not emit', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={editableCols} data={rows} onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  const validatedCols: IrisTableColumn<Row>[] = [
    {
      key: 'name',
      title: 'Name',
      editable: true,
      validate: (v) => (String(v).trim() === '' ? 'Name is required' : null),
    },
  ]

  it('a failing validator blocks the commit, keeps the editor open, and shows the error', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={validatedCols} data={rows} onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: '   ' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editor()).not.toBeNull() // stays open
    expect(editor()!.getAttribute('aria-invalid')).toBe('true')
    const err = document.querySelector('[data-iris-table-editor-error]')
    expect(err?.textContent).toBe('Name is required')
    expect(err?.getAttribute('role')).toBe('alert')
    expect(editor()!.getAttribute('aria-describedby')).toBe(err?.id)
  })

  it('correcting the value clears the error and commits', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={validatedCols} data={rows} onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: '' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    act(() => {
      fireEvent.change(editor()!, { target: { value: 'Valid Name' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Valid Name' }))
    expect(editor()).toBeNull()
  })

  it('Escape cancels even while an error is showing', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={validatedCols} data={rows} onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(editor()!, { target: { value: '' } })
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(editor()).not.toBeNull()
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Escape' })
    })
    expect(editor()).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
  })
})
