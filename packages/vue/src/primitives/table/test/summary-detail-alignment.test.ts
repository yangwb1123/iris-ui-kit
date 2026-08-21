import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Carol', age: 31 },
  { id: 2, name: 'Alice', age: 28 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', summary: 'sum' },
]

describe('Vue table summary/detail alignment', () => {
  it('keeps the expand track between seq and selection and matches body tracks', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        selectable: 'multi',
        seq: true,
        renderDetail: (row: Row) => h('span', String(row.name)),
      },
    })
    const summary = wrapper.find('[data-iris-table-row="summary"]')
    const bodyRow = wrapper.find('[data-iris-table-row=""]')
    expect(
      summary
        .findAll('[data-iris-table-cell]')
        .map((cell) => cell.attributes('data-iris-table-cell')),
    ).toEqual(['__seq', '__expand', '__selection', 'name', 'age'])
    expect((summary.element as HTMLElement).style.gridTemplateColumns).toBe(
      (bodyRow.element as HTMLElement).style.gridTemplateColumns,
    )
  })
})
