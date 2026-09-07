import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import { TABLE_VIEWS_SAVE_ITEM } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableViewConfig } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
]
const data: Row[] = [{ id: 1, name: 'A', age: 1 }]

function storage(): { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> } {
  const seed = JSON.stringify([
    { name: 'NameAsc', snapshot: { sort: { key: 'name', direction: 'asc' } } },
    { name: 'AgeDesc', snapshot: { sort: { key: 'age', direction: 'desc' } } },
  ])
  return { getItem: vi.fn(() => seed), setItem: vi.fn() }
}

describe('IrisTable named views and table tabs', () => {
  it('renders tabs and applies a stored view through the normal sort callback', () => {
    const onSort = vi.fn()
    const onActive = vi.fn()
    const config: IrisTableViewConfig = { storage: storage() }
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={data}
        views={config}
        tableTabs={[{ key: 'age', label: 'Age', views: ['AgeDesc'] }]}
        onSortChange={onSort}
        onActiveViewChange={onActive}
      />
    ))
    expect(container.querySelector('[data-iris-table-tabs]')?.getAttribute('role')).toBe('tablist')
    fireEvent.click(container.querySelector('[data-iris-table-tab="age"]') as HTMLElement)
    expect(onSort).toHaveBeenCalledWith({ key: 'age', direction: 'desc' })
    expect(onActive).toHaveBeenCalledWith('AgeDesc')
    expect(
      container.querySelector('[data-iris-table-tab="age"]')?.getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('deduplicates tab keys and skips unknown view names', () => {
    const onSort = vi.fn()
    const onActive = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={data}
        views={{ storage: storage() }}
        tableTabs={[
          { key: 'dup', label: 'First', views: ['Missing'] },
          { key: 'dup', label: 'Second' },
        ]}
        onSortChange={onSort}
        onActiveViewChange={onActive}
      />
    ))
    expect(container.querySelectorAll('[data-iris-table-tab]')).toHaveLength(1)
    fireEvent.click(container.querySelector('[data-iris-table-tab="dup"]') as HTMLElement)
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

const fullColumns: IrisTableColumn<Row>[] = [
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

function selectView(container: HTMLElement, name: string): void {
  fireEvent.change(container.querySelector('[data-iris-table-views]') as HTMLSelectElement, {
    target: { value: name },
  })
}

describe('IrisTable named-view snapshot channels', () => {
  it('replays every present field owned by the Solid adapter', async () => {
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const onColumnWidthsChange = vi.fn()
    const onExpandedRowsChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={fullColumns}
        data={fullData}
        rowKey="id"
        multiSort
        renderDetail={() => <span>detail</span>}
        filters={{ status: 'paused' }}
        onFiltersChange={onFiltersChange}
        filterValues={{ status: ['paused'] }}
        onFilterValuesChange={onFilterValuesChange}
        onColumnWidthsChange={onColumnWidthsChange}
        onExpandedRowsChange={onExpandedRowsChange}
        views={{ storage: fullStorage() }}
      />
    ))
    selectView(container, 'Full')
    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith(fullSnapshot.filters)
    })
    expect(onFilterValuesChange).toHaveBeenCalledWith(fullSnapshot.filterValues)
    expect(onColumnWidthsChange).toHaveBeenCalledWith(fullSnapshot.columnWidths)
    expect(onExpandedRowsChange).toHaveBeenCalledWith(fullSnapshot.expandedRowKeys)
  })

  it('keeps a controlled filters prop authoritative when a view proposes filters', async () => {
    const onFiltersChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={fullColumns}
        data={fullData}
        filters={{ status: 'paused' }}
        views={{ storage: fullStorage() }}
        onFiltersChange={onFiltersChange}
      />
    ))
    expect(container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')).toHaveLength(
      1,
    )
    selectView(container, 'Full')
    await waitFor(() => expect(onFiltersChange).toHaveBeenCalledWith(fullSnapshot.filters))
    expect(container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')).toHaveLength(
      1,
    )
  })

  it('skips snapshot fields without an owning Solid channel', () => {
    const onFiltersChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={fullColumns}
        data={fullData}
        views={{ storage: fullStorage() }}
        onFiltersChange={onFiltersChange}
      />
    ))
    selectView(container, 'Full')
    expect(onFiltersChange).toHaveBeenCalledWith(fullSnapshot.filters)
    expect(container.querySelectorAll('[data-iris-table-tabs]')).toHaveLength(0)
  })

  it('captures owned channels on save and upserts duplicate names', () => {
    const setItem = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={fullColumns}
        data={fullData}
        multiSort
        onFiltersChange={vi.fn()}
        onColumnWidthsChange={vi.fn()}
        views={{ storage: { getItem: vi.fn(() => null), setItem } }}
      />
    ))
    fireEvent.click(container.querySelector('[data-iris-table-header="name"]') as HTMLElement)
    selectView(container, TABLE_VIEWS_SAVE_ITEM)
    const input = document.querySelector('[data-iris-views-save]') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'Mine' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const first = JSON.parse(setItem.mock.lastCall![1] as string)
    expect(first[0].snapshot.multiSort).toEqual([{ key: 'name', direction: 'asc' }])
    expect(first[0].snapshot.filters).toEqual({})

    fireEvent.click(container.querySelector('[data-iris-table-header="name"]') as HTMLElement)
    selectView(container, TABLE_VIEWS_SAVE_ITEM)
    const secondInput = document.querySelector('[data-iris-views-save]') as HTMLInputElement
    fireEvent.input(secondInput, { target: { value: 'Mine' } })
    fireEvent.keyDown(secondInput, { key: 'Enter' })
    const second = JSON.parse(setItem.mock.lastCall![1] as string)
    expect(second).toHaveLength(1)
    expect(second[0].snapshot.multiSort).toEqual([{ key: 'name', direction: 'desc' }])
  })

  it('replays a stored pageSize through the proxy request contract', async () => {
    const onPageChange = vi.fn()
    const query = vi.fn(async () => ({ rows: fullData, total: fullData.length }))
    const seed = JSON.stringify([{ name: 'Wide', snapshot: { pageSize: 3 } }])
    const { container } = render(() => (
      <IrisTable
        columns={fullColumns}
        data={fullData}
        proxyConfig={{ query, pageSize: 10, onPageChange }}
        views={{ storage: { getItem: vi.fn(() => seed), setItem: vi.fn() } }}
      />
    ))
    await waitFor(() => expect(query).toHaveBeenCalled())
    selectView(container, 'Wide')
    expect(onPageChange).toHaveBeenCalledWith(1, 3)
    await waitFor(() => {
      const args = query.mock.lastCall as unknown[] | undefined
      const last = args?.[0] as { pageSize?: number } | undefined
      expect(last?.pageSize).toBe(3)
    })
  })

  it('renders an empty view list from corrupt storage without crashing', () => {
    const { container } = render(() => (
      <IrisTable
        columns={fullColumns}
        data={fullData}
        views={{ storage: { getItem: vi.fn(() => '{broken'), setItem: vi.fn() } }}
      />
    ))
    expect(container.querySelectorAll('[data-iris-table-views] option')).toHaveLength(2)
  })
})
