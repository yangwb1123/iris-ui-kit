import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose } from './types'

enableAutoUnmount(afterEach)

type Row = Record<string, unknown> & { id: number; name: string; age: number }

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
]

const makeRows = (): Row[] => [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

function cell(wrapper: ReturnType<typeof mount>, id: number, key: string) {
  return wrapper.find(`[data-iris-table-row-key="${id}"] [data-iris-table-cell="${key}"]`)
}

function value(wrapper: ReturnType<typeof mount>, id: number, key: string): string {
  return cell(wrapper, id, key).text()
}

function root(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('[data-iris-table]')
}

function exposed(wrapper: ReturnType<typeof mount>): IrisTableExpose<Row> {
  return wrapper.vm as unknown as IrisTableExpose<Row>
}

async function edit(
  wrapper: ReturnType<typeof mount>,
  id: number,
  key: string,
  next: string,
): Promise<void> {
  await cell(wrapper, id, key).trigger('dblclick')
  const editor = wrapper.find('[data-iris-table-editor]')
  await editor.setValue(next)
  await editor.trigger('keydown', { key: 'Enter' })
  await nextTick()
}

async function shortcut(
  wrapper: ReturnType<typeof mount>,
  key: string,
  modifiers: Record<string, boolean> = { ctrlKey: true },
): Promise<void> {
  await root(wrapper).trigger('keydown', { key, ...modifiers })
  await nextTick()
}

let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => {
  host.remove()
  Reflect.deleteProperty(navigator, 'clipboard')
})

function mountTable(props: Record<string, unknown>) {
  return mount(IrisTable, { props, attachTo: host })
}

