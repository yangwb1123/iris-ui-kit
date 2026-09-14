import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
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

let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => host.remove())

describe('IrisTable pinned columns', () => {
  const pinnedCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', width: 100, pinned: 'left' },
    { key: 'age', title: 'Age', width: 80 },
  ]

  it('makes a pinned header + cell sticky with an edge offset', () => {
    const wrapper = mount(IrisTable, {
      props: { columns: pinnedCols, data: rows, rowKey: 'id' },
    })
    const nameHeader = wrapper.find('[data-iris-table-header="name"]')
    expect(nameHeader.attributes('data-iris-table-pinned')).toBe('left')
    expect((nameHeader.element as HTMLElement).style.position).toBe('sticky')
    expect((nameHeader.element as HTMLElement).style.left).toBe('0px')
    const nameCell = wrapper.find('[data-iris-table-cell="name"]')
    expect((nameCell.element as HTMLElement).style.position).toBe('sticky')
  })

  it('offsets a left-pinned column by the selection column width', () => {
    const wrapper = mount(IrisTable, {
      props: { columns: pinnedCols, data: rows, rowKey: 'id', selectable: 'multi' },
    })
    const nameHeader = wrapper.find('[data-iris-table-header="name"]')
    expect((nameHeader.element as HTMLElement).style.left).toBe('40px')
  })

  it('keeps the virtualized header in the body horizontal scroll viewport', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name', width: 100, pinned: 'left' },
          { key: 'age', title: 'Age', width: 500 },
          { key: 'status', title: 'Status', width: 500, pinned: 'right' },
        ],
        data: rows,
        rowKey: 'id',
        columnVirtualization: true,
        virtualScroll: { itemHeight: 40, height: 100 },
      },
    })
    const root = wrapper.find('[data-iris-table]').element as HTMLElement
    const viewport = wrapper.find('[data-iris-virtual-scroll]').element as HTMLElement
    const header = wrapper.find('[data-iris-table-header-row]').element
    const cell = wrapper.find('[data-iris-table-cell="name"]').element

    expect(header.closest('[data-iris-virtual-scroll]')).toBe(viewport)
    expect(cell.closest('[data-iris-virtual-scroll]')).toBe(viewport)
    expect(root.style.overflow).toBe('hidden')
    expect(viewport.style.overflow).toBe('auto')

    viewport.scrollLeft = 120
    viewport.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(root.scrollLeft).toBe(0)
    expect((cell as HTMLElement).style.position).toBe('sticky')
  })
})
