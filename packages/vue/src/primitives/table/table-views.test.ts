import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import { TABLE_VIEWS_SAVE_ITEM } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableViewConfig } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string; age: number }
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
  it('renders tabs and applies a stored view through the normal sort event', async () => {
    const onActive = vi.fn()
    const config: IrisTableViewConfig = { storage: storage() }
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data,
        views: config,
        tableTabs: [{ key: 'age', label: 'Age', views: ['AgeDesc'] }],
        onActiveViewChange: onActive,
      },
    })
    expect(wrapper.find('[data-iris-table-tabs]').attributes('role')).toBe('tablist')
    expect(wrapper.find('[data-iris-table-views]').exists()).toBe(true)
    await wrapper.find('[data-iris-table-tab="age"]').trigger('click')
    expect(wrapper.emitted('update:sort')?.[0]).toEqual([{ key: 'age', direction: 'desc' }])
    expect(onActive).toHaveBeenCalledWith('AgeDesc')
    expect(wrapper.find('[data-iris-table-tab="age"]').attributes('aria-selected')).toBe('true')
  })

  it('deduplicates tab keys and fails closed for unknown view names', async () => {
    const onActive = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data,
        views: { storage: storage() },
        tableTabs: [
          { key: 'dup', label: 'First', views: ['Missing'] },
          { key: 'dup', label: 'Second', views: ['NameAsc'] },
        ],
        onActiveViewChange: onActive,
      },
    })
    expect(wrapper.findAll('[data-iris-table-tab]')).toHaveLength(1)
    await wrapper.find('[data-iris-table-tab="dup"]').trigger('click')
    expect(wrapper.emitted('update:sort')).toBeUndefined()
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

const fullColumns: IrisTableColumn<Record<string, unknown>>[] = [
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

async function selectView(wrapper: ReturnType<typeof mount>, name: string): Promise<void> {
  await wrapper.find('[data-iris-table-views]').setValue(name)
}

describe('IrisTable named-view snapshot channels', () => {
  it('replays every present field owned by the Vue adapter', async () => {
    const onFilterValuesChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        rowKey: 'id',
        multiSort: true,
        resizableColumns: true,
        renderDetail: () => 'detail',
        filterValues: { status: ['paused'] },
        onFilterValuesChange,
        views: { storage: fullStorage() },
      },
    })
    await selectView(wrapper, 'Full')
    expect(wrapper.emitted('update:sort')?.[0]).toEqual([fullSnapshot.sort])
    expect(wrapper.emitted('update:multiSortState')?.[0]).toEqual([fullSnapshot.multiSort])
    expect(onFilterValuesChange).toHaveBeenCalledWith(fullSnapshot.filterValues)
    expect(wrapper.emitted('update:columnWidths')?.[0]).toEqual([fullSnapshot.columnWidths])
    expect(wrapper.emitted('expandedRowsChange')?.[0]).toEqual([['1']])
  })

  it('keeps a controlled filter-values prop authoritative when a view proposes values', async () => {
    const onFilterValuesChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        filterValues: { status: ['paused'] },
        views: { storage: fullStorage() },
        onFilterValuesChange,
      },
    })
    expect(wrapper.findAll('[data-iris-table-row]')).toHaveLength(1)
    await selectView(wrapper, 'Full')
    expect(onFilterValuesChange).toHaveBeenCalledWith(fullSnapshot.filterValues)
    expect(wrapper.findAll('[data-iris-table-row]')).toHaveLength(1)
  })

  it('skips snapshot fields without an owning Vue channel', async () => {
    const onFilterValuesChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        views: { storage: fullStorage() },
        onFilterValuesChange,
      },
    })
    await selectView(wrapper, 'Full')
    expect(wrapper.emitted('update:sort')?.[0]).toEqual([fullSnapshot.sort])
    expect(wrapper.emitted('update:multiSortState')).toBeUndefined()
    expect(onFilterValuesChange).toHaveBeenCalledWith(fullSnapshot.filterValues)
    expect(wrapper.emitted('update:columnWidths')).toBeUndefined()
    expect(wrapper.emitted('expandedRowsChange')).toBeUndefined()
  })

  it('captures owned channels on save and upserts duplicate names', async () => {
    const setItem = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        multiSort: true,
        resizableColumns: true,
        views: { storage: { getItem: vi.fn(() => null), setItem } },
      },
    })
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await wrapper.find('[data-iris-table-views]').setValue(TABLE_VIEWS_SAVE_ITEM)
    await wrapper.find('[data-iris-views-save]').setValue('Mine')
    await wrapper.find('[data-iris-views-save]').trigger('keydown', { key: 'Enter' })
    const first = JSON.parse(setItem.mock.lastCall![1] as string)
    expect(first[0].snapshot.multiSort).toEqual([{ key: 'name', direction: 'asc' }])
    expect(first[0].snapshot.columnWidths).toBeDefined()

    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await wrapper.find('[data-iris-table-views]').setValue(TABLE_VIEWS_SAVE_ITEM)
    await wrapper.find('[data-iris-views-save]').setValue('Mine')
    await wrapper.find('[data-iris-views-save]').trigger('keydown', { key: 'Enter' })
    const second = JSON.parse(setItem.mock.lastCall![1] as string)
    expect(second).toHaveLength(1)
    expect(second[0].snapshot.multiSort).toEqual([{ key: 'name', direction: 'desc' }])
  })

  it('replays a stored pageSize through the proxy request contract', async () => {
    const onPageChange = vi.fn()
    const query = vi.fn(async () => ({ rows: fullData, total: fullData.length }))
    const seed = JSON.stringify([{ name: 'Wide', snapshot: { pageSize: 3 } }])
    const wrapper = mount(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        proxyConfig: { query, pageSize: 10, onPageChange },
        views: { storage: { getItem: vi.fn(() => seed), setItem: vi.fn() } },
      },
    })
    await flushPromises()
    await selectView(wrapper, 'Wide')
    expect(onPageChange).toHaveBeenCalledWith(1, 3)
    await flushPromises()
    expect(query.mock.lastCall?.[0]?.pageSize).toBe(3)
  })

  it('renders an empty view list from corrupt storage without crashing', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: fullColumns,
        data: fullData,
        views: { storage: { getItem: vi.fn(() => '{broken'), setItem: vi.fn() } },
      },
    })
    expect(wrapper.findAll('[data-iris-table-views] option')).toHaveLength(2)
  })
})