describe('IrisTable built-in undo/redo', () => {
  it('is default-off and does not install toolbar controls or intercept shortcuts', async () => {
    const wrapper = mountTable({ columns, data: makeRows(), rowKey: 'id' })
    await edit(wrapper, 1, 'name', 'Renamed')
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('Renamed')
    expect(wrapper.find('[data-iris-table-undo]').exists()).toBe(false)
    expect(wrapper.find('[data-iris-table-redo]').exists()).toBe(false)
  })

  it('undoes and redoes cell edits through Ctrl/Cmd shortcuts and toolbar state', async () => {
    const wrapper = mountTable({ columns, data: makeRows(), rowKey: 'id', undo: true })
    const undo = () => wrapper.find('[data-iris-table-undo]')
    const redo = () => wrapper.find('[data-iris-table-redo]')
    expect(undo().attributes('disabled')).toBeDefined()
    expect(redo().attributes('disabled')).toBeDefined()
    await edit(wrapper, 1, 'name', 'Renamed')
    expect(value(wrapper, 1, 'name')).toContain('Renamed')
    expect(undo().attributes('disabled')).toBeUndefined()
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('Charlie')
    expect(redo().attributes('disabled')).toBeUndefined()
    await shortcut(wrapper, 'y')
    expect(value(wrapper, 1, 'name')).toContain('Renamed')
    await shortcut(wrapper, 'z')
    await shortcut(wrapper, 'z', { ctrlKey: true, shiftKey: true })
    expect(value(wrapper, 1, 'name')).toContain('Renamed')
  })

  it('keeps consecutive edits separate and ignores shortcuts while editing or outside', async () => {
    const wrapper = mountTable({ columns, data: makeRows(), rowKey: 'id', undo: true })
    await edit(wrapper, 1, 'name', 'First')
    await edit(wrapper, 2, 'name', 'Second')
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('First')
    expect(value(wrapper, 2, 'name')).toContain('Alice')
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('Charlie')

    await cell(wrapper, 1, 'name').trigger('dblclick')
    const editor = wrapper.find('[data-iris-table-editor]')
    await editor.setValue('Draft')
    await shortcut(wrapper, 'z')
    expect(wrapper.find('[data-iris-table-editor]').exists()).toBe(true)
    await editor.trigger('keydown', { key: 'Escape' })
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))
    await nextTick()
    expect(value(wrapper, 1, 'name')).toContain('Charlie')
    outside.remove()
  })

  it('records row-list operations and replays them through onDataChange', async () => {
    const onDataChange = vi.fn()
    const wrapper = mountTable({
      columns,
      data: makeRows(),
      rowKey: 'id',
      undo: true,
      onDataChange,
    })
    exposed(wrapper).removeRows([2])
    await nextTick()
    expect(wrapper.find('[data-iris-table-row-key="2"]').exists()).toBe(false)
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 2, 'name')).toContain('Alice')
    exposed(wrapper).loadData(makeRows().slice(0, 1))
    await nextTick()
    expect(wrapper.find('[data-iris-table-row-key="2"]').exists()).toBe(false)
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 2, 'name')).toContain('Alice')
    await shortcut(wrapper, 'y')
    expect(wrapper.find('[data-iris-table-row-key="2"]').exists()).toBe(false)
    expect(onDataChange).toHaveBeenCalledTimes(5)
  })

  it('keeps row-mode commits as separate snapshots and writes local rows back', async () => {
    const wrapper = mountTable({
      columns,
      data: makeRows(),
      rowKey: 'id',
      undo: true,
      editConfig: { mode: 'row' },
    })
    await cell(wrapper, 1, 'name').trigger('click')
    const editors = wrapper.findAll('[data-iris-table-editor]')
    await editors[0]!.setValue('First')
    await editors[1]!.setValue('99')
    await cell(wrapper, 2, 'name').trigger('click')
    await nextTick()
    await wrapper
      .find('[data-iris-table-row-key="2"] [data-iris-table-editor]')
      .trigger('keydown', { key: 'Escape' })
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('First')
    expect(value(wrapper, 1, 'age')).toContain('25')
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('Charlie')
  })

  it('prunes selection when redo restores a snapshot without selected rows', async () => {
    const wrapper = mountTable({
      columns,
      data: makeRows(),
      rowKey: 'id',
      selectable: 'multi',
      undo: true,
    })
    const checkboxes = wrapper.findAll('[data-iris-table-row] [data-iris-checkbox] input')
    await checkboxes[1]!.trigger('change')
    await checkboxes[2]!.trigger('change')
    exposed(wrapper).loadData([makeRows()[0]!])
    await nextTick()
    await shortcut(wrapper, 'z')
    expect(wrapper.findAll('input[type="checkbox"]:checked')).toHaveLength(2)
    await shortcut(wrapper, 'y')
    expect(wrapper.findAll('input[type="checkbox"]:checked')).toHaveLength(0)
  })

  it('pastes a TSV range as one undoable mutation, including dataIndex mapping', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn(async () => 'Pasted\t77') },
    })
    const onDataChange = vi.fn()
    const wrapper = mountTable({
      columns: [
        { key: 'nameCol', dataIndex: 'name', title: 'Name' },
        { key: 'ageCol', dataIndex: 'age', title: 'Age' },
      ],
      data: makeRows(),
      rowKey: 'id',
      cellRange: true,
      clipConfig: { paste: true },
      undo: true,
      onDataChange,
    })
    await cell(wrapper, 1, 'nameCol').trigger('click')
    await shortcut(wrapper, 'v')
    await flushPromises()
    expect(value(wrapper, 1, 'nameCol')).toContain('Pasted')
    expect(value(wrapper, 1, 'ageCol')).toContain('77')
    const last = onDataChange.mock.calls.at(-1)![0] as Row[]
    expect(last[0]!.name).toBe('Pasted')
    expect(last[0]!.age).toBe('77')
    expect('nameCol' in last[0]!).toBe(false)
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'nameCol')).toContain('Charlie')
    expect(value(wrapper, 1, 'ageCol')).toContain('25')
  })

  it('drops a pending paste after unmount or disabling the clipboard feature', async () => {
    let resolveRead!: (text: string) => void
    const readText = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve
        }),
    )
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    })
    const onDataChange = vi.fn()
    const make = () =>
      mountTable({
        columns,
        data: makeRows(),
        rowKey: 'id',
        cellRange: true,
        clipConfig: { paste: true },
        undo: true,
        onDataChange,
      })

    const first = make()
    await cell(first, 1, 'name').trigger('click')
    await shortcut(first, 'v')
    first.unmount()
    resolveRead('Ghost\t99')
    await flushPromises()
    expect(onDataChange).not.toHaveBeenCalled()

    const second = make()
    await cell(second, 1, 'name').trigger('click')
    await shortcut(second, 'v')
    await second.setProps({ clipConfig: undefined })
    resolveRead('Ghost\t99')
    await flushPromises()
    expect(onDataChange).not.toHaveBeenCalled()
    expect(value(second, 1, 'name')).toContain('Charlie')
  })

  it('re-baselines an untouched stack when parent data changes', async () => {
    const wrapper = mountTable({ columns, data: makeRows(), rowKey: 'id', undo: true })
    const newer = makeRows().map((row) =>
      row.id === 1 ? { ...row, name: 'Baselined' } : row,
    ) as Row[]
    await wrapper.setProps({ data: newer })
    await nextTick()
    await edit(wrapper, 1, 'name', 'Edited')
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('Baselined')
  })

  it('replays edits through the proxy live rows', async () => {
    const query = vi.fn(async () => ({ rows: makeRows(), total: 3 }))
    const wrapper = mountTable({
      columns,
      data: [],
      rowKey: 'id',
      undo: true,
      proxyConfig: { query },
    })
    await flushPromises()
    await nextTick()
    await edit(wrapper, 1, 'name', 'Renamed')
    await shortcut(wrapper, 'z')
    expect(value(wrapper, 1, 'name')).toContain('Charlie')
    await shortcut(wrapper, 'y')
    expect(value(wrapper, 1, 'name')).toContain('Renamed')
  })
})
