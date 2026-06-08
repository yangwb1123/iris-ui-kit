import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
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

describe('IrisProTable (solid)', () => {
  it('renders headers and rows', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container, getByText } = render(() => <IrisProTable store={store} />)
    expect(container.querySelector('[data-iris-pro-table]')).toBeTruthy()
    expect(getByText('Charlie')).toBeTruthy()
  })

  it('sorts on header click', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { getByText } = render(() => <IrisProTable store={store} />)
    fireEvent.click(getByText(/Age/))
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
  })

  it('exposes aria-sort and keyboard-operates sortable headers', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { getByText } = render(() => <IrisProTable store={store} />)
    const ageHeader = getByText(/Age/).closest('th') as HTMLTableCellElement
    expect(ageHeader.getAttribute('scope')).toBe('col')
    expect(ageHeader.getAttribute('aria-sort')).toBe('none')
    expect(ageHeader.tabIndex).toBe(0)
    fireEvent.keyDown(ageHeader, { key: 'Enter' })
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
    expect(ageHeader.getAttribute('aria-sort')).toBe('ascending')
  })
})
