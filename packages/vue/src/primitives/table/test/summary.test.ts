import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
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

  it('preserves null and zero aggregate semantics and passes rows to custom callbacks', () => {
    const edgeRows = [
      { id: 10, name: 'Null', age: null },
      { id: 11, name: 'Zero', age: 0 },
      { id: 12, name: 'String', age: '2' },
    ] as unknown as Row[]
    const renderSummary = vi.fn((value: number, sourceRows: Row[]) =>
      h('span', { class: 'edge-summary' }, `Σ${value}:${sourceRows.length}`),
    )
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age', summary: 'sum', renderSummary },
        ] as IrisTableColumn<Record<string, unknown>>[],
        data: edgeRows,
        rowKey: 'id',
      },
      attachTo: host,
    })
    expect(
      wrapper.find('[data-iris-table-row="summary"] [data-iris-table-cell="age"]').text(),
    ).toBe('Σ2:3')
    expect(renderSummary).toHaveBeenCalledWith(2, edgeRows)
  })

  it('uses the remote page rows for summary values, including zero', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 90, name: 'Remote', age: 0 }], total: 10 }))
    const wrapper = mount(IrisTable, {
      props: {
        columns: summaryCols as IrisTableColumn<Record<string, unknown>>[],
        data: [],
        rowKey: 'id',
        proxyConfig: { query },
      },
      attachTo: host,
    })
    await nextTick()
    await nextTick()
    expect(
      wrapper.find('[data-iris-table-row="summary"] [data-iris-table-cell="age"]').text(),
    ).toBe('0')
    expect(query).toHaveBeenCalledTimes(1)
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
