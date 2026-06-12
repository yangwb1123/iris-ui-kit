import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisI18nProvider } from '../../i18n'
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

  it('controlled selection renders from the prop (reject → no flip; accept → flips)', async () => {
    // Parent VALIDATES + REJECTS: it records the emit but does NOT write it back,
    // so the controlled prop stays as-is until it explicitly accepts.
    const emitted: Array<Array<string | number>> = []
    const value = ref<Array<string | number>>([])
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns,
            data: rows,
            rowKey: 'id',
            selectable: 'multi',
            selection: value.value,
            'onUpdate:selection': (s: Array<string | number>) => {
              emitted.push(s)
            },
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    const bodyCheckboxes = () =>
      wrapper.findAll<HTMLInputElement>('[data-iris-table-row] [data-iris-checkbox] input')
    // Row index 0 is Carol (id 1).
    await bodyCheckboxes()[0]!.trigger('change')
    // onChange emits the intended next value...
    expect(emitted.at(-1)).toEqual([1])
    // ...but the parent has NOT written it back → the row stays unselected.
    expect((bodyCheckboxes()[0]!.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.findAll('[data-iris-table-row]')[0]!.attributes('data-state')).toBeUndefined()
    // Parent accepts → prop updates → the row reflects it.
    value.value = [1]
    await nextTick()
    expect((bodyCheckboxes()[0]!.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.findAll('[data-iris-table-row]')[0]!.attributes('data-state')).toBe('selected')
    // A further toggle is computed against the prop base [1] → emits [] (deselect).
    await bodyCheckboxes()[0]!.trigger('change')
    expect(emitted.at(-1)).toEqual([])
  })

  it('select-all checkbox input carries a default aria-label of "Select all"', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', selectable: 'multi' },
      attachTo: host,
    })
    const master = wrapper.find('[data-iris-table-header-row] [data-iris-checkbox] input')
    expect(master.exists()).toBe(true)
    expect(master.attributes('aria-label')).toBe('Select all')
  })

  it('select-all checkbox aria-label follows an IrisI18nProvider override', () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            IrisI18nProvider,
            { messages: { 'table.selectAll': 'Alle auswählen' } },
            {
              default: () =>
                h(IrisTable, { columns, data: rows, rowKey: 'id', selectable: 'multi' }),
            },
          ),
      }),
      { attachTo: host },
    )
    const master = wrapper.find('[data-iris-table-header-row] [data-iris-checkbox] input')
    expect(master.attributes('aria-label')).toBe('Alle auswählen')
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

    it('a failing validator blocks commit and surfaces the error', async () => {
      const validatedCols: IrisTableColumn<Row>[] = [
        {
          key: 'name',
          title: 'Name',
          editable: true,
          validate: (value) => (String(value).length < 3 ? 'Too short' : null),
        },
        { key: 'age', title: 'Age', editable: true, editor: 'number' },
      ]
      const wrapper = mount(IrisTable, {
        props: {
          columns: validatedCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      const editor = wrapper.find('[data-iris-table-editor]')
      await editor.setValue('Hi')
      await editor.trigger('keydown', { key: 'Enter' })
      await nextTick()
      // Editor stays open, no emit.
      expect(wrapper.emitted('cellEdit')).toBeUndefined()
      expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(true)
      // aria-invalid set on the input.
      expect(wrapper.find('[data-iris-table-editor]').attributes('aria-invalid')).toBe('true')
      // Error element rendered with role=alert and the message.
      const err = wrapper.find('[data-iris-table-editor-error]')
      expect(err.exists()).toBe(true)
      expect(err.attributes('role')).toBe('alert')
      expect(err.text()).toBe('Too short')
      // aria-describedby points at the error element id.
      expect(wrapper.find('[data-iris-table-editor]').attributes('aria-describedby')).toBe(
        err.attributes('id'),
      )
    })

    it('correcting the value clears the error, emits, and closes the editor', async () => {
      const validatedCols: IrisTableColumn<Row>[] = [
        {
          key: 'name',
          title: 'Name',
          editable: true,
          validate: (value) => (String(value).length < 3 ? 'Too short' : null),
        },
        { key: 'age', title: 'Age', editable: true, editor: 'number' },
      ]
      const wrapper = mount(IrisTable, {
        props: {
          columns: validatedCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      let editor = wrapper.find('[data-iris-table-editor]')
      await editor.setValue('Hi')
      await editor.trigger('keydown', { key: 'Enter' })
      await nextTick()
      expect(wrapper.find('[data-iris-table-editor-error]').exists()).toBe(true)
      // Correct the value and commit again.
      editor = wrapper.find('[data-iris-table-editor]')
      await editor.setValue('Hiya')
      await editor.trigger('keydown', { key: 'Enter' })
      await nextTick()
      const events = wrapper.emitted('cellEdit') as Array<[IrisTableCellEditEvent]> | undefined
      expect(events).toBeDefined()
      expect(events![0]![0].newValue).toBe('Hiya')
      expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
      expect(wrapper.find('[data-iris-table-editor-error]').exists()).toBe(false)
    })

    it('Escape cancels even while the validation error shows', async () => {
      const validatedCols: IrisTableColumn<Row>[] = [
        {
          key: 'name',
          title: 'Name',
          editable: true,
          validate: (value) => (String(value).length < 3 ? 'Too short' : null),
        },
        { key: 'age', title: 'Age', editable: true, editor: 'number' },
      ]
      const wrapper = mount(IrisTable, {
        props: {
          columns: validatedCols as IrisTableColumn<Record<string, unknown>>[],
          data: rows,
          rowKey: 'id',
        },
        attachTo: host,
      })
      const firstCell = wrapper.findAll('[data-iris-table-row]')[0]!.findAll('[role="cell"]')[0]!
      await firstCell.trigger('dblclick')
      await nextTick()
      const editor = wrapper.find('[data-iris-table-editor]')
      await editor.setValue('Hi')
      await editor.trigger('keydown', { key: 'Enter' })
      await nextTick()
      expect(wrapper.find('[data-iris-table-editor-error]').exists()).toBe(true)
      await wrapper.find('[data-iris-table-editor]').trigger('keydown', { key: 'Escape' })
      await nextTick()
      expect(wrapper.emitted('cellEdit')).toBeUndefined()
      expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(false)
      expect(wrapper.find('[data-iris-table-editor-error]').exists()).toBe(false)
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

describe('IrisTable tree rows', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  interface TreeRowData extends Record<string, unknown> {
    id: number
    name: string
    children?: TreeRowData[]
  }
  const treeData: TreeRowData[] = [
    {
      id: 1,
      name: 'Root A',
      children: [
        { id: 11, name: 'Child A1' },
        { id: 12, name: 'Child A2' },
      ],
    },
    { id: 2, name: 'Root B' },
  ]
  const treeCols: IrisTableColumn<TreeRowData>[] = [{ key: 'name', title: 'Name' }]
  const getSubRows = (row: Record<string, unknown>) => (row as TreeRowData).children

  // The tree toggle (▶) renders inside the first cell; strip it to read the name.
  function visibleNames(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper
      .findAll('[data-iris-table-cell="name"]')
      .map((c) => c.text().replace('▶', '').trim())
  }
  // Toggle within each rendered body row's first cell, in row order.
  function toggleAt(wrapper: ReturnType<typeof mount>, rowIndex: number) {
    return wrapper.findAll('[data-iris-table-row]')[rowIndex]!.find('[data-iris-table-tree-toggle]')
  }

  it('renders only roots collapsed, with a toggle on parents only + aria-expanded="false"', () => {
    const wrapper = mount(IrisTable, {
      props: { columns: treeCols, data: treeData, rowKey: 'id', getSubRows },
      attachTo: host,
    })
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Root B'])
    // Root A (has children) → toggle; Root B (leaf) → no toggle.
    expect(toggleAt(wrapper, 0).exists()).toBe(true)
    expect(toggleAt(wrapper, 1).exists()).toBe(false)
    expect(toggleAt(wrapper, 0).attributes('aria-expanded')).toBe('false')
  })

  it('clicking the toggle reveals children, then hides them', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: treeCols, data: treeData, rowKey: 'id', getSubRows },
      attachTo: host,
    })
    await toggleAt(wrapper, 0).trigger('click')
    await nextTick()
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    expect(toggleAt(wrapper, 0).attributes('aria-expanded')).toBe('true')
    await toggleAt(wrapper, 0).trigger('click')
    await nextTick()
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Root B'])
  })

  it('defaultExpandedRowKeys starts a branch open + emits expandedRowsChange on toggle', async () => {
    const changed = ref<Array<string | number> | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns: treeCols,
            data: treeData,
            rowKey: 'id',
            getSubRows,
            defaultExpandedRowKeys: [1],
            onExpandedRowsChange: (keys: Array<string | number>) => (changed.value = keys),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    // Collapse Root A (the first toggle).
    await wrapper.findAll('[data-iris-table-tree-toggle]')[0]!.trigger('click')
    await nextTick()
    expect(changed.value).toEqual([])
  })

  it('child rows have greater paddingLeft than their parent', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: treeCols,
        data: treeData,
        rowKey: 'id',
        getSubRows,
        defaultExpandedRowKeys: [1],
      },
      attachTo: host,
    })
    const indents = wrapper.findAll('[data-iris-table-tree-indent]')
    const pad = (i: number): number =>
      parseInt((indents[i]!.element as HTMLElement).style.paddingLeft || '0', 10)
    // Order: Root A (depth 0), Child A1 (depth 1), Child A2 (depth 1), Root B (depth 0).
    expect(pad(1)).toBeGreaterThan(pad(0))
    expect(pad(2)).toBeGreaterThan(pad(0))
  })

  it('no tree toggle/indent when getSubRows is absent (flat mode unchanged)', () => {
    const wrapper = mount(IrisTable, {
      props: { columns: treeCols, data: treeData, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-tree-toggle]').exists()).toBe(false)
    expect(wrapper.find('[data-iris-table-tree-indent]').exists()).toBe(false)
  })

  it('column sort reorders tree siblings hierarchically (roots and children)', async () => {
    const data: TreeRowData[] = [
      {
        id: 1,
        name: 'Root B',
        children: [
          { id: 12, name: 'Child B2' },
          { id: 11, name: 'Child B1' },
        ],
      },
      { id: 2, name: 'Root A' },
    ]
    const sortableCols: IrisTableColumn<TreeRowData>[] = [
      { key: 'name', title: 'Name', sortable: true },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: sortableCols,
        data,
        rowKey: 'id',
        getSubRows,
        defaultExpandedRowKeys: [1],
      },
      attachTo: host,
    })
    // Unsorted: roots and children keep their source order.
    expect(visibleNames(wrapper)).toEqual(['Root B', 'Child B2', 'Child B1', 'Root A'])
    // Sort asc by name: roots reorder (A before B) AND Root B's children reorder.
    await wrapper.find('[data-iris-table-header="name"]').trigger('click')
    await nextTick()
    expect(visibleNames(wrapper)).toEqual(['Root A', 'Root B', 'Child B1', 'Child B2'])
  })
})

