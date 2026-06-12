import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { createProTableStore, type ProTableColumn } from '../core'
import { IrisProTable } from './index'

afterEach(cleanup)

interface User extends Record<string, unknown> {
  id: number
  name: string
  age: number
}
const columns: ProTableColumn<User>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
]
const data: User[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
]

describe('IrisProTable (react)', () => {
  it('renders headers and rows', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container, getByText } = render(<IrisProTable store={store} />)
    expect(container.querySelector('[data-iris-pro-table]')).toBeTruthy()
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('Charlie')).toBeTruthy()
  })

  it('sorts when a sortable header is clicked', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { getByText } = render(<IrisProTable store={store} />)
    fireEvent.click(getByText(/Age/))
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
  })

  it('reorderColumns moves column from position A to B', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    // Initial order: name (0), age (1)
    expect(store.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
    store.reorderColumns('age', 'name')
    // After: age (0), name (1)
    expect(store.visibleColumns().map((c) => c.key)).toEqual(['age', 'name'])
  })

  it('shows a filter chip when a filter is active', () => {
    const store = createProTableStore<User>({
      columns: [{ key: 'name', title: 'Name', filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    store.setFilter('name', 'Alice')
    const { container } = render(<IrisProTable store={store} />)
    const bar = container.querySelector('[data-iris-filter-chips]')
    expect(bar).toBeTruthy()
    expect(bar!.textContent).toContain('Name')
    expect(bar!.textContent).toContain('Alice')
  })

  it('clicking × on a chip clears that filter', () => {
    const store = createProTableStore<User>({
      columns: [{ key: 'name', title: 'Name', filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    store.setFilter('name', 'Alice')
    const { container } = render(<IrisProTable store={store} />)
    const clearBtn = container.querySelector(
      '[aria-label="Clear filter Name"]',
    ) as HTMLButtonElement
    expect(clearBtn).toBeTruthy()
    fireEvent.click(clearBtn)
    expect(store.getState().filters['name'] ?? '').toBe('')
  })

  it('localizes UI strings via the labels prop (defaults to English)', () => {
    const store = createProTableStore<User>({
      columns: [{ ...columns[0]!, filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    const { container } = render(
      <IrisProTable
        store={store}
        labels={{
          selectAll: 'Tout sélectionner',
          filterColumn: 'Filtrer {title}',
          selectRow: 'Ligne {key}',
          prev: 'Précédent',
          next: 'Suivant',
        }}
      />,
    )
    expect(container.querySelector('[aria-label="Tout sélectionner"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Filtrer Name"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Ligne 1"]')).toBeTruthy()
    expect(container.textContent).toContain('Précédent')
    expect(container.textContent).toContain('Suivant')
  })
})
