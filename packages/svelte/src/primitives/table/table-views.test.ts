import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
import { TABLE_VIEWS_SAVE_ITEM } from '@iris-ui-kit/core'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
]
const data = [{ id: 1, name: 'A', age: 1 }]

function storage(): { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> } {
  const seed = JSON.stringify([
    { name: 'NameAsc', snapshot: { sort: { key: 'name', direction: 'asc' } } },
    { name: 'AgeDesc', snapshot: { sort: { key: 'age', direction: 'desc' } } },
  ])
  return { getItem: vi.fn(() => seed), setItem: vi.fn() }
}

describe('IrisTable named views and table tabs', () => {
  it('renders tabs and applies a stored view through the normal sort callback', async () => {
    const onSort = vi.fn()
    const onActive = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        views: { storage: storage() },
        tableTabs: [{ key: 'age', label: 'Age', views: ['AgeDesc'] }],
        onUpdateSort: onSort,
        onActiveViewChange: onActive,
      },
    })
    expect(container.querySelector('[data-iris-table-tabs]')?.getAttribute('role')).toBe('tablist')
    await fireEvent.click(container.querySelector('[data-iris-table-tab="age"]') as HTMLElement)
    expect(onSort).toHaveBeenCalledWith({ key: 'age', direction: 'desc' })
    expect(onActive).toHaveBeenCalledWith('AgeDesc')
    expect(
      container.querySelector('[data-iris-table-tab="age"]')?.getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('deduplicates tab keys and skips unknown view names', async () => {
    const onSort = vi.fn()
    const onActive = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        views: { storage: storage() },
        tableTabs: [
          { key: 'dup', label: 'First', views: ['Missing'] },
          { key: 'dup', label: 'Second', views: ['NameAsc'] },
        ],
        onUpdateSort: onSort,
        onActiveViewChange: onActive,
      },
    })
    expect(container.querySelectorAll('[data-iris-table-tab]')).toHaveLength(1)
    await fireEvent.click(container.querySelector('[data-iris-table-tab="dup"]') as HTMLElement)
    expect(onSort).not.toHaveBeenCalled()
    expect(onActive).not.toHaveBeenCalled()
  })
})

const fullSnapshot = {
  sort: { key: 'age', direction: 'desc' },
  multiSort: [
    { key: 'name', direction: 'asc' },
    { key: 'age', direction: 'desc' },
  ],
  filters: { status: 'active' },
  filterValues: { status: ['active', 'paused'] },
  columnWidths: { name: 220 },
  expandedRowKeys: ['1'],
}

function fullStorage(): ReturnType<typeof storage> {
  const seed = JSON.stringify([{ name: 'Full', snapshot: fullSnapshot }])
  return { getItem: vi.fn(() => seed), setItem: vi.fn() }
}

const fullColumns = [
  { key: 'name', title: 'Name', sortable: true, width: 120 },
  { key: 'age', title: 'Age', sortable: true },
  {
    key: 'status',
    title: 'Status',
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
    ],
  },
]
const fullData = [
  { id: 1, name: 'A', age: 1, status: 'active' },
  { id: 2, name: 'B', age: 2, status: 'paused' },
  { id: 3, name: 'C', age: 3, status: 'inactive' },
]

function viewNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-iris-table-views] option')]
    .map((option) => option.getAttribute('value'))
    .filter(
      (value): value is string => value !== null && value !== '' && value !== TABLE_VIEWS_SAVE_ITEM,
    )
}

async function selectView(container: HTMLElement, name: string): Promise<void> {
  const select = container.querySelector('[data-iris-table-views]') as HTMLSelectElement
  await fireEvent.change(select, { target: { value: name } })
}

async function saveView(container: HTMLElement, name: string): Promise<void> {
  await selectView(container, TABLE_VIEWS_SAVE_ITEM)
  const input = document.querySelector('[data-iris-views-save]') as HTMLInputElement
  await fireEvent.input(input, { target: { value: name } })
  await fireEvent.keyDown(input, { key: 'Enter' })
}

