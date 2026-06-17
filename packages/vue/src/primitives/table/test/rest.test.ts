import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from '../Table'
import { exportCsv } from '../exportCsv'
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

describe('Pro: CSV export', () => {
  it('emits CSV with header + body', () => {
    const csv = exportCsv(rows, columns as IrisTableColumn<Row>[])
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Name,Age')
    expect(lines).toContain('Carol,31')
    expect(lines).toContain('Alice,28')
  })

  it('quotes fields containing commas / quotes / newlines', () => {
    const tricky: Row[] = [{ id: 1, name: 'Brown, Charlie', age: 0 } as Row]
    const csv = exportCsv(tricky, columns as IrisTableColumn<Row>[])
    expect(csv).toContain('"Brown, Charlie"')

    const quoted: Row[] = [{ id: 2, name: 'Say "Hi"', age: 0 } as Row]
    const csv2 = exportCsv(quoted, columns as IrisTableColumn<Row>[])
    expect(csv2).toContain('"Say ""Hi"""')
  })

  it('handles empty data — header only', () => {
    const csv = exportCsv([], columns as IrisTableColumn<Row>[])
    expect(csv).toBe('Name,Age')
  })

  it('null / undefined cells become empty fields', () => {
    const sparse = [{ id: 1, name: null, age: undefined } as unknown as Row]
    const csv = exportCsv(sparse, columns as IrisTableColumn<Row>[])
    const lines = csv.split('\n')
    expect(lines[1]).toBe(',')
  })

  describe('Pro: virtual scroll', () => {
    it('renders an IrisVirtualScroll body when virtualScroll prop is set', () => {
      const wrapper = mount(IrisTable, {
        props: {
          columns,
          data: rows,
          rowKey: 'id',
          virtualScroll: { itemHeight: 36, height: 200 },
        },
        attachTo: host,
      })
      expect(wrapper.find('[data-iris-virtual-scroll]').exists()).toBe(true)
      expect(wrapper.attributes('data-virtual')).toBe('')
    })

    it('falls back to plain rowgroup body without virtualScroll prop', () => {
      const wrapper = mount(IrisTable, {
        props: { columns, data: rows, rowKey: 'id' },
        attachTo: host,
      })
      expect(wrapper.find('[data-iris-virtual-scroll]').exists()).toBe(false)
      expect(wrapper.find('[role="rowgroup"]').exists()).toBe(true)
    })

    it('only renders the visible window when virtualized', async () => {
      const many = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `N${i}`, age: i }))
      const wrapper = mount(IrisTable, {
        props: {
          columns,
          data: many,
          rowKey: 'id',
          virtualScroll: { itemHeight: 30, height: 150, buffer: 1 },
        },
        attachTo: host,
      })
      await nextTick()
      // height=150 / itemHeight=30 = 5 visible + 1 buffer ≈ ≤7
      const visible = wrapper.findAll('[data-iris-virtual-item]')
      expect(visible.length).toBeLessThanOrEqual(10)
      expect(visible.length).toBeGreaterThan(0)
    })
  })
})
