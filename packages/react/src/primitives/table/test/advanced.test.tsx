import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import { exportExcel } from '../exportExcel'
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

function rowEls(): HTMLElement[] {
  // Exclude the header pseudo-row.
  return Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
}

function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-header]'))
}

describe('@iris-ui-kit/react IrisTable grid keyboard navigation', () => {
  function cellAt(r: number, c: number): HTMLElement | null {
    return document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`)
  }

  it('is off by default: role=table, no grid coords', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelector('[role=grid]')).toBeNull()
    expect(document.querySelector('[role=table]')).not.toBeNull()
    expect(cellAt(0, 0)).toBeNull()
  })

  it('opt-in makes the table a grid with roving cell tabindex', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    expect(document.querySelector('[role=grid]')).not.toBeNull()
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('0') // first cell focusable
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowRight / ArrowDown move the focused cell and roving tabindex', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    act(() => cellAt(0, 0)!.focus())
    act(() => fireEvent.keyDown(cellAt(0, 0)!, { key: 'ArrowRight' }))
    expect(document.activeElement).toBe(cellAt(0, 1))
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('0')
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('-1')
    act(() => fireEvent.keyDown(cellAt(0, 1)!, { key: 'ArrowDown' }))
    expect(document.activeElement).toBe(cellAt(1, 1))
  })

  it('does not move past an edge (no wrap)', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    act(() => cellAt(0, 0)!.focus())
    act(() => fireEvent.keyDown(cellAt(0, 0)!, { key: 'ArrowLeft' }))
    expect(document.activeElement).toBe(cellAt(0, 0)) // stayed
  })

  it('End jumps to the last column of the row', () => {
    render(<IrisTable columns={baseColumns} data={rows} keyboardNavigation />)
    act(() => cellAt(0, 0)!.focus())
    act(() => fireEvent.keyDown(cellAt(0, 0)!, { key: 'End' }))
    expect(document.activeElement).toBe(cellAt(0, 1)) // 2 columns → last is col 1
  })
})

describe('@iris-ui-kit/react IrisTable multi-level headers', () => {
  const groupedCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    {
      key: 'info',
      title: 'Info',
      children: [
        { key: 'age', title: 'Age', sortable: true },
        { key: 'id', title: 'ID' },
      ],
    },
  ]
  function header(key: string): HTMLElement | null {
    return document.querySelector(`[data-iris-table-header="${key}"]`)
  }

  it('flat columns render a non-grouped header (unchanged)', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelector('[data-iris-table-header-grouped]')).toBeNull()
  })

  it('a column with children renders a grouped header with span attrs', () => {
    render(<IrisTable columns={groupedCols} data={rows} />)
    expect(document.querySelector('[data-iris-table-header-grouped]')).not.toBeNull()
    // The group cell spans its 2 leaves and is marked as a group.
    const group = header('info')!
    expect(group.getAttribute('aria-colspan')).toBe('2')
    expect(group.getAttribute('data-iris-table-header-group')).toBe('')
    // Leaf header cells exist and the group's leaves are NOT marked as a group.
    expect(header('age')!.getAttribute('data-iris-table-header-group')).toBeNull()
    expect(header('id')).not.toBeNull()
  })

  it('the body renders the LEAF columns (group is header-only)', () => {
    render(<IrisTable columns={groupedCols} data={rows} />)
    // 3 leaf columns × 3 rows of body cells (name, age, id); no "info" data cell.
    expect(document.querySelectorAll('[data-iris-table-cell="age"]').length).toBe(3)
    expect(document.querySelectorAll('[data-iris-table-cell="id"]').length).toBe(3)
    expect(document.querySelector('[data-iris-table-cell="info"]')).toBeNull()
  })

  it('a sortable leaf inside a group still sorts', () => {
    const onSort = vi.fn()
    render(<IrisTable columns={groupedCols} data={rows} onSortChange={onSort} />)
    act(() => fireEvent.click(header('age')!))
    expect(onSort).toHaveBeenLastCalledWith({ key: 'age', direction: 'asc' })
  })
})

describe('@iris-ui-kit/react IrisTable virtual scroll', () => {
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

  it('virtualizes tree mode (uniform-height rows) with tree decoration intact', () => {
    const tree: Row[] = [
      {
        id: 1,
        name: 'Root',
        age: 0,
        children: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `C${i}`, age: i })),
      },
    ]
    render(
      <IrisTable
        columns={baseColumns}
        data={tree}
        getSubRows={(r) => r.children as Row[] | undefined}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    // Tree mode now uses the virtual scroller (was previously excluded).
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    // Tree meta still flows into the virtualized rows (the parent toggle renders).
    expect(document.querySelector('[data-iris-table-tree-toggle]')).not.toBeNull()
    // Windowed: far fewer than the 41 total rows are in the DOM.
    expect(rowEls().length).toBeLessThan(41)
  })

  it('does NOT virtualize tree mode when renderDetail is set (variable-height rows)', () => {
    const tree: Row[] = [{ id: 1, name: 'Root', age: 0, children: [{ id: 2, name: 'C', age: 1 }] }]
    render(
      <IrisTable
        columns={baseColumns}
        data={tree}
        getSubRows={(r) => r.children as Row[] | undefined}
        renderDetail={(r) => <div>d{r.id}</div>}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />,
    )
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable pinned columns', () => {
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

describe('@iris-ui-kit/react exportExcel', () => {
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

describe('@iris-ui-kit/react IrisTable column virtualization', () => {
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

describe('@iris-ui-kit/react IrisTable cellRange', () => {
  function cell(rowIdx: number, colIdx: number): HTMLElement {
    return document.querySelector(
      `[data-iris-cell-row="${rowIdx}"][data-iris-cell-col="${colIdx}"]`,
    ) as HTMLElement
  }
  function selectedCells(): HTMLElement[] {
    return Array.from(document.querySelectorAll('[data-iris-cell-selected="true"]'))
  }

  it('renders data-iris-cell-row/col attributes on all data cells when cellRange=true', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    // 3 rows × 2 columns = 6 cells with cell-range attributes
    expect(document.querySelectorAll('[data-iris-cell-row]').length).toBe(6)
    expect(cell(0, 0)).not.toBeNull()
    expect(cell(2, 1)).not.toBeNull()
  })

  it('click on a cell starts a 1×1 range and marks it selected', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    act(() => {
      fireEvent.click(cell(1, 0))
    })
    expect(selectedCells().length).toBe(1)
    expect(cell(1, 0).getAttribute('data-iris-cell-selected')).toBe('true')
  })

  it('Shift+Click extends the range and selects all cells within the rectangle', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    act(() => {
      fireEvent.click(cell(0, 0))
    })
    act(() => {
      fireEvent.click(cell(2, 1), { shiftKey: true })
    })
    // 3 rows × 2 columns = 6 cells all selected
    expect(selectedCells().length).toBe(6)
  })

  it('does NOT add cell-range attributes when cellRange is false (default)', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelectorAll('[data-iris-cell-row]').length).toBe(0)
  })

  it('Escape clears the selection', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    act(() => {
      fireEvent.click(cell(0, 0))
    })
    expect(selectedCells().length).toBe(1)
    const table = document.querySelector('[data-iris-table]') as HTMLElement
    act(() => {
      fireEvent.keyDown(table, { key: 'Escape' })
    })
    expect(selectedCells().length).toBe(0)
  })
})
