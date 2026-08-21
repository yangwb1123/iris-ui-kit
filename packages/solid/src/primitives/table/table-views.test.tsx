import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
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
