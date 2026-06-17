import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisTable } from '../IrisTable'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
]

describe('IrisTable multi-level (grouped) headers', () => {
  const groupedCols: IrisTableColumn[] = [
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
    const { container } = render(() => <IrisTable columns={columns} data={data} />)
    expect(container.querySelector('[data-iris-table-header-grouped]')).toBeNull()
  })

  it('a column with children renders a grouped header with span attrs', () => {
    const { container } = render(() => <IrisTable columns={groupedCols} data={data} />)
    expect(container.querySelector('[data-iris-table-header-grouped]')).not.toBeNull()
    // The group cell spans its 2 leaves and is marked as a group.
    const group = header('info')!
    expect(group.getAttribute('aria-colspan')).toBe('2')
    expect(group.getAttribute('data-iris-table-header-group')).toBe('')
    // Leaf header cells exist and the group's leaves are NOT marked as a group.
    expect(header('age')!.getAttribute('data-iris-table-header-group')).toBeNull()
    expect(header('id')).not.toBeNull()
  })

  it('the body renders the LEAF columns (group is header-only)', () => {
    const { container } = render(() => <IrisTable columns={groupedCols} data={data} />)
    // 3 leaf columns × 3 rows of body cells (name, age, id); no "info" data cell.
    expect(container.querySelectorAll('[data-iris-table-cell="age"]').length).toBe(3)
    expect(container.querySelectorAll('[data-iris-table-cell="id"]').length).toBe(3)
    expect(container.querySelector('[data-iris-table-cell="info"]')).toBeNull()
  })

  it('a sortable leaf inside a group still sorts', () => {
    const onSortChange = vi.fn()
    render(() => <IrisTable columns={groupedCols} data={data} onSortChange={onSortChange} />)
    fireEvent.click(header('age')!)
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'age', direction: 'asc' })
  })
})

