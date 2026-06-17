import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisI18nProvider } from '../../i18n'
import { IrisTable } from '../Table'
import { exportCsv } from '../exportCsv'
import { exportExcel } from '../exportExcel'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortState,
} from '../types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Carol', age: 31 },
  { id: 2, name: 'Alice', age: 28 },
  { id: 3, name: 'Bob', age: 42 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => host.remove())

describe('IrisTable summary / footer row', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  // Fixture ages: 31 + 28 + 42 = 101.
  const SUM_AGE = rows.reduce((n, r) => n + r.age, 0)

  const summaryCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age', align: 'right', summary: 'sum' },
  ]

  it('renders a summary footer row with the column aggregate', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: summaryCols as IrisTableColumn<Record<string, unknown>>[],
        data: rows,
        rowKey: 'id',
      },
      attachTo: host,
    })
    const summary = wrapper.find('[data-iris-table-row="summary"]')
    expect(summary.exists()).toBe(true)
    const ageCell = summary.find('[data-iris-table-cell="age"]')
    expect(ageCell.exists()).toBe(true)
    expect(ageCell.attributes('data-iris-table-summary-cell')).toBe('')
    expect(ageCell.text()).toBe(String(SUM_AGE))
  })

  it('a non-summary column renders a blank cell without the summary marker', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: summaryCols as IrisTableColumn<Record<string, unknown>>[],
        data: rows,
        rowKey: 'id',
      },
      attachTo: host,
    })
    const nameCell = wrapper
      .find('[data-iris-table-row="summary"]')
      .find('[data-iris-table-cell="name"]')
    expect(nameCell.exists()).toBe(true)
    expect(nameCell.text()).toBe('')
    expect(nameCell.attributes('data-iris-table-summary-cell')).toBeUndefined()
  })

  it('renderSummary formats the aggregated value', () => {
    const formattedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'age',
        title: 'Age',
        summary: 'sum',
        renderSummary: (value) => h('span', { class: 'fmt' }, `Σ ${value}`),
      },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: formattedCols as IrisTableColumn<Record<string, unknown>>[],
        data: rows,
        rowKey: 'id',
      },
      attachTo: host,
    })
    const ageCell = wrapper
      .find('[data-iris-table-row="summary"]')
      .find('[data-iris-table-cell="age"]')
    expect(ageCell.find('.fmt').exists()).toBe(true)
    expect(ageCell.text()).toBe(`Σ ${SUM_AGE}`)
  })

  it('renders no summary row when no column declares one', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-row="summary"]').exists()).toBe(false)
  })

  it('renders no summary row when data is empty', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: summaryCols as IrisTableColumn<Record<string, unknown>>[],
        data: [],
        rowKey: 'id',
      },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-row="summary"]').exists()).toBe(false)
  })
})
