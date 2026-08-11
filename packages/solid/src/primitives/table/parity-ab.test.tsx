import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal, type JSX } from 'solid-js'
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableContextMenuParams, IrisTableHandle } from './types'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
}
const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30, status: 'active' },
  { id: 2, name: 'Bob', age: 25, status: 'paused' },
  { id: 3, name: 'Charlie', age: 28, status: 'active' },
]
const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
  { key: 'status', title: 'Status' },
]
const filterCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  {
    key: 'status',
    title: 'Status',
    sortable: true,
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
    ],
  },
]
const bodyRows = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('[data-iris-table-row=""]'),
]
const nameCells = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>('[data-iris-table-cell="name"]')].map(
    (c) => c.textContent ?? '',
  )
/** Dispatch a pointer-shaped plain Event (jsdom has no PointerEvent). */
function pointer(el: Element, type: string, x: number, y: number): void {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    clientX: number
    clientY: number
    button: number
  }
  Object.assign(ev, { clientX: x, clientY: y, button: 0 })
  el.dispatchEvent(ev)
}
const rect = (left: number, top: number, w: number, h: number): DOMRect =>
  ({
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
    x: left,
    y: top,
    toJSON() {},
  }) as DOMRect
/** Stub getBoundingClientRect so closestCenter resolves deterministically:
 * header targets sit side by side (140px each), row handles one per 40px row. */
function stubRects(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const headerId = this.getAttribute('data-iris-table-header')
    if (headerId && headerId !== '__seq' && headerId !== '__drag') {
      const left = headerId === 'name' ? 0 : headerId === 'age' ? 140 : 280
      return rect(left, 0, 140, 40)
    }
    const handleId = this.getAttribute('data-iris-row-drag-handle')
    if (handleId) return rect(0, (Number(handleId) - 1) * 40, 40, 40)
    return rect(0, 0, 0, 0)
  })
}

describe('IrisTable parity-AB: rowDrag / columnDrag', () => {
  it('rowDrag reorders rows through the handle, reporting onDataChange + onReorder; a tap without movement cancels', () => {
    stubRects()
    const onReorder = vi.fn()
    const onDataChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        rowDrag={{ onReorder }}
        onDataChange={onDataChange}
      />
    ))
    const root = container.querySelector('[data-iris-table]')!
    // Drag row 1's handle onto row 3 (row 1's rect is the first target).
    pointer(container.querySelector('[data-iris-row-drag-handle="1"]')!, 'pointerdown', 20, 20)
    pointer(root, 'pointermove', 20, 100)
    pointer(root, 'pointerup', 20, 100)
    expect(nameCells(container)).toEqual(['Bob', 'Charlie', 'Alice'])
    expect(onReorder).toHaveBeenCalledWith([rows[1], rows[2], rows[0]])
    expect(onDataChange).toHaveBeenCalledWith([rows[1], rows[2], rows[0]])
    // A plain tap (no threshold movement) cancels instead of reordering.
    pointer(container.querySelector('[data-iris-row-drag-handle="2"]')!, 'pointerdown', 20, 60)
    pointer(root, 'pointerup', 20, 60)
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(nameCells(container)).toEqual(['Bob', 'Charlie', 'Alice'])
  })

  it('columnDrag reorders columns on drop; a tap without movement does not', () => {
    stubRects()
    const onReorder = vi.fn()
    const { container } = render(() => (
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} />
    ))
    const root = container.querySelector('[data-iris-table]')!
    // Press the "name" header, drag past the threshold onto "status", drop.
    pointer(container.querySelector('[data-iris-table-header="name"]')!, 'pointerdown', 70, 10)
    pointer(root, 'pointermove', 350, 10)
    pointer(root, 'pointerup', 350, 10)
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder.mock.calls[0]![0].map((c: IrisTableColumn<Row>) => c.key)).toEqual([
      'age',
      'status',
      'name',
    ])
    // A plain tap (no threshold movement) cancels instead of reordering.
    pointer(container.querySelector('[data-iris-table-header="age"]')!, 'pointerdown', 210, 10)
    pointer(root, 'pointerup', 210, 10)
    expect(onReorder).toHaveBeenCalledTimes(1)
  })
})

