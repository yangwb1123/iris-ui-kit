import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
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
