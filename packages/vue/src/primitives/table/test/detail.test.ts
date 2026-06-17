import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
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

describe('IrisTable expandable detail rows', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  const renderDetail = (row: Record<string, unknown>) =>
    h('div', { class: 'detail-body' }, `Detail for ${String(row.name)}`)

  it('renders a toggle per row + no detail panel by default + aria-expanded="false"', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', renderDetail },
      attachTo: host,
    })
    const toggles = wrapper.findAll('[data-iris-table-expand-toggle]')
    expect(toggles.length).toBe(3)
    toggles.forEach((toggle) => expect(toggle.attributes('aria-expanded')).toBe('false'))
    expect(wrapper.find('[data-iris-table-row-detail]').exists()).toBe(false)
    // A leading blank expand columnheader is emitted.
    expect(wrapper.find('[data-iris-table-header="__expand"]').exists()).toBe(true)
  })

  it('clicking a toggle reveals the detail panel; clicking again hides it', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', renderDetail },
      attachTo: host,
    })
    const firstToggle = wrapper.findAll('[data-iris-table-expand-toggle]')[0]!
    await firstToggle.trigger('click')
    await nextTick()
    const detail = wrapper.find('[data-iris-table-row-detail="1"]')
    expect(detail.exists()).toBe(true)
    expect(detail.find('[data-iris-table-detail-cell]').text()).toBe('Detail for Carol')
    expect(wrapper.findAll('[data-iris-table-expand-toggle]')[0]!.attributes('aria-expanded')).toBe(
      'true',
    )
    // Toggle again hides it.
    await wrapper.findAll('[data-iris-table-expand-toggle]')[0]!.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-iris-table-row-detail="1"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-iris-table-expand-toggle]')[0]!.attributes('aria-expanded')).toBe(
      'false',
    )
  })

  it('rowExpandable gates which rows get a toggle', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        renderDetail,
        rowExpandable: (row: Record<string, unknown>) => row.id !== 2,
      },
      attachTo: host,
    })
    // Rows 1 and 3 expandable, row 2 not → 2 toggles.
    expect(wrapper.findAll('[data-iris-table-expand-toggle]').length).toBe(2)
    // Every body row still has an __expand cell (just empty for non-expandable).
    expect(wrapper.findAll('[data-iris-table-cell="__expand"]').length).toBe(3)
  })

  it('defaultExpandedRowKeys starts expanded + emits expandedRowsChange with string keys on toggle', async () => {
    const changed = ref<Array<string | number> | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            renderDetail,
            defaultExpandedRowKeys: [1],
            onExpandedRowsChange: (keys: Array<string | number>) => (changed.value = keys),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    // Row 1 starts expanded.
    expect(wrapper.find('[data-iris-table-row-detail="1"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-iris-table-expand-toggle]')[0]!.attributes('aria-expanded')).toBe(
      'true',
    )
    // Expanding row 2 emits the string keys.
    await wrapper.findAll('[data-iris-table-expand-toggle]')[1]!.trigger('click')
    await nextTick()
    expect(changed.value).toEqual(['1', '2'])
  })

  it('renders no __expand column when renderDetail is absent', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-header="__expand"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-iris-table-cell="__expand"]').length).toBe(0)
    expect(wrapper.findAll('[data-iris-table-expand-toggle]').length).toBe(0)
  })
})
