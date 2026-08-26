import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string }
type TreeRow = Row & { children?: TreeRow[] }

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' },
]

describe('IrisTable expose.removeRows', () => {
  it('marks the root in printable mode for shared print CSS', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: rows, printable: true } })
    expect(wrapper.find('[data-iris-table]').attributes('data-printable')).toBe('true')
  })

  it('exports the current filtered view through the expose handle', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', filters: { name: 'al' } },
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>
    const view = expose.getFilteredData()
    expect(view).toEqual([{ id: 1, name: 'Alpha' }])
    expect(view).not.toBe(expose.getFilteredData())
    expect(expose.exportCurrentViewCsv()).toBe('Name\nAlpha')
  })

  it('removes existing keys once, ignores missing keys, and prunes selection', async () => {
    const onDataChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        selectable: 'multi',
        defaultSelection: [2],
        onDataChange,
      },
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expose.removeRows([2, 999])
    await nextTick()

    expect(wrapper.findAll('[data-iris-table-row=""]').length).toBe(2)
    expect(wrapper.text()).not.toContain('Beta')
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'Alpha' },
      { id: 3, name: 'Gamma' },
    ])
    expect(wrapper.find('[data-iris-table-row-selected="true"]').exists()).toBe(false)
  })

  it('does not emit or mutate when every key is missing', async () => {
    const onDataChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', onDataChange },
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>

    expose.removeRows([404, 405])
    await nextTick()
    expect(wrapper.findAll('[data-iris-table-row=""]').length).toBe(3)
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('removes a static tree child through the shared rows transaction', async () => {
    const treeData: TreeRow[] = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }]
    const onDataChange = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: treeData,
        rowKey: 'id',
        getSubRows: (row) => row.children,
        tableRef: undefined,
        onDataChange,
      },
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<TreeRow>

    expose.removeRows([2])
    await nextTick()

    expect(onDataChange).toHaveBeenCalledWith([{ id: 1, name: 'Root', children: [] }])
    expect(treeData[0]?.children).toHaveLength(1)
  })
})
