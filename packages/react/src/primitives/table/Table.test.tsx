import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import { exportCsv } from './exportCsv'
import { exportExcel } from './exportExcel'
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
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

function rowEls(): HTMLElement[] {
  // Exclude the header pseudo-row.
  return Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
}

function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
}

describe('@iris-ui/react exportCsv', () => {
  it('serializes header + rows with comma separator', () => {
    const csv = exportCsv(rows, baseColumns)
    expect(csv.split('\n')[0]).toBe('Name,Age')
    expect(csv.split('\n').length).toBe(4)
  })

  it('quotes values that contain commas or quotes', () => {
    const data = [{ id: 1, label: 'hello, world', q: 'a"b' }]
    const cols: IrisTableColumn<{ id: number; label: string; q: string }>[] = [
      { key: 'label', title: 'L' },
      { key: 'q', title: 'Q' },
    ]
    const csv = exportCsv(data, cols)
    expect(csv).toBe('L,Q\n"hello, world","a""b"')
  })
})

describe('@iris-ui/react IrisTable', () => {
  it('renders role="table" + header + row cells', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelector('[role=table]')).not.toBeNull()
    expect(headers().length).toBe(2)
    expect(rowEls().length).toBe(3)
  })

  it('header cells render column titles', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(headers().some((h) => h.textContent?.includes('Name'))).toBe(true)
    expect(headers().some((h) => h.textContent?.includes('Age'))).toBe(true)
  })

  it('clicking a sortable header cycles asc → desc → none', () => {
    const onSort = vi.fn()
    render(<IrisTable columns={baseColumns} data={rows} onSortChange={onSort} />)
    const nameHeader = headers().find((h) => h.textContent?.includes('Name'))!
    act(() => {
      fireEvent.click(nameHeader)
    })
    expect(onSort).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' })
    act(() => {
      fireEvent.click(nameHeader)
    })
    expect(onSort).toHaveBeenLastCalledWith({ key: 'name', direction: 'desc' })
    act(() => {
      fireEvent.click(nameHeader)
    })
    expect(onSort).toHaveBeenLastCalledWith(null)
  })

  it('sorted asc reorders rows alphabetically by sort key', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    )
    const cells = Array.from(document.querySelectorAll('[data-iris-table-cell=name]'))
    expect(cells.map((c) => c.textContent)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorted desc reverses', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        defaultSort={{ key: 'name', direction: 'desc' }}
      />,
    )
    const cells = Array.from(document.querySelectorAll('[data-iris-table-cell=name]'))
    expect(cells.map((c) => c.textContent)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('numeric sort uses subtraction (not localeCompare)', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        defaultSort={{ key: 'age', direction: 'asc' }}
      />,
    )
    const cells = Array.from(document.querySelectorAll('[data-iris-table-cell=age]'))
    expect(cells.map((c) => c.textContent)).toEqual(['25', '28', '32'])
  })

  it('aria-sort header attribute reflects current sort', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    )
    const nameHeader = headers().find((h) => h.textContent?.includes('Name'))!
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending')
  })

  it('non-sortable columns have no aria-sort', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
    render(<IrisTable columns={cols} data={rows} />)
    expect(headers()[0]?.getAttribute('aria-sort')).toBeNull()
  })

  it('selectable=single allows one row at a time', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        selectable="single"
        onSelectionChange={onChange}
      />,
    )
    const checkboxes = Array.from(document.querySelectorAll('input[type=checkbox]'))
    act(() => {
      fireEvent.click(checkboxes[0]!)
    })
    expect(onChange).toHaveBeenCalledWith([1])
    act(() => {
      fireEvent.click(checkboxes[1]!)
    })
    expect(onChange).toHaveBeenCalledWith([2])
  })

  it('selectable=multi tracks an array of selected keys', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        selectable="multi"
        onSelectionChange={onChange}
      />,
    )
    const checkboxes = Array.from(document.querySelectorAll('input[type=checkbox]'))
    // First is master, then 3 row checkboxes.
    act(() => {
      fireEvent.click(checkboxes[1]!)
    })
    expect(onChange).toHaveBeenLastCalledWith([1])
    act(() => {
      fireEvent.click(checkboxes[2]!)
    })
    expect(onChange).toHaveBeenLastCalledWith([1, 2])
  })

  it('master checkbox toggles all on then off', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        selectable="multi"
        onSelectionChange={onChange}
      />,
    )
    const master = document.querySelectorAll('input[type=checkbox]')[0]!
    act(() => {
      fireEvent.click(master)
    })
    expect(onChange).toHaveBeenLastCalledWith([1, 2, 3])
    act(() => {
      fireEvent.click(master)
    })
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('custom rowKey is honored', () => {
    const data = [
      { uuid: 'a', name: 'X' },
      { uuid: 'b', name: 'Y' },
    ]
    const cols: IrisTableColumn<{ uuid: string; name: string }>[] = [{ key: 'name', title: 'N' }]
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={data}
        rowKey="uuid"
        selectable="multi"
        onSelectionChange={onChange}
      />,
    )
    const cb = document.querySelectorAll('input[type=checkbox]')
    act(() => {
      fireEvent.click(cb[1]!)
    })
    expect(onChange).toHaveBeenLastCalledWith(['a'])
  })

  it('render callback customizes cell content', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        render: (v) => <strong data-testid="bolded">{v as string}</strong>,
      },
    ]
    render(<IrisTable columns={cols} data={rows} />)
    expect(document.querySelectorAll('[data-testid=bolded]').length).toBe(3)
  })

  it('emptyState renders when data is empty', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        emptyState={<div data-testid="empty">Nothing here</div>}
      />,
    )
    expect(document.querySelector('[data-testid=empty]')).not.toBeNull()
  })

  it('renders the localized loading state with aria-busy', () => {
    render(<IrisTable columns={baseColumns} data={[]} loading />)
    const row = document.querySelector('[data-iris-table-row="loading"]')
    expect(row).not.toBeNull()
    expect(row?.getAttribute('aria-busy')).toBe('true')
    expect(row?.textContent).toBe('Loading…')
  })

  it('renders the error state, taking precedence over loading and data', () => {
    render(<IrisTable columns={baseColumns} data={rows} loading error />)
    expect(document.querySelector('[data-iris-table-row="error"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-row="loading"]')).toBeNull()
    // No data rows render while in the error state.
    expect(document.querySelector('[data-iris-table-row="2"]')).toBeNull()
  })

  it('errorState/loadingState override the default copy', () => {
    const { rerender } = render(
      <IrisTable columns={baseColumns} data={[]} loading loadingState={<span>Fetching</span>} />,
    )
    expect(document.querySelector('[data-iris-table-row="loading"]')?.textContent).toBe('Fetching')
    rerender(<IrisTable columns={baseColumns} data={[]} error errorState={<span>Boom</span>} />)
    expect(document.querySelector('[data-iris-table-row="error"]')?.textContent).toBe('Boom')
  })

  it('aria-selected reflects selection state', () => {
    render(
      <IrisTable columns={baseColumns} data={rows} selectable="multi" defaultSelection={[2]} />,
    )
    const r = document.querySelector('[data-iris-table-row="2"]')!
    expect(r.getAttribute('aria-selected')).toBe('true')
  })

  it('striped reflects on data attr', () => {
    render(<IrisTable columns={baseColumns} data={rows} striped />)
    expect(document.querySelector('[data-iris-table]')?.getAttribute('data-striped')).toBe('true')
  })

  it('Enter on a sortable header cycles sort', () => {
    const onSort = vi.fn()
    render(<IrisTable columns={baseColumns} data={rows} onSortChange={onSort} />)
    const nameHeader = headers().find((h) => h.textContent?.includes('Name'))!
    act(() => {
      fireEvent.keyDown(nameHeader, { key: 'Enter' })
    })
    expect(onSort).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
  })
})

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