describe('IrisTable parity-AB: context menu', () => {
  const menu = (): HTMLElement | null => document.querySelector('[data-iris-table-context-menu]')
  const bodyCell = (rowIdx: number, key: string): HTMLElement =>
    [...document.querySelectorAll<HTMLElement>('[data-iris-table-row=""]')][rowIdx]!.querySelector(
      `[data-iris-table-cell="${key}"]`,
    ) as HTMLElement
  function renderMenu(onSelect: ReturnType<typeof vi.fn>): void {
    render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{
          items: (p: IrisTableContextMenuParams<Row>) => [
            { key: 'edit', label: 'Edit row' },
            { key: 'delete', label: 'Delete row', disabled: p.rowIndex === 1 },
          ],
          onSelect,
        }}
      />
    ))
  }

  it('right-clicking a body cell opens the menu at the cursor; an item click fires onSelect and closes', async () => {
    const onSelect = vi.fn()
    renderMenu(onSelect)
    fireEvent.contextMenu(bodyCell(0, 'name'), { clientX: 120, clientY: 80 })
    const el = menu()
    expect(el).not.toBeNull()
    // Portaled to document.body (the table root clips overflow); Solid's
    // Portal wraps the content in a container div before appending to body.
    expect(el!.parentElement!.parentElement).toBe(document.body)
    expect(el!.getAttribute('role')).toBe('menu')
    const items = el!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(2)
    expect(items[0]!.textContent).toBe('Edit row')
    expect(items[1]!.textContent).toBe('Delete row')
    // Positioned at the cursor via the virtual anchor.
    await waitFor(() => {
      expect(el!.style.transform).toContain('translate3d(120px, 80px')
    })
    fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="edit"]')!)
    expect(onSelect).toHaveBeenCalledWith(
      'edit',
      expect.objectContaining({ row: rows[0], rowIndex: 0, columnIndex: 0 }),
    )
    expect(onSelect.mock.calls[0]![1].column).toBe(cols[0])
    expect(menu()).toBeNull()
  })

  it('Escape closes the menu; a disabled item is inert', () => {
    const onSelect = vi.fn()
    renderMenu(onSelect)
    fireEvent.contextMenu(bodyCell(1, 'status'), { clientX: 10, clientY: 10 })
    const deleteItem = document.querySelector(
      '[data-iris-table-context-menu-item="delete"]',
    ) as HTMLButtonElement
    expect(deleteItem.disabled).toBe(true)
    expect(deleteItem.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(deleteItem)
    expect(onSelect).not.toHaveBeenCalled()
    expect(menu()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(menu()).toBeNull()
  })

  it('right-clicking the header does NOT open the menu', () => {
    const onSelect = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect }}
      />
    ))
    fireEvent.contextMenu(container.querySelector('[data-iris-table-header="name"]')!)
    expect(menu()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('IrisTable parity-AB: filter panel (filterValues)', () => {
  function FilterHarness(props: { initial?: Record<string, string[]> }): JSX.Element {
    const [filterValues, setFilterValues] = createSignal<Record<string, string[]>>(
      props.initial ?? {},
    )
    return (
      <IrisTable
        columns={filterCols}
        data={rows}
        rowKey="id"
        filterValues={filterValues()}
        onFilterValuesChange={setFilterValues}
      />
    )
  }

  const trigger = (): HTMLButtonElement | null =>
    document.querySelector('[data-iris-filter-trigger="status"]')
  const panel = (): HTMLElement | null => document.querySelector('[data-iris-table-filter-panel]')

  it('the trigger opens the panel WITHOUT sorting; checking + confirm filters rows (OR-match); a second open pre-checks', () => {
    const { container } = render(() => <FilterHarness />)
    const trg = trigger()
    expect(trg).not.toBeNull()
    expect(trg!.getAttribute('aria-label')).toBe('Filter')
    fireEvent.click(trg!)
    expect(panel()).not.toBeNull()
    expect(panel()!.parentElement!.parentElement).toBe(document.body)
    expect(panel()!.getAttribute('data-iris-table-filter-column')).toBe('status')
    expect(panel()!.querySelectorAll('[data-iris-filter-option]').length).toBe(2)
    // The status column is sortable too — the trigger click must not sort.
    expect(
      document.querySelector('[data-iris-table-header="status"]')!.getAttribute('aria-sort'),
    ).toBe('none')
    // Check an option + confirm → OR-match: only 'active' rows survive.
    fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]')!)
    expect(nameCells(container)).toEqual(['Alice', 'Charlie'])
    // The trigger re-renders with the applied set (fresh query — the header
    // re-render replaces the button node).
    expect(trigger()!.getAttribute('data-iris-filter-active')).toBe('true')
    // A second open pre-checks the applied set; adding 'paused' widens to all.
    fireEvent.click(trigger()!)
    expect(
      (panel()!.querySelector('[data-iris-filter-option="active"] input') as HTMLInputElement)
        .checked,
    ).toBe(true)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-option="paused"] input')!)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]')!)
    expect(bodyRows(container).length).toBe(3)
    // A text filter AND the checked set combine (both must pass): name
    // contains 'a' AND status in {active} → rows 1 and 3.
    const combined = render(() => (
      <IrisTable
        columns={filterCols}
        data={rows}
        rowKey="id"
        filters={{ name: 'a' }}
        filterValues={{ status: ['active'] }}
      />
    ))
    expect(nameCells(combined.container)).toEqual(['Alice', 'Charlie'])
  })

  it('clear removes the filter immediately', () => {
    const { container } = render(() => <FilterHarness initial={{ status: ['active'] }} />)
    expect(trigger()!.getAttribute('data-iris-filter-active')).toBe('true')
    fireEvent.click(trigger()!)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-clear]')!)
    expect(trigger()!.getAttribute('data-iris-filter-active')).toBeNull()
    expect(bodyRows(container).length).toBe(3)
  })

  it('remoteFilter merges the checked sets into the query filters as comma-joined strings', async () => {
    const query = vi.fn(async () => ({ rows, total: 3 }))
    const { container } = render(() => (
      <IrisTable
        columns={filterCols}
        data={[]}
        rowKey="id"
        filterValues={{ status: ['active', 'paused'] }}
        proxyConfig={{ query, remoteFilter: true }}
      />
    ))
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')).toBeTruthy()
    })
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { status: 'active,paused' } }),
    )
  })
})

