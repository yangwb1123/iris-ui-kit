import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

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
