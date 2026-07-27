import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'Carol' },
  { id: 2, name: 'Alice' },
]
const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', sortable: true }]

describe('IrisTable uncontrolled defaults', () => {
  it('seeds selection from defaultSelection', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', selectable: 'multi', defaultSelection: [2] },
    })
    const selected = wrapper
      .findAll('[data-iris-table-row=""]')
      .find((row) => row.attributes('aria-selected') === 'true')
    expect(selected?.text()).toContain('Alice')
    wrapper.unmount()
  })

  it('seeds sorting from defaultSort', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        defaultSort: { key: 'name', direction: 'asc' },
      },
    })
    expect(wrapper.findAll('[data-iris-table-row]')[0]!.text()).toContain('Alice')
    wrapper.unmount()
  })
})
