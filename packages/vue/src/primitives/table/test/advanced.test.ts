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

describe('exportExcel', () => {
  it('serializes rows to SpreadsheetML, typing numbers', () => {
    const xml = exportExcel(rows, columns)
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>')
    expect(xml).toContain('<Data ss:Type="String">Name</Data>')
    expect(xml).toContain('<Data ss:Type="String">Carol</Data>')
    expect(xml).toContain('<Data ss:Type="Number">31</Data>')
  })
})

describe('IrisTable column virtualization', () => {
  const wideCols: IrisTableColumn[] = Array.from({ length: 8 }, (_, i) => ({
    key: `c${i}`,
    title: `C${i}`,
    width: 120,
  }))
  const wideRows = [
    Object.fromEntries([['id', 1], ...wideCols.map((c) => [c.key, `${c.key}-v`])]),
  ] as Record<string, unknown>[]

  it('renders every column when disabled (default)', () => {
    const w = mount(IrisTable, { props: { columns: wideCols, data: wideRows, rowKey: 'id' } })
    expect(w.findAll('[data-iris-table-header]').length).toBe(8)
  })

  it('renders only a window of columns when enabled', () => {
    const w = mount(IrisTable, {
      props: { columns: wideCols, data: wideRows, rowKey: 'id', columnVirtualization: true },
    })
    const n = w.findAll('[data-iris-table-header]').length
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(8)
    expect(w.find('[data-column-virtualized="true"]').exists()).toBe(true)
  })

  it('always renders pinned columns even when out of the window', () => {
    const cols = wideCols.map((c, i) => (i === 7 ? { ...c, pinned: 'right' as const } : c))
    const w = mount(IrisTable, {
      props: { columns: cols, data: wideRows, rowKey: 'id', columnVirtualization: true },
    })
    expect(w.find('[data-iris-table-header="c7"]').exists()).toBe(true)
  })
})

describe('IrisTable grid keyboard navigation', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  // Query a data cell by its grid coords (the live DOM, since we attachTo host).
  function cellAt(r: number, c: number): HTMLElement | null {
    return document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`)
  }

  it('is off by default: role=table, no grid coords', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.find('[role=grid]').exists()).toBe(false)
    expect(wrapper.find('[role=table]').exists()).toBe(true)
    expect(cellAt(0, 0)).toBeNull()
  })

  it('opt-in makes the table a grid with roving cell tabindex', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', keyboardNavigation: true },
      attachTo: host,
    })
    expect(wrapper.find('[role=grid]').exists()).toBe(true)
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('0') // first cell focusable
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowRight / ArrowDown move the focused cell and roving tabindex', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', keyboardNavigation: true },
      attachTo: host,
    })
    cellAt(0, 0)!.focus()
    // Dispatch ON THE CELL so the event bubbles to the root with the cell as
    // target (firing on the root makes target=root, which has no data-grid-row).
    await wrapper.find('[data-grid-row="0"][data-grid-col="0"]').trigger('keydown', {
      key: 'ArrowRight',
    })
    expect(document.activeElement).toBe(cellAt(0, 1))
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('0')
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('-1')
    await wrapper.find('[data-grid-row="0"][data-grid-col="1"]').trigger('keydown', {
      key: 'ArrowDown',
    })
    expect(document.activeElement).toBe(cellAt(1, 1))
  })

  it('does not move past an edge (no wrap)', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', keyboardNavigation: true },
      attachTo: host,
    })
    cellAt(0, 0)!.focus()
    await wrapper.find('[data-grid-row="0"][data-grid-col="0"]').trigger('keydown', {
      key: 'ArrowLeft',
    })
    expect(document.activeElement).toBe(cellAt(0, 0)) // stayed
  })

  it('End jumps to the last column of the row', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', keyboardNavigation: true },
      attachTo: host,
    })
    cellAt(0, 0)!.focus()
    await wrapper.find('[data-grid-row="0"][data-grid-col="0"]').trigger('keydown', {
      key: 'End',
    })
    expect(document.activeElement).toBe(cellAt(0, 1)) // 2 columns → last is col 1
  })
})
