import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import { exportCsv } from './exportCsv'
import { exportExcel } from './exportExcel'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortState,
} from './types'

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

describe('IrisTable', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('renders header row + one body row per data row', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.findAll('[data-iris-table-header-row]').length).toBe(1)
    expect(wrapper.findAll('[data-iris-table-row]').length).toBe(3)
  })

  it('renders cell values via dataIndex by default', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    const firstRow = wrapper.findAll('[data-iris-table-row]')[0]!
    expect(firstRow.text()).toContain('Carol')
    expect(firstRow.text()).toContain('31')
  })

  it('renders a localized empty state when data is empty', () => {
    const wrapper = mount(IrisTable, { props: { columns, data: [], rowKey: 'id' }, attachTo: host })
    const empty = wrapper.find('[data-iris-table-row="empty"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toBe('No data')
  })

  it('renders a custom #empty slot when provided', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id' },
      slots: { empty: () => 'Nothing here' },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-row="empty"]').text()).toBe('Nothing here')
  })

  it('renders the localized loading state with aria-busy', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', loading: true },
      attachTo: host,
    })
    const row = wrapper.find('[data-iris-table-row="loading"]')
    expect(row.exists()).toBe(true)
    expect(row.attributes('aria-busy')).toBe('true')
    expect(row.text()).toBe('Loading…')
  })

  it('error state takes precedence over loading and data', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', loading: true, error: true },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-row="error"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-table-row="loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-iris-table-row="1"]').exists()).toBe(false)
  })

  it('renders custom #loading / #error slots', () => {
    const loadingW = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', loading: true },
      slots: { loading: () => 'Fetching' },
      attachTo: host,
    })
    expect(loadingW.find('[data-iris-table-row="loading"]').text()).toBe('Fetching')
    const errorW = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', error: true },
      slots: { error: () => 'Boom' },
      attachTo: host,
    })
    expect(errorW.find('[data-iris-table-row="error"]').text()).toBe('Boom')
  })

  it('clicking a sortable header sorts asc', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    await wrapper.findAll('[role="columnheader"]')[0]!.trigger('click')
    await nextTick()
    const firstCol = wrapper
      .findAll('[data-iris-table-row]')
      .map((row) => row.findAll('[role="cell"]')[0]!.text())
    expect(firstCol).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('clicking the same header again sorts desc', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    const nameHeader = wrapper.findAll('[role="columnheader"]')[0]!
    await nameHeader.trigger('click')
    await nameHeader.trigger('click')
    await nextTick()
    const firstCol = wrapper
      .findAll('[data-iris-table-row]')
      .map((row) => row.findAll('[role="cell"]')[0]!.text())
    expect(firstCol).toEqual(['Carol', 'Bob', 'Alice'])
  })

  it('clicking a third time clears sort', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    const nameHeader = wrapper.findAll('[role="columnheader"]')[0]!
    await nameHeader.trigger('click')
    await nameHeader.trigger('click')
    await nameHeader.trigger('click')
    await nextTick()
    const firstCol = wrapper
      .findAll('[data-iris-table-row]')
      .map((row) => row.findAll('[role="cell"]')[0]!.text())
    expect(firstCol).toEqual(['Carol', 'Alice', 'Bob'])
  })

  it('controlled sort: emits update:sort', async () => {
    const sort = ref<IrisTableSortState | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            sort: sort.value,
            'onUpdate:sort': (s) => (sort.value = s),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    await wrapper.findAll('[role="columnheader"]')[1]!.trigger('click')
    expect(sort.value).toEqual({ key: 'age', direction: 'asc' })
  })

  it('aria-sort reflects current state', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.findAll('[role="columnheader"]')[0]!.attributes('aria-sort')).toBe('none')
    await wrapper.findAll('[role="columnheader"]')[0]!.trigger('click')
    expect(wrapper.findAll('[role="columnheader"]')[0]!.attributes('aria-sort')).toBe('ascending')
  })

  it('renders a checkbox column when selectable=multi', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', selectable: 'multi' },
      attachTo: host,
    })
    expect(wrapper.findAll('[data-iris-checkbox]').length).toBe(4)
  })

  it('selectable=single: clicking a row checkbox emits selection of length 1', async () => {
    const selection = ref<Array<string | number>>([])
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            selectable: 'single',
            selection: selection.value,
            'onUpdate:selection': (s) => (selection.value = s),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    const bodyCheckboxes = wrapper.findAll('[data-iris-table-row] [data-iris-checkbox] input')
    await bodyCheckboxes[1]!.trigger('change')
    expect(selection.value).toEqual([2])
  })

  it('selectable=multi: master checkbox toggles all rows', async () => {
    const selection = ref<Array<string | number>>([])
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            selectable: 'multi',
            selection: selection.value,
            'onUpdate:selection': (s) => (selection.value = s),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    const master = wrapper.findAll('[data-iris-table-header-row] [data-iris-checkbox] input')[0]!
    await master.trigger('change')
    await nextTick()
    expect(selection.value.sort()).toEqual([1, 2, 3])
  })

  it('renders a custom cell via the #cell.<key> slot', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      slots: {
        'cell.name': ({ value }) => h('strong', { class: 'custom' }, String(value)),
      },
      attachTo: host,
    })
    expect(wrapper.findAll('.custom').length).toBe(3)
  })

  it('emits rowClick with the row data and index', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    await wrapper.findAll('[data-iris-table-row]')[1]!.trigger('click')
    const emit = wrapper.emitted('rowClick')
    expect(emit?.[0]?.[0]).toEqual(rows[1])
    expect(emit?.[0]?.[1]).toBe(1)
  })

  // ─── Table Pro v1 features ───

  describe('Pro: column resize', () => {
    it('renders a resize handle per column when resizableColumns is true', () => {
      const wrapper = mount(IrisTable, {
        props: { columns, data: rows, rowKey: 'id', resizableColumns: true },
        attachTo: host,
      })
      expect(wrapper.findAll('[data-iris-table-resize-handle]').length).toBe(columns.length)
    })

    it('does not render handles when resizableColumns is false', () => {
      const wrapper = mount(IrisTable, {
        props: { columns, data: rows, rowKey: 'id' },
        attachTo: host,
      })
      expect(wrapper.findAll('[data-iris-table-resize-handle]').length).toBe(0)
    })

    it('initial columnWidths reflects column.width or default', () => {
      const widths = ref<IrisTableColumnWidths | undefined>(undefined)
      const customCols: IrisTableColumn<Row>[] = [
        { key: 'name', title: 'Name', width: 200 },
        { key: 'age', title: 'Age' },
      ]
      const Harness = defineComponent({
        setup() {
          return () =>
            h(IrisTable, {
              columns: customCols as IrisTableColumn<Record<string, unknown>>[],
              data: rows,
              rowKey: 'id',
              resizableColumns: true,
              'onUpdate:columnWidths': (w: IrisTableColumnWidths) => (widths.value = w),
            })
        },
      })
      const wrapper = mount(Harness, { attachTo: host })
      const headerStyle = wrapper.find('[data-iris-table-header-row]').attributes('style') ?? ''
      // grid-template-columns should include 200px for the name column.
      expect(headerStyle).toContain('200px')
    })

    it('ArrowRight on a resize handle grows the column and emits update:columnWidths', async () => {
      const widths = ref<IrisTableColumnWidths>({})
      const Harness = defineComponent({
        setup() {
          return () =>
            h(IrisTable, {
              columns: columns as IrisTableColumn<Record<string, unknown>>[],
              data: rows,
              rowKey: 'id',
              resizableColumns: true,
              'onUpdate:columnWidths': (w: IrisTableColumnWidths) => (widths.value = w),
            })
        },
      })
      const wrapper = mount(Harness, { attachTo: host })
      const handle = wrapper.findAll('[data-iris-table-resize-handle]')[0]!
      expect(handle.attributes('role')).toBe('separator')
      await handle.trigger('keydown', { key: 'ArrowRight' })
      // 'name' has no width → default 140 → +16 = 156.
      expect(widths.value.name).toBe(156)
    })
  })

  describe('Pro: inline editing', () => {
    const editableCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]

    it('non-editable cell does not respond to double-click', async () => {
      const wrapper = mount(IrisTable, {
        props: { columns, data: rows, rowKey: 'id' },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
    })

    it('double-click opens an editor in editable cells', async () => {
      const wrapper = mount(IrisTable, {
        props: {
          columns: editableCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(true)
    })

    it('Enter commits and emits cellEdit with the new value', async () => {
      const wrapper = mount(IrisTable, {
        props: {
          columns: editableCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      const editor = wrapper.find('[data-iris-table-editor]')
      await editor.setValue('Carol Edited')
      await editor.trigger('keydown', { key: 'Enter' })
      await nextTick()
      const events = wrapper.emitted('cellEdit') as Array<[IrisTableCellEditEvent]> | undefined
      expect(events).toBeDefined()
      expect(events![0]![0].newValue).toBe('Carol Edited')
      expect(events![0]![0].oldValue).toBe('Carol')
      expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
    })

    it('Escape cancels without emitting', async () => {
      const wrapper = mount(IrisTable, {
        props: {
          columns: editableCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      const editor = wrapper.find('[data-iris-table-editor]')
      await editor.setValue('changed')
      await editor.trigger('keydown', { key: 'Escape' })
      await nextTick()
      expect(wrapper.emitted('cellEdit')).toBeUndefined()
      expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
    })

    it('number editor coerces the new value', async () => {
      const wrapper = mount(IrisTable, {
        props: {
          columns: editableCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const ageCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[1]!
      await ageCell.trigger('dblclick')
      await nextTick()
      const editor = wrapper.find('[data-iris-table-editor]')
      await editor.setValue('99')
      await editor.trigger('keydown', { key: 'Enter' })
      await nextTick()
      const events = wrapper.emitted('cellEdit') as Array<[IrisTableCellEditEvent]> | undefined
      expect(events![0]![0].newValue).toBe(99)
      expect(typeof events![0]![0].newValue).toBe('number')
    })

    it('committing an identical value does not emit', async () => {
      const wrapper = mount(IrisTable, {
        props: {
          columns: editableCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      // Default draft value === existing value ("Carol")
      const editor = wrapper.find('[data-iris-table-editor]')
      await editor.trigger('keydown', { key: 'Enter' })
      await nextTick()
      expect(wrapper.emitted('cellEdit')).toBeUndefined()
    })
  })

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
