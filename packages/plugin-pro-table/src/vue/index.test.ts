import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createProTableStore, type ProTableColumn } from '../core'
import { IrisProTable } from './index'

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

describe('IrisProTable (vue)', () => {
  it('renders headers and rows', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const wrapper = mount(IrisProTable, { props: { store } })
    expect(wrapper.element.querySelector('[data-iris-pro-table]') ?? wrapper.element).toBeTruthy()
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('Charlie')
    wrapper.unmount()
  })

  it('sorts on header click', async () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const wrapper = mount(IrisProTable, { props: { store } })
    const ageHeader = wrapper.findAll('th').find((th) => th.text().includes('Age'))
    await ageHeader?.trigger('click')
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
    wrapper.unmount()
  })
})