describe('IrisTable multi-level (grouped) headers', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  const groupedCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    {
      key: 'info',
      title: 'Info',
      children: [
        { key: 'age', title: 'Age', sortable: true },
        { key: 'id', title: 'ID' },
      ],
    },
  ]

  it('flat columns render a non-grouped header (unchanged)', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-header-grouped]').exists()).toBe(false)
  })

  it('a column with children renders a grouped header with span attrs', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: groupedCols as IrisTableColumn<Record<string, unknown>>[],
        data: rows,
        rowKey: 'id',
      },
      attachTo: host,
    })
    expect(wrapper.find('[data-iris-table-header-grouped]').exists()).toBe(true)
    // The group cell spans its 2 leaves and is marked as a group.
    const group = wrapper.find('[data-iris-table-header="info"]')
    expect(group.attributes('aria-colspan')).toBe('2')
    expect(group.attributes('data-iris-table-header-group')).toBe('')
    // Leaf header cells exist and the group's leaves are NOT marked as a group.
    const ageLeaf = wrapper.find('[data-iris-table-header="age"]')
    expect(ageLeaf.exists()).toBe(true)
    expect(ageLeaf.attributes('data-iris-table-header-group')).toBeUndefined()
    expect(wrapper.find('[data-iris-table-header="id"]').exists()).toBe(true)
  })

  it('the body renders the LEAF columns (group is header-only)', () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: groupedCols as IrisTableColumn<Record<string, unknown>>[],
        data: rows,
        rowKey: 'id',
      },
      attachTo: host,
    })
    // 3 leaf columns × 3 rows of body cells (name, age, id); no "info" data cell.
    expect(wrapper.findAll('[data-iris-table-cell="age"]').length).toBe(3)
    expect(wrapper.findAll('[data-iris-table-cell="id"]').length).toBe(3)
    expect(wrapper.find('[data-iris-table-cell="info"]').exists()).toBe(false)
  })

  it('a sortable leaf inside a group still sorts', async () => {
    const sort = ref<IrisTableSortState | null>(null)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisTable, {
            columns: groupedCols as IrisTableColumn<Record<string, unknown>>[],
            data: rows,
            rowKey: 'id',
            sort: sort.value,
            'onUpdate:sort': (s) => (sort.value = s),
          })
      },
    })
    const wrapper = mount(Harness, { attachTo: host })
    await wrapper.find('[data-iris-table-header="age"]').trigger('click')
    expect(sort.value).toEqual({ key: 'age', direction: 'asc' })
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
