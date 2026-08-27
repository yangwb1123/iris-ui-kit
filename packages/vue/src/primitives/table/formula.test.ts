import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import { exportCsv } from './exportCsv'
import type { IrisTableColumn, IrisTableExpose, IrisTableFormulaTables } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  price: number
  qty: number
}

const rows: Row[] = [
  { id: 1, name: 'Alpha', price: 10, qty: 3 },
  { id: 2, name: 'Beta', price: 4, qty: 5 },
  { id: 3, name: 'Gamma', price: 100, qty: 1 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'total', title: 'Total', formula: 'price * qty' },
]

function cells(wrapper: ReturnType<typeof mount>, key: string): string[] {
  return wrapper.findAll(`[data-iris-table-cell="${key}"]`).map((c) => c.text())
}

describe('@iris-ui-kit/vue IrisTable formula columns (batch EK, iris 独有)', () => {
  it('renders the computed value (formula wins over dataIndex)', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          {
            key: 'total',
            title: 'Total',
            formula: 'price * qty',
            dataIndex: 'name', // overridden by the formula
          },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(wrapper, 'total')).toEqual(['30', '20', '100'])
    expect(cells(wrapper, 'name')).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('supports leading = and SUM', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'sum', title: 'Sum', formula: '=SUM(price, qty)' },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(wrapper, 'sum')).toEqual(['13', '9', '101'])
  })

  it('unknown field renders empty (fail-closed → null)', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'ghost', title: 'Ghost', formula: 'missing + 1' },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(wrapper, 'ghost')).toEqual(['', '', ''])
  })

  it('formatter receives the computed value (display chain bridge)', () => {
    const seen = new Set<unknown>()
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          {
            key: 'total',
            title: 'Total',
            formula: 'price * qty',
            formatter: (value) => {
              seen.add(value)
              return `$${String(value)}`
            },
          },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(wrapper, 'total')).toEqual(['$30', '$20', '$100'])
    expect(Array.from(seen).sort((a, b) => Number(a) - Number(b))).toEqual([20, 30, 100])
  })

  it('sort orders by the COMPUTED value (asc)', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name', sortable: true },
          { key: 'total', title: 'Total', formula: 'price * qty', sortable: true },
        ],
        data: rows,
        rowKey: 'id',
        defaultSort: { key: 'total', direction: 'asc' },
      },
    })
    expect(cells(wrapper, 'total')).toEqual(['20', '30', '100'])
    expect(cells(wrapper, 'name')).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  it('sort desc reverses the computed order', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty', sortable: true },
        ],
        data: rows,
        rowKey: 'id',
        defaultSort: { key: 'total', direction: 'desc' },
      },
    })
    expect(cells(wrapper, 'total')).toEqual(['100', '30', '20'])
  })

  it('text filtering matches the computed value', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', filters: { total: '30' } },
    })
    expect(cells(wrapper, 'name')).toEqual(['Alpha'])
  })

  it('checked filter sets match the computed value', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        filterValues: { total: ['100'] },
      },
    })
    expect(cells(wrapper, 'name')).toEqual(['Gamma'])
  })

  it('summary row aggregates the computed value through the choke point', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty', summary: 'sum' },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    const summary = wrapper.find('[data-iris-table-row="summary"]')
    expect(summary.exists()).toBe(true)
    expect(summary.find('[data-iris-table-cell="total"]').text()).toBe('150')
  })

  it('CSV export materializes computed values; originals untouched', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>
    const csv = expose.exportCurrentViewCsv()
    const lines = csv.split('\n').map((l) => l.trim())
    expect(lines[0]).toBe('Name,Total')
    expect(lines.slice(1)).toEqual(['Alpha,30', 'Beta,20', 'Gamma,100'])
    // Originals were not mutated (the shadow-row contract).
    expect(rows[0]).toEqual({ id: 1, name: 'Alpha', price: 10, qty: 3 })
  })

  it('the bare serializer stays bare without formula columns (no shadow rows)', () => {
    const plain: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
    expect(exportCsv(rows, plain)).toBe('Name\nAlpha\nBeta\nGamma')
  })

  it('editable + formula is display-only: no dblclick editor, no data-editable attr', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty', editable: true },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    const totalCell = wrapper.find('[data-iris-table-cell="total"]')
    expect(totalCell.attributes('data-editable')).toBeUndefined()
    await totalCell.trigger('dblclick')
    await nextTick()
    expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
  })

  it('click-trigger editing also skips formula columns', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name', editable: true },
          { key: 'total', title: 'Total', formula: 'price * qty', editable: true },
        ],
        data: rows,
        rowKey: 'id',
        editConfig: { trigger: 'click' },
      },
    })
    await wrapper.find('[data-iris-table-cell="total"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
    const nameCell = wrapper.find('[data-iris-table-cell="name"]')
    expect(nameCell.attributes('data-editable')).toBe('')
  })

  it('row mode opens editors for non-formula editable columns only', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name', editable: true },
          { key: 'total', title: 'Total', formula: 'price * qty', editable: true },
        ],
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
      },
    })
    await wrapper.find('[data-iris-table-cell="total"]').trigger('click')
    await nextTick()
    // Row mode never opens a session for the formula column; the name
    // column's editor is the focus fallback of the clicked formula cell.
    const totalCell = wrapper.find('[data-iris-table-cell="total"]')
    expect(totalCell.find('[data-iris-table-editor]').exists()).toBe(false)
    expect(totalCell.attributes('data-editable')).toBeUndefined()
    expect(wrapper.find('[data-iris-table-cell="name"] [data-iris-table-editor]').exists()).toBe(
      true,
    )
  })

  it('clipboard TSV carries the computed value (Ctrl+C shadow rows)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { copy: true },
      },
    })
    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="0"]').trigger('click')
    await wrapper
      .find('[data-iris-cell-row="2"][data-iris-cell-col="1"]')
      .trigger('click', { shiftKey: true })
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'c', ctrlKey: true })
    await nextTick()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('Alpha\t30\nBeta\t20\nGamma\t100')
    Reflect.deleteProperty(navigator, 'clipboard')
  })
})

