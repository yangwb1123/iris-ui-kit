import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  amount: number
}

function makeRows(): Row[] {
  return [
    { id: 1, name: 'Alice', amount: 30 },
    { id: 2, name: 'Bob', amount: 25 },
  ]
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'amount', title: 'Amount', editable: true, editor: 'number' },
]

let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => {
  host.remove()
})

function cell(wrapper: ReturnType<typeof mount>, rowIndex: number, key: string) {
  const rows = wrapper
    .findAll('[data-iris-table-row]')
    .filter((row) => row.attributes('data-iris-table-row') === '')
  return rows[rowIndex]!.find(`[data-iris-table-cell="${key}"]`)
}

function editor(wrapper: ReturnType<typeof mount>, rowIndex: number, key: string) {
  return cell(wrapper, rowIndex, key).find('[data-iris-table-editor]')
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('IrisTable row-edit Core bridge', () => {
  it('blocks a row switch on sync editRules and accepts the corrected draft', async () => {
    const onCellEdit = vi.fn()
    const rows = makeRows()
    const validated: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ required: true }],
      },
      columns[1]!,
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: validated,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })

    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    await editor(wrapper, 0, 'name').setValue('')
    await editor(wrapper, 0, 'name').trigger('keydown', { key: 'Enter' })

    expect(cell(wrapper, 0, 'name').find('[data-iris-table-editor-error]').text()).toBe(
      'This field is required',
    )
    await cell(wrapper, 1, 'amount').trigger('click')
    expect(
      wrapper.find('[data-iris-row-editing="true"]').attributes('data-iris-table-row-key'),
    ).toBe('1')
    expect(onCellEdit).not.toHaveBeenCalled()

    await editor(wrapper, 0, 'name').setValue('Alicia')
    await editor(wrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: 'Alicia', rowIndex: 0 }),
    )
  })

  it('shows async rule failures, drops stale drafts, and commits the latest pass', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const onCellEdit = vi.fn()
    const rows = makeRows()
    const asyncColumns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve)
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: asyncColumns,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })

    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    await editor(wrapper, 0, 'name').setValue('first')
    await editor(wrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    expect(resolvers).toHaveLength(1)

    await editor(wrapper, 0, 'name').setValue('second')
    resolvers[0]!(null)
    await settle()
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(cell(wrapper, 0, 'name').find('[data-iris-table-editor-error]').exists()).toBe(false)

    await editor(wrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    expect(resolvers).toHaveLength(2)
    resolvers[1]!('must be accepted')
    await settle()
    expect(cell(wrapper, 0, 'name').find('[data-iris-table-editor-error]').text()).toBe(
      'must be accepted',
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    await editor(wrapper, 0, 'name').setValue('accepted')
    await editor(wrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    expect(resolvers).toHaveLength(3)
    resolvers[2]!(null)
    await settle()
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'accepted' }))
  })

  it('lands a valid switched-away async commit on its original source row', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const onCellEdit = vi.fn()
    const rows = makeRows()
    const asyncColumns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve)
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: asyncColumns,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })

    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    await editor(wrapper, 0, 'name').setValue('Alicia')
    await editor(wrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    await cell(wrapper, 1, 'amount').trigger('click')
    for (const resolve of resolvers) resolve(null)
    await settle()

    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ row: rows[0], rowIndex: 0, newValue: 'Alicia' }),
    )
    expect(
      wrapper.find('[data-iris-table-row-key="2"][data-iris-row-editing="true"]').exists(),
    ).toBe(true)
  })

  it('invalidates switched-away, cancelled, and disposed async sessions', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const onCellEdit = vi.fn()
    const asyncColumns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve)
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: asyncColumns,
        data: makeRows(),
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })

    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    await editor(wrapper, 0, 'name').setValue('stale row')
    await editor(wrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    await cell(wrapper, 1, 'amount').trigger('click')
    expect(
      wrapper.find('[data-iris-row-editing="true"]').attributes('data-iris-table-row-key'),
    ).toBe('2')
    for (const resolve of resolvers) resolve('stale')
    await settle()
    expect(onCellEdit).not.toHaveBeenCalled()

    const cancelResolvers: Array<(message: string | null) => void> = []
    const cancelEdit = vi.fn()
    const cancelWrapper = mount(IrisTable, {
      props: {
        columns: [
          {
            ...asyncColumns[0]!,
            editRules: [
              {
                validator: () =>
                  new Promise<string | null>((resolve) => {
                    cancelResolvers.push(resolve)
                  }),
              },
            ],
          },
          columns[1]!,
        ],
        data: makeRows(),
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit: cancelEdit,
      },
    })
    await cell(cancelWrapper, 0, 'name').trigger('click')
    await nextTick()
    await editor(cancelWrapper, 0, 'name').setValue('cancelled')
    await editor(cancelWrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    await editor(cancelWrapper, 0, 'amount').trigger('keydown', { key: 'Escape' })
    for (const resolve of cancelResolvers) resolve(null)
    await settle()
    expect(cancelEdit).not.toHaveBeenCalled()

    const disposeResolvers: Array<(message: string | null) => void> = []
    const disposeEdit = vi.fn()
    const disposeWrapper = mount(IrisTable, {
      props: {
        columns: [
          {
            key: 'name',
            title: 'Name',
            editable: true,
            editRules: [
              {
                validator: () =>
                  new Promise<string | null>((resolve) => {
                    disposeResolvers.push(resolve)
                  }),
              },
            ],
          },
        ],
        data: makeRows(),
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit: disposeEdit,
      },
    })
    await cell(disposeWrapper, 0, 'name').trigger('click')
    await nextTick()
    await editor(disposeWrapper, 0, 'name').trigger('keydown', { key: 'Enter' })
    disposeWrapper.unmount()
    for (const resolve of disposeResolvers) resolve(null)
    await settle()
    expect(disposeEdit).not.toHaveBeenCalled()
  })

  it('coerces number dataIndex values, keeps source identity, and silences no-ops', async () => {
    const rows = makeRows()
    const onCellEdit = vi.fn()
    const dataIndexColumns: IrisTableColumn<Row>[] = [
      { key: 'nameColumn', dataIndex: 'name', title: 'Name', editable: true },
      {
        key: 'amountColumn',
        dataIndex: 'amount',
        title: 'Amount',
        editable: true,
        editor: 'number',
      },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: dataIndexColumns,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })

    await cell(wrapper, 1, 'nameColumn').trigger('click')
    await nextTick()
    await editor(wrapper, 1, 'nameColumn').setValue('Bobby')
    await editor(wrapper, 1, 'nameColumn').trigger('keydown', { key: 'Enter' })
    await editor(wrapper, 1, 'amountColumn').setValue('42')
    await editor(wrapper, 1, 'amountColumn').trigger('keydown', { key: 'Enter' })

    expect(onCellEdit).toHaveBeenCalledTimes(2)
    expect(onCellEdit.mock.calls[0]![0]).toMatchObject({
      row: rows[1],
      rowIndex: 1,
      newValue: 'Bobby',
    })
    expect(onCellEdit.mock.calls[1]![0]).toMatchObject({ rowIndex: 1, newValue: 42 })
    expect(typeof onCellEdit.mock.calls[1]![0].newValue).toBe('number')
    expect(onCellEdit.mock.calls[1]![0].row).not.toBe(rows[1])
    expect(onCellEdit.mock.calls[1]![0].row).toMatchObject({ id: 2, name: 'Bobby', amount: 25 })

    await cell(wrapper, 1, 'nameColumn').trigger('click')
    await nextTick()
    await editor(wrapper, 1, 'nameColumn').trigger('keydown', { key: 'Enter' })
    await editor(wrapper, 1, 'amountColumn').trigger('keydown', { key: 'Enter' })
    expect(onCellEdit).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale blur after a same-id row session is reopened', async () => {
    const onCellEdit = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: makeRows(),
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit,
      },
      attachTo: host,
    })
    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    const oldEditor = editor(wrapper, 0, 'name')
    await oldEditor.trigger('keydown', { key: 'Enter' })
    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    const reopened = editor(wrapper, 0, 'name')
    await reopened.setValue('Reopened')

    await oldEditor.trigger('blur')
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editor(wrapper, 0, 'name').element).toBe(reopened.element)

    await reopened.trigger('keydown', { key: 'Enter' })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Reopened' }))
  })

  it('writes nested static tree row edits through the Core path-aware update', async () => {
    const onCellEdit = vi.fn()
    const child: Row = { id: 2, name: 'Child', amount: 20 }
    const root: Row = { id: 1, name: 'Root', amount: 10, children: [child] }
    const wrapper = mount(IrisTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', editable: true }],
        data: [root],
        rowKey: 'id',
        getSubRows: (row: Row) => row.children,
        editConfig: { mode: 'row' },
        onCellEdit,
      },
      attachTo: host,
    })
    await wrapper.find('[data-iris-table-tree-toggle]').trigger('click')
    await nextTick()
    await cell(wrapper, 1, 'name').trigger('click')
    await nextTick()
    await editor(wrapper, 1, 'name').setValue('Updated child')
    await editor(wrapper, 1, 'name').trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ row: child, rowIndex: 1, newValue: 'Updated child' }),
    )
    expect(cell(wrapper, 1, 'name').text()).toContain('Updated child')
    expect(root.children?.[0]).toBe(child)
    expect(root.children?.[0]?.name).toBe('Child')
  })

  it('Tab commits one Vue row cell, prevents default, and focuses the next editor', async () => {
    const onCellEdit = vi.fn()
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: makeRows(),
        rowKey: 'id',
        editConfig: { mode: 'row' },
        onCellEdit,
      },
      attachTo: host,
    })
    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    const nameEditor = editor(wrapper, 0, 'name')
    await nameEditor.setValue('Tabbed')
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    nameEditor.element.dispatchEvent(tabEvent)
    await nextTick()

    expect(tabEvent.defaultPrevented).toBe(true)
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Tabbed' }))
    expect(editor(wrapper, 0, 'name').exists()).toBe(false)
    expect(editor(wrapper, 0, 'amount').exists()).toBe(true)
    await nextTick()
    expect(document.activeElement).toBe(editor(wrapper, 0, 'amount').element)
  })

  it('Tab stays on a Vue row editor when synchronous validation rejects', async () => {
    const validated: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        validate: (value) => (value === 'bad' ? 'invalid' : null),
      },
      columns[1]!,
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: validated,
        data: makeRows(),
        rowKey: 'id',
        editConfig: { mode: 'row' },
      },
      attachTo: host,
    })
    await cell(wrapper, 0, 'name').trigger('click')
    await nextTick()
    const nameEditor = editor(wrapper, 0, 'name')
    await nameEditor.setValue('bad')
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    nameEditor.element.dispatchEvent(tabEvent)
    await nextTick()

    expect(tabEvent.defaultPrevented).toBe(true)
    expect(editor(wrapper, 0, 'name').exists()).toBe(true)
    expect(editor(wrapper, 0, 'amount').exists()).toBe(true)
    expect(wrapper.find('[data-iris-table-editor-error]').text()).toBe('invalid')
  })
})
