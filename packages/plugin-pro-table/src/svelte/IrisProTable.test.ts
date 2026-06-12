import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { createProTableStore, type ProTableColumn } from '../core'
import IrisProTable from './IrisProTable.svelte'

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

describe('IrisProTable (svelte)', () => {
  it('renders headers and rows', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container } = render(IrisProTable, { props: { store } })
    expect(container.querySelector('[data-iris-pro-table]')).toBeTruthy()
    expect(container.textContent).toContain('Name')
    expect(container.textContent).toContain('Charlie')
  })

  it('sorts on header click', async () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { getByText } = render(IrisProTable, { props: { store } })
    await fireEvent.click(getByText(/Age/))
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

  it('exposes aria-sort and keyboard semantics on sortable headers', async () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container } = render(IrisProTable, { props: { store } })
    const headers = container.querySelectorAll('thead th[scope="col"][data-sortable]')
    const ageHeader = Array.from(headers).find((th) =>
      th.textContent?.includes('Age'),
    ) as HTMLElement
    expect(ageHeader).toBeTruthy()
    // unsorted sortable header advertises 'none'
    expect(ageHeader.getAttribute('aria-sort')).toBe('none')
    expect(ageHeader.getAttribute('tabindex')).toBe('0')
    // Enter toggles sort and updates aria-sort to 'ascending'
    await fireEvent.keyDown(ageHeader, { key: 'Enter' })
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
    expect(ageHeader.getAttribute('aria-sort')).toBe('ascending')
  })

  it('localizes UI strings via the labels prop (defaults to English)', () => {
    const store = createProTableStore<User>({
      columns: [{ ...columns[0]!, filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    const { container } = render(IrisProTable, {
      props: {
        store,
        labels: {
          selectAll: 'Tout sélectionner',
          filterColumn: 'Filtrer {title}',
          selectRow: 'Ligne {key}',
          prev: 'Précédent',
          next: 'Suivant',
        },
      },
    })
    expect(container.querySelector('[aria-label="Tout sélectionner"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Filtrer Name"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Ligne 1"]')).toBeTruthy()
    expect(container.textContent).toContain('Précédent')
    expect(container.textContent).toContain('Suivant')
  })
})