describe('@iris-ui-kit/vue IrisTable cross-table formulas', () => {
  const crossColumns: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate', sortable: true },
  ]
  const tables: IrisTableFormulaTables = { rates: [{ rate: 1.5 }] }

  it('renders the first external row and keeps missing references fail-closed', () => {
    const wrapper = mount(IrisTable, {
      props: { columns: crossColumns, data: rows, rowKey: 'id', formulaTables: tables },
    })
    expect(cells(wrapper, 'taxed')).toEqual(['15', '6', '150'])

    const missing = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'taxed', title: 'Taxed', formula: 'rates!missing + 1' },
        ],
        data: rows,
        rowKey: 'id',
        formulaTables: tables,
      },
    })
    expect(cells(missing, 'taxed')).toEqual(['', '', ''])
  })

  it('sorts and filters using the external computed value', () => {
    const sorted = mount(IrisTable, {
      props: {
        columns: crossColumns,
        data: rows,
        rowKey: 'id',
        formulaTables: tables,
        defaultSort: { key: 'taxed', direction: 'asc' },
      },
    })
    expect(cells(sorted, 'name')).toEqual(['Beta', 'Alpha', 'Gamma'])

    const filtered = mount(IrisTable, {
      props: {
        columns: crossColumns,
        data: rows,
        rowKey: 'id',
        formulaTables: tables,
        filters: { taxed: '6' },
      },
    })
    expect(cells(filtered, 'name')).toEqual(['Beta'])
  })

  it('updates when the formulaTables identity is replaced', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: crossColumns, data: rows, rowKey: 'id', formulaTables: tables },
    })
    await wrapper.setProps({ formulaTables: { rates: [{ rate: 2 }] } })
    await nextTick()
    expect(cells(wrapper, 'taxed')).toEqual(['20', '8', '200'])
  })

  it('routes summary, CSV and range copy through the external formula resolver', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate', summary: 'sum' },
        ],
        data: rows,
        rowKey: 'id',
        formulaTables: tables,
        cellRange: true,
        clipConfig: { copy: true },
      },
    })
    const tableRef = wrapper.vm as unknown as IrisTableExpose<Row>
    expect(
      wrapper.find('[data-iris-table-row="summary"] [data-iris-table-cell="taxed"]').text(),
    ).toBe('171')
    expect(tableRef.exportCurrentViewCsv()).toBe('Name,Taxed\nAlpha,15\nBeta,6\nGamma,150')
    await wrapper.find('[data-iris-cell-row="0"][data-iris-cell-col="0"]').trigger('click')
    await wrapper
      .find('[data-iris-cell-row="2"][data-iris-cell-col="1"]')
      .trigger('click', { shiftKey: true })
    await wrapper.find('[data-iris-table]').trigger('keydown', { key: 'c', ctrlKey: true })
    await nextTick()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('Alpha\t15\nBeta\t6\nGamma\t150')
  })
})
