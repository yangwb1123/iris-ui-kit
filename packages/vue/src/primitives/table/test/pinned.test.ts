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
})