describe('IrisTable named-view snapshot channels', () => {
  it('replays every present field of a stored snapshot through its owning channel', async () => {
    const onUpdateSort = vi.fn()
    const onUpdateMultiSort = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const onColumnWidthsChange = vi.fn()
    const onExpandedRowsChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        rowKey: 'id',
        multiSort: true,
        renderDetail: () => 'detail',
        views: { storage: fullStorage() },
        onUpdateSort,
        onUpdateMultiSort,
        onFiltersChange,
        onFilterValuesChange,
        onColumnWidthsChange,
        onExpandedRowsChange,
      },
    })
    await selectView(container, 'Full')
    expect(onUpdateSort).toHaveBeenCalledWith(fullSnapshot.sort)
    expect(onUpdateMultiSort).toHaveBeenCalledWith(fullSnapshot.multiSort)
    expect(onFiltersChange).toHaveBeenCalledWith(fullSnapshot.filters)
    expect(onFilterValuesChange).toHaveBeenCalledWith(fullSnapshot.filterValues)
    expect(onColumnWidthsChange).toHaveBeenCalledWith(fullSnapshot.columnWidths)
    expect(onExpandedRowsChange).toHaveBeenCalledWith(fullSnapshot.expandedRowKeys)
  })

  it('keeps a controlled filters prop authoritative when a view proposes filters', async () => {
    const onFiltersChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        rowKey: 'id',
        filters: { status: 'paused' },
        views: { storage: fullStorage() },
        onFiltersChange,
      },
    })
    const bodyNames = () =>
      [...container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')].map((row) =>
        row.querySelector('[data-iris-table-cell="name"]')?.textContent?.trim(),
      )
    expect(bodyNames()).toEqual(['B'])
    await selectView(container, 'Full')
    expect(onFiltersChange).toHaveBeenCalledWith(fullSnapshot.filters)
    expect(bodyNames()).toEqual(['B'])
  })

  it('skips snapshot fields the table does not own', async () => {
    const onUpdateSort = vi.fn()
    const onUpdateMultiSort = vi.fn()
    const onFiltersChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        views: { storage: fullStorage() },
        onUpdateSort,
        onUpdateMultiSort,
        onFiltersChange,
      },
    })
    await selectView(container, 'Full')
    expect(onUpdateSort).toHaveBeenCalledWith(fullSnapshot.sort)
    // No multiSort mode, no expansion/detail, no filterValues/widths channel.
    expect(onUpdateMultiSort).not.toHaveBeenCalled()
    expect(onFiltersChange).toHaveBeenCalledWith(fullSnapshot.filters)
  })

  it('captures the owned channels on save and upserts duplicate names', async () => {
    const setItem = vi.fn()
    const views = { storage: { getItem: vi.fn(() => null), setItem } }
    const { container } = render(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        multiSort: true,
        onFilterValuesChange: vi.fn(),
        views,
      },
    })
    await fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await saveView(container, 'Mine')
    const first = JSON.parse(setItem.mock.lastCall![1] as string)
    expect(first).toHaveLength(1)
    expect(first[0].name).toBe('Mine')
    expect(first[0].snapshot.multiSort).toEqual([{ key: 'name', direction: 'asc' }])

    // Second cycle (desc) + second save upserts the same name.
    await fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await saveView(container, 'Mine')
    const second = JSON.parse(setItem.mock.lastCall![1] as string)
    expect(second).toHaveLength(1)
    expect(second[0].snapshot.multiSort).toEqual([{ key: 'name', direction: 'desc' }])
  })

  it('renders an empty view list from corrupt storage without crashing', () => {
    const { container } = render(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        views: { storage: { getItem: vi.fn(() => '{broken'), setItem: vi.fn() } },
      },
    })
    expect(viewNames(container)).toEqual([])
  })

  it('replays a stored pageSize through the proxy pre-query contract', async () => {
    const onPageChange = vi.fn()
    const query = vi.fn(async () => ({ rows: fullData, total: fullData.length }))
    const seed = JSON.stringify([{ name: 'Wide', snapshot: { pageSize: 3 } }])
    const { container } = render(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        proxyConfig: { query, pageSize: 10, onPageChange },
        views: { storage: { getItem: vi.fn(() => seed), setItem: vi.fn() } },
      },
    })
    await waitFor(() => expect(query).toHaveBeenCalled())
    await selectView(container, 'Wide')
    expect(onPageChange).toHaveBeenCalledWith(1, 3)
    await waitFor(() => {
      const last = query.mock.lastCall![0] as { pageSize?: number }
      expect(last.pageSize).toBe(3)
    })
  })
})
