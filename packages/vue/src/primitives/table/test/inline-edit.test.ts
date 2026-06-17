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
