import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
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
    (c) => (c.textContent ?? '').replace(/▶/g, ''), // tree caret glyph is chrome, not data
  )
const menu = (): HTMLElement | null => document.querySelector('[data-iris-table-context-menu]')
const panel = (): HTMLElement | null => document.querySelector('[data-iris-table-filter-panel]')
const filterTrigger = (): HTMLButtonElement | null =>
  document.querySelector('[data-iris-filter-trigger="status"]')

describe('IrisTable parity-AD: context menu', () => {
  const bodyCell = (rowIdx: number, key: string): HTMLElement =>
    [...document.querySelectorAll<HTMLElement>('[data-iris-table-row=""]')][rowIdx]!.querySelector(
      `[data-iris-table-cell="${key}"]`,
    ) as HTMLElement
  function renderMenu(onSelect: ReturnType<typeof vi.fn>): ReturnType<typeof render> {
    return render(() => (
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
    expect(menu()).not.toBeNull()
    expect(menu()!.parentElement!.parentElement).toBe(document.body)
    await waitFor(() => {
      expect(menu()!.style.transform).toContain('translate3d(120px, 80px')
    })
    fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="edit"]')!)
    expect(onSelect).toHaveBeenCalledWith(
      'edit',
      expect.objectContaining({ row: rows[0], rowIndex: 0, columnIndex: 0 }),
    )
    expect(menu()).toBeNull()
  })

  it('Escape closes the menu; the header never opens it', () => {
    const onSelect = vi.fn()
    const { container } = renderMenu(onSelect)
    fireEvent.contextMenu(bodyCell(1, 'status'), { clientX: 10, clientY: 10 })
    expect(menu()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(menu()).toBeNull()
    fireEvent.contextMenu(container.querySelector('[data-iris-table-header="name"]')!)
    expect(menu()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('IrisTable parity-AD: filter panel (filterValues)', () => {
  it('check + confirm filters rows (OR-match); clear removes immediately', () => {
    const [filterValues, setFilterValues] = createSignal<Record<string, string[]>>({})
    const { container } = render(() => (
      <IrisTable
        columns={filterCols}
        data={rows}
        rowKey="id"
        filterValues={filterValues()}
        onFilterValuesChange={setFilterValues}
      />
    ))
    fireEvent.click(filterTrigger()!)
    expect(panel()).not.toBeNull()
    fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]')!)
    expect(nameCells(container)).toEqual(['Alice', 'Charlie'])
    // OR-match: checking 'paused' too widens the result back to all rows.
    fireEvent.click(filterTrigger()!)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-option="paused"] input')!)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]')!)
    expect(bodyRows(container).length).toBe(3)
    fireEvent.click(filterTrigger()!)
    fireEvent.click(panel()!.querySelector('[data-iris-filter-clear]')!)
    expect(bodyRows(container).length).toBe(3)
    expect(filterTrigger()!.getAttribute('data-iris-filter-active')).toBeNull()
  })

  it('remoteFilter comma-joins the checked sets into the query filters', async () => {
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

describe('IrisTable parity-AD: tableRef handle', () => {
  it('loadData replaces rows without a query; reloadData re-queries; getProxyInfo', async () => {
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
    ref.current!.loadData([rows[1]])
    await waitFor(() => expect(nameCells(container)).toEqual(['Bob']))
    expect(query).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenCalledWith([rows[1]])
    expect(ref.current!.getProxyInfo()).toEqual({ page: 1, pageSize: 10, total: 3 })
    ref.current!.reloadData()
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(nameCells(container)).toEqual(['Alice']))
  })

  it('clearSort resets the sort channel; clearFilter resets both filter channels', () => {
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
})
