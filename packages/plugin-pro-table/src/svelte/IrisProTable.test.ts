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
})