describe('IrisTable grid keyboard navigation', () => {
  function cellAt(r: number, c: number): HTMLElement | null {
    return document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`)
  }

  it('is off by default: role=table, no grid coords', () => {
    render(() => <IrisTable columns={columns} data={data} />)
    expect(document.querySelector('[role=grid]')).toBeNull()
    expect(document.querySelector('[role=table]')).not.toBeNull()
    expect(cellAt(0, 0)).toBeNull()
  })

  it('opt-in makes the table a grid with roving cell tabindex', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    expect(document.querySelector('[role=grid]')).not.toBeNull()
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('0') // first cell focusable
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('-1')
  })

  it('container role upgrades to treegrid only for a keyboard-navigable tree', () => {
    interface TRow extends Record<string, unknown> {
      id: number
      name: string
      children?: TRow[]
    }
    const tCols: IrisTableColumn<TRow>[] = [{ key: 'name', title: 'Name' }]
    const tData: TRow[] = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }]
    // tree + keyboardNavigation → treegrid.
    const treeKbd = render(() => (
      <IrisTable columns={tCols} data={tData} getSubRows={(r) => r.children} keyboardNavigation />
    ))
    expect(treeKbd.container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe(
      'treegrid',
    )
    treeKbd.unmount()
    // non-tree + keyboardNavigation → grid (unchanged).
    const flatKbd = render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    expect(flatKbd.container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe('grid')
    flatKbd.unmount()
    // tree WITHOUT keyboardNavigation → table (no managed cell focus).
    const treeOnly = render(() => (
      <IrisTable columns={tCols} data={tData} getSubRows={(r) => r.children} />
    ))
    expect(treeOnly.container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe(
      'table',
    )
  })

  it('ArrowRight / ArrowDown move the focused cell and roving tabindex', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    cellAt(0, 0)!.focus()
    // Fire on the CELL so the event bubbles to the root handler with the cell as
    // target (target carries data-grid-row); firing on the root makes target=root.
    fireEvent.keyDown(cellAt(0, 0)!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cellAt(0, 1))
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('0')
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('-1')
    fireEvent.keyDown(cellAt(0, 1)!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cellAt(1, 1))
  })

  it('does not move past an edge (no wrap)', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    cellAt(0, 0)!.focus()
    fireEvent.keyDown(cellAt(0, 0)!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cellAt(0, 0)) // stayed
  })

  it('End jumps to the last column of the row', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    cellAt(0, 0)!.focus()
    fireEvent.keyDown(cellAt(0, 0)!, { key: 'End' })
    expect(document.activeElement).toBe(cellAt(0, 1)) // 2 columns → last is col 1
  })
})

describe('IrisTable virtual scroll', () => {
  interface VRow extends Record<string, unknown> {
    id: number
    name: string
    children?: VRow[]
  }
  const vcols: IrisTableColumn<VRow>[] = [{ key: 'name', title: 'Name' }]
  const rowEls = (): Element[] => Array.from(document.querySelectorAll('[data-iris-table-row=""]'))

  it('renders the body inside a virtual scroller that windows the rows', () => {
    const many: VRow[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `N${i}` }))
    render(() => (
      <IrisTable columns={vcols} data={many} virtualScroll={{ itemHeight: 36, height: 200 }} />
    ))
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    const count = rowEls().length
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(50)
  })

  it('virtualizes tree mode (uniform-height rows) with tree decoration intact', () => {
    const tree: VRow[] = [
      {
        id: 1,
        name: 'Root',
        children: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `C${i}` })),
      },
    ]
    render(() => (
      <IrisTable
        columns={vcols}
        data={tree}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />
    ))
    // Tree mode now uses the virtual scroller (was previously excluded).
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    // Tree meta still flows into the virtualized rows (the parent toggle renders).
    expect(document.querySelector('[data-iris-table-tree-toggle]')).not.toBeNull()
    // Windowed: far fewer than the 41 total rows are in the DOM.
    expect(rowEls().length).toBeLessThan(41)
  })

  it('does NOT virtualize tree mode when renderDetail is set (variable-height rows)', () => {
    const tree: VRow[] = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'C' }] }]
    render(() => (
      <IrisTable
        columns={vcols}
        data={tree}
        getSubRows={(r) => r.children}
        renderDetail={(r) => <div>d{(r as VRow).id}</div>}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />
    ))
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  })
})

describe('IrisTable column virtualization', () => {
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
    render(() => <IrisTable columns={wideCols} data={wideRows} />)
    expect(document.querySelectorAll('[data-iris-table-header]').length).toBe(8)
  })

  it('renders only a window of columns when enabled', () => {
    render(() => <IrisTable columns={wideCols} data={wideRows} columnVirtualization />)
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
    render(() => <IrisTable columns={cols} data={wideRows} columnVirtualization />)
    // The far pinned column (index 7) renders despite being outside the window.
    expect(document.querySelector('[data-iris-table-header="c7"]')).not.toBeNull()
  })
})

describe('IrisTable column resize', () => {
  // jsdom may not implement PointerEvent — fall back to a synthetic Event
  // decorated with the fields useDrag reads (mirrors the useDrag test idiom).
  function makePointerEvent(type: string, init: PointerEventInit = {}): Event {
    const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
    if (typeof PointerCtor === 'function') {
      return new (PointerCtor as new (type: string, init?: EventInit) => Event)(type, {
        bubbles: true,
        ...init,
      })
    }
    const event = new Event(type, { bubbles: true })
    Object.assign(event, {
      button: init.button ?? 0,
      buttons: init.buttons ?? 1,
      clientX: init.clientX ?? 0,
      clientY: init.clientY ?? 0,
      pointerId: init.pointerId ?? 1,
    })
    return event
  }

  function handle(key: string): HTMLElement | null {
    return document.querySelector(`[data-iris-table-resize-handle][data-column-key="${key}"]`)
  }
  function gridCols(): string {
    // The column template lives on each row's grid (flat header row here).
    return (document.querySelector('[data-iris-table-header-row]') as HTMLElement).style
      .gridTemplateColumns
  }

  it('renders no resize handles unless resizableColumns', () => {
    render(() => <IrisTable columns={columns} data={data} />)
    expect(document.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(0)
  })

  it('renders a separator handle per column when resizableColumns', () => {
    render(() => <IrisTable columns={columns} data={data} resizableColumns />)
    expect(document.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(2)
    expect(handle('name')!.getAttribute('role')).toBe('separator')
    expect(handle('name')!.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('ArrowRight grows the column width (uncontrolled)', () => {
    render(() => (
      <IrisTable
        columns={columns}
        data={data}
        resizableColumns
        defaultColumnWidths={{ name: 100 }}
      />
    ))
    expect(gridCols()).toContain('100px')
    fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' })
    expect(gridCols()).toContain('116px')
  })

  it('ArrowLeft shrinks but clamps to the column minWidth', () => {
    const cols: IrisTableColumn[] = [
      { key: 'name', title: 'Name', minWidth: 90 },
      { key: 'age', title: 'Age' },
    ]
    render(() => (
      <IrisTable columns={cols} data={data} resizableColumns defaultColumnWidths={{ name: 100 }} />
    ))
    fireEvent.keyDown(handle('name')!, { key: 'ArrowLeft' }) // 100-16=84 → clamp to 90
    expect(gridCols()).toContain('90px')
  })

  it('ArrowRight clamps to the column maxWidth', () => {
    const cols: IrisTableColumn[] = [
      { key: 'name', title: 'Name', maxWidth: 110 },
      { key: 'age', title: 'Age' },
    ]
    render(() => (
      <IrisTable columns={cols} data={data} resizableColumns defaultColumnWidths={{ name: 100 }} />
    ))
    fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' }) // 100+16=116 → clamp to 110
    expect(gridCols()).toContain('110px')
  })

  it('onColumnWidthsChange fires with the new widths', () => {
    const onChange = vi.fn()
    render(() => (
      <IrisTable
        columns={columns}
        data={data}
        resizableColumns
        defaultColumnWidths={{ name: 100 }}
        onColumnWidthsChange={onChange}
      />
    ))
    fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ name: 116 })
  })

  it('controlled columnWidths render the given widths', () => {
    render(() => (
      <IrisTable
        columns={columns}
        data={data}
        resizableColumns
        columnWidths={{ name: 150, age: 80 }}
      />
    ))
    expect(gridCols()).toContain('150px')
    expect(gridCols()).toContain('80px')
  })

  it('controlled columnWidths do not change on local resize (parent owns state)', () => {
    const onChange = vi.fn()
    render(() => (
      <IrisTable
        columns={columns}
        data={data}
        resizableColumns
        columnWidths={{ name: 150, age: 80 }}
        onColumnWidthsChange={onChange}
      />
    ))
    fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' })
    // The callback fires with the intended next value...
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ name: 166 })
    // ...but the displayed grid still reflects the controlling prop.
    expect(gridCols()).toContain('150px')
  })

  it('a pointer drag on the handle resizes the column + fires onColumnWidthsChange', () => {
    const onChange = vi.fn()
    render(() => (
      <IrisTable
        columns={columns}
        data={data}
        resizableColumns
        defaultColumnWidths={{ name: 100 }}
        onColumnWidthsChange={onChange}
      />
    ))
    const h = handle('name')!
    h.dispatchEvent(makePointerEvent('pointerdown', { clientX: 200, clientY: 0 }))
    h.dispatchEvent(makePointerEvent('pointermove', { clientX: 240, clientY: 0 }))
    h.dispatchEvent(makePointerEvent('pointerup', { clientX: 240, clientY: 0 }))
    // start width 100 + dx 40 → 140, min-clamped (>= 60), no max.
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ name: 140 })
    expect(gridCols()).toContain('140px')
  })

  it('clicking the resize handle does not trigger sort', () => {
    const onSort = vi.fn()
    render(() => <IrisTable columns={columns} data={data} resizableColumns onSortChange={onSort} />)
    fireEvent.click(handle('name')!)
    expect(onSort).not.toHaveBeenCalled()
  })
})