describe('IrisTable parity-AB: tableRef handle', () => {
  it('loadData replaces rows without a query; reloadData re-queries; commitProxy/getProxyInfo', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 3 }))
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onDataChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={[]}
        rowKey="id"
        proxyConfig={{ query }}
        tableRef={ref}
        onDataChange={onDataChange}
      />
    ))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    // loadData: replaces the live list, NO new query.
    ref.current!.loadData([rows[1]])
    await waitFor(() => expect(nameCells(container)).toEqual(['Bob']))
    expect(query).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenCalledWith([rows[1]])
    expect(ref.current!.getProxyInfo()).toEqual({ page: 1, pageSize: 10, total: 3 })
    // reloadData: re-fetches the current page; the server page replaces the
    // local rows.
    ref.current!.reloadData()
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(nameCells(container)).toEqual(['Alice']))
    // commitProxy: merges params and re-requests.
    ref.current!.commitProxy({ page: 2 })
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    )
    expect(ref.current!.getProxyInfo()).toEqual({ page: 2, pageSize: 10, total: 3 })
  })

  it('clearSort resets the single sort channel; clearFilter resets both filter channels', () => {
    const sortCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'age', title: 'Age' },
    ]
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const { container } = render(() => (
      <IrisTable
        columns={sortCols}
        data={rows}
        rowKey="id"
        filters={{ name: 'x' }}
        filterValues={{ status: ['active'] }}
        onFiltersChange={onFiltersChange}
        onFilterValuesChange={onFilterValuesChange}
        tableRef={ref}
      />
    ))
    const headerEl = container.querySelector('[data-iris-table-header="name"]')!
    fireEvent.click(headerEl)
    expect(headerEl.getAttribute('aria-sort')).toBe('ascending')
    ref.current!.clearSort()
    expect(headerEl.getAttribute('aria-sort')).toBe('none')
    ref.current!.clearFilter()
    expect(onFiltersChange).toHaveBeenCalledWith({})
    expect(onFilterValuesChange).toHaveBeenCalledWith({})
  })

  it('loadData on a local table fires onDataChange; a controlled data re-feed wins again', () => {
    const [data, setData] = createSignal<Row[]>(rows)
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onDataChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={cols}
        data={data()}
        rowKey="id"
        tableRef={ref}
        onDataChange={onDataChange}
      />
    ))
    const nova: Row = { id: 9, name: 'Nova', age: 1, status: 'new' }
    ref.current!.loadData([nova])
    expect(nameCells(container)).toEqual(['Nova'])
    expect(onDataChange).toHaveBeenCalledWith([nova])
    // The parent re-feed (NEW reference) clears the override.
    setData([...rows])
    expect(nameCells(container)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('a pager page change replaces loadData rows (no stale page-1 override)', async () => {
    const query = vi.fn(async (p: { page: number }) => ({
      rows: p.page === 1 ? [rows[0]] : [rows[1]],
      total: 3,
    }))
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const { container } = render(() => (
      <IrisTable columns={cols} data={[]} rowKey="id" proxyConfig={{ query }} tableRef={ref} />
    ))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    // loadData overrides the live list locally (no query fired)…
    ref.current!.loadData([rows[2]])
    await waitFor(() => expect(nameCells(container)).toEqual(['Charlie']))
    expect(query).toHaveBeenCalledTimes(1)
    // …but the NEXT page fetch replaces the override wholesale: the pager now
    // shows page 2, so the table must render page-2 rows, not the stale list.
    ref.current!.commitProxy({ page: 2 })
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    )
    await waitFor(() => expect(nameCells(container)).toEqual(['Bob']))
  })
})