describe('@iris-ui/react IrisTable summary row', () => {
  const sumCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age', summary: 'sum' },
  ]
  function summaryCell(key: string): HTMLElement | null {
    return document.querySelector(`[data-iris-table-row="summary"] [data-iris-table-cell="${key}"]`)
  }

  it('renders a footer row aggregating the flagged column', () => {
    render(<IrisTable columns={sumCols} data={rows} />)
    expect(document.querySelector('[data-iris-table-row="summary"]')).not.toBeNull()
    // rows ages 25 + 32 + 28 = 85
    expect(summaryCell('age')!.textContent).toBe('85')
    expect(summaryCell('name')!.textContent).toBe('') // no summary op → blank
    expect(summaryCell('age')!.getAttribute('data-iris-table-summary-cell')).toBe('')
  })

  it('uses renderSummary to format the aggregated value', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'age',
        title: 'Age',
        summary: 'avg',
        renderSummary: (v) => `avg ${v.toFixed(1)}`,
      },
    ]
    render(<IrisTable columns={cols} data={rows} />)
    expect(summaryCell('age')!.textContent).toBe('avg 28.3') // (25+32+28)/3 = 28.33
  })

  it('shows no summary row when no column declares one', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })

  it('shows no summary row when there is no data', () => {
    render(<IrisTable columns={sumCols} data={[]} />)
    expect(document.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })
})

