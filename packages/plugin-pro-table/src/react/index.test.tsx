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
})