describe('@iris-ui/react IrisTable expandable detail rows', () => {
  function toggle(rowId: string | number): HTMLElement {
    return document.querySelector(
      `[data-iris-table-row="${rowId}"] [data-iris-table-expand-toggle]`,
    ) as HTMLElement
  }
  function detail(rowId: string | number): HTMLElement | null {
    return document.querySelector(`[data-iris-table-row-detail="${rowId}"]`)
  }

  it('renders an expand toggle per row and no detail panel by default', () => {
    render(<IrisTable columns={baseColumns} data={rows} renderDetail={(r) => <div>D{r.id}</div>} />)
    expect(document.querySelectorAll('[data-iris-table-expand-toggle]').length).toBe(3)
    expect(detail(1)).toBeNull()
    expect(toggle(1).getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the toggle reveals the detail panel, clicking again hides it', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>detail-{r.id}</div>}
      />,
    )
    act(() => fireEvent.click(toggle(1)))
    expect(detail(1)).not.toBeNull()
    expect(detail(1)!.textContent).toBe('detail-1')
    expect(toggle(1).getAttribute('aria-expanded')).toBe('true')
    act(() => fireEvent.click(toggle(1)))
    expect(detail(1)).toBeNull()
  })

  it('rowExpandable gates which rows get a toggle', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>{r.id}</div>}
        rowExpandable={(r) => r.id !== 2}
      />,
    )
    expect(toggle(1)).not.toBeNull()
    expect(toggle(2)).toBeNull() // row 2 not expandable
    expect(toggle(3)).not.toBeNull()
  })

  it('defaultExpandedRowKeys starts expanded and onExpandedRowsChange fires on toggle', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>{r.id}</div>}
        defaultExpandedRowKeys={[1]}
        onExpandedRowsChange={onChange}
      />,
    )
    expect(detail(1)).not.toBeNull()
    act(() => fireEvent.click(toggle(2)))
    expect(onChange).toHaveBeenLastCalledWith(['1', '2'])
    expect(detail(2)).not.toBeNull()
  })

  it('no expand column when renderDetail is absent', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelector('[data-iris-table-cell="__expand"]')).toBeNull()
    expect(document.querySelector('[data-iris-table-header="__expand"]')).toBeNull()
  })
})

describe('@iris-ui/react IrisTable virtual scroll', () => {
  const many: Row[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `N${i}`, age: i }))

  it('renders the body inside a virtual scroller', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={many}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
  })

  it('windows the rows (renders far fewer than the full dataset)', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={many}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    const count = rowEls().length
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(50)
  })

  it('still renders the header alongside the virtual body', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={many}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    expect(headers().length).toBe(2)
  })
})

describe('@iris-ui/react IrisTable pinned columns', () => {
  const cols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', width: 100, pinned: 'left' },
    { key: 'age', title: 'Age', width: 80 },
    { key: 'act', title: 'Act', width: 60, pinned: 'right' },
  ]

  it('makes pinned header + cells sticky with edge offsets', () => {
    render(<IrisTable columns={cols} data={rows} />)
    const nameHeader = document.querySelector('[data-iris-table-header="name"]') as HTMLElement
    expect(nameHeader.getAttribute('data-iris-table-pinned')).toBe('left')
    expect(nameHeader.style.position).toBe('sticky')
    expect(nameHeader.style.left).toBe('0px')
    const actHeader = document.querySelector('[data-iris-table-header="act"]') as HTMLElement
    expect(actHeader.style.position).toBe('sticky')
    expect(actHeader.style.right).toBe('0px')
    // Body cells are pinned too.
    const nameCell = document.querySelector('[data-iris-table-cell="name"]') as HTMLElement
    expect(nameCell.style.position).toBe('sticky')
    // Unpinned column has no sticky positioning.
    const ageHeader = document.querySelector('[data-iris-table-header="age"]') as HTMLElement
    expect(ageHeader.style.position).toBe('relative')
    expect(ageHeader.getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('offsets a left-pinned column by the selection column width', () => {
    render(<IrisTable columns={cols} data={rows} selectable="multi" />)
    const nameHeader = document.querySelector('[data-iris-table-header="name"]') as HTMLElement
    expect(nameHeader.style.left).toBe('40px')
  })
})

describe('@iris-ui/react exportExcel', () => {
  it('serializes rows to SpreadsheetML, typing numbers and ignoring render fns', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', render: (v) => `<<${v}>>` },
      { key: 'age', title: 'Age' },
    ]
    const xml = exportExcel(rows, cols)
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>')
    expect(xml).toContain('<Data ss:Type="String">Name</Data>')
    expect(xml).toContain('<Data ss:Type="String">Charlie</Data>')
    expect(xml).toContain('<Data ss:Type="Number">25</Data>')
  })
})

describe('@iris-ui/react IrisTable column virtualization', () => {
  const wideCols: IrisTableColumn<Record<string, unknown>>[] = Array.from(
    { length: 8 },
    (_, i) => ({
      key: `c${i}`,
      title: `C${i}`,
      width: 120,
    }),
  )
  const wideRows: Record<string, unknown>[] = [
    Object.fromEntries([['id', 1], ...wideCols.map((c) => [c.key, `${c.key}-v`])]),
  ]

  it('renders every column when disabled (default)', () => {
    render(<IrisTable columns={wideCols} data={wideRows} />)
    expect(document.querySelectorAll('[data-iris-table-header]').length).toBe(8)
  })

  it('renders only a window of columns when enabled', () => {
    render(<IrisTable columns={wideCols} data={wideRows} columnVirtualization />)
    const headerCount = document.querySelectorAll('[data-iris-table-header]').length
    expect(headerCount).toBeGreaterThan(0)
    expect(headerCount).toBeLessThan(8)
    expect(document.querySelector('[data-iris-table][data-column-virtualized=true]')).not.toBeNull()
    // Rendered header cells carry an explicit grid track.
    const first = document.querySelector('[data-iris-table-header]') as HTMLElement
    expect(first.style.gridColumnStart).toBeTruthy()
  })

  it('always renders pinned columns even when out of the window', () => {
    const cols = wideCols.map((c, i) => (i === 7 ? { ...c, pinned: 'right' as const } : c))
    render(<IrisTable columns={cols} data={wideRows} columnVirtualization />)
    // The far pinned column (index 7) renders despite being outside the window.
    expect(document.querySelector('[data-iris-table-header="c7"]')).not.toBeNull()
  })
})
