import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
  note?: string
  children?: Row[]
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, status: 'active' },
  { id: 2, name: 'Alice', age: 32, status: 'paused' },
  { id: 3, name: 'Bob', age: 28, status: 'active' },
]

/** Two editable columns (text + number) and one plain column. */
const rowCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
  { key: 'note', title: 'Note' }, // not editable — never gets an editor
]

/** Flush microtasks (promise resolutions — floating positioning, async
 * validation) then the Vue render queue. */
async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0))
  await nextTick()
}

/** Body rows only (the summary/loading/error/empty state rows carry named
 * `data-iris-table-row` values; real rows carry an empty value). */
function bodyRows(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll('[data-iris-table-row]')
    .filter((r) => r.attributes('data-iris-table-row') === '')
}

function cellOf(wrapper: ReturnType<typeof mount>, rowIdx: number, key: string) {
  return bodyRows(wrapper)[rowIdx]!.find(`[data-iris-table-cell="${key}"]`)
}

function editorIn(wrapper: ReturnType<typeof mount>, rowIdx: number, key: string) {
  return cellOf(wrapper, rowIdx, key).find('[data-iris-table-editor]')
}

function rowEditing(wrapper: ReturnType<typeof mount>, rowIdx: number): string | null {
  return bodyRows(wrapper)[rowIdx]!.attributes('data-iris-row-editing') ?? null
}

describe('IrisTable batch Z — row edit mode (vxe editConfig.mode="row")', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    vi.restoreAllMocks()
  })

  it('clicking a cell opens every editable column; Enter commits only that column; Escape cancels the row', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: rowCols,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
      },
      attachTo: host,
    })
    // A plain click on any cell of a row that has editable columns starts
    // whole-row editing (the note column itself is not editable).
    await cellOf(wrapper, 0, 'note').trigger('click')
    await nextTick()
    expect(editorIn(wrapper, 0, 'name').exists()).toBe(true)
    expect(editorIn(wrapper, 0, 'age').exists()).toBe(true)
    expect(editorIn(wrapper, 0, 'note').exists()).toBe(false)
    expect(rowEditing(wrapper, 0)).toBe('true')

    // Typing in one editor and pressing Enter commits THAT column only.
    const nameEditor = editorIn(wrapper, 0, 'name')
    await nameEditor.setValue('Charlie2')
    await nameEditor.trigger('keydown', { key: 'Enter' })
    await nextTick()
    const events = wrapper.emitted('cellEdit') as Array<[Record<string, unknown>]> | undefined
    expect(events).toBeDefined()
    expect(events![0]![0].newValue).toBe('Charlie2')
    expect(events![0]![0].column).toMatchObject({ key: 'name' })
    // The committed column's editor closed; the row is still editing with the
    // other column open (per-cell commit, no auto-commit of the rest).
    expect(editorIn(wrapper, 0, 'name').exists()).toBe(false)
    expect(editorIn(wrapper, 0, 'age').exists()).toBe(true)
    expect(rowEditing(wrapper, 0)).toBe('true')
    // Local mode: the parent owns `data` (no internal write-back, React
    // liveData parity applies to proxy mode only) — the committed value
    // travels through the cellEdit payload.
    expect(events![0]![0].newValue).toBe('Charlie2')

    // Escape cancels the WHOLE row: remaining editors close, drafts are
    // discarded, the row leaves edit mode.
    const ageEditor = editorIn(wrapper, 0, 'age')
    await ageEditor.setValue('99')
    await ageEditor.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(editorIn(wrapper, 0, 'age').exists()).toBe(false)
    expect(rowEditing(wrapper, 0)).toBeNull()
    expect((wrapper.emitted('cellEdit') as unknown[]).length).toBe(1)
    expect(cellOf(wrapper, 0, 'age').text()).toContain('25')
  })

  it('clicking another row commits the current row edits and opens the new row', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: rowCols,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
      },
      attachTo: host,
    })
    await cellOf(wrapper, 0, 'name').trigger('click')
    await nextTick()
    const nameEditor = editorIn(wrapper, 0, 'name')
    await nameEditor.setValue('Charlie2')
    // Click a cell of another row: the current row's open editors commit
    // (vxe click-elsewhere-commits parity), then the new row starts editing.
    await cellOf(wrapper, 1, 'note').trigger('click')
    await nextTick()
    const events = wrapper.emitted('cellEdit') as Array<[Record<string, unknown>]> | undefined
    expect(events).toHaveLength(1)
    expect(events![0]![0].newValue).toBe('Charlie2')
    expect(rowEditing(wrapper, 0)).toBeNull()
    expect(rowEditing(wrapper, 1)).toBe('true')
    expect(editorIn(wrapper, 1, 'name').exists()).toBe(true)
    expect(editorIn(wrapper, 1, 'age').exists()).toBe(true)
  })

  it('a sync validation failure keeps the row open with the error visible', async () => {
    const validated: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        validate: (v) => (String(v).length >= 3 ? null : 'too short'),
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: validated,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
      },
      attachTo: host,
    })
    await cellOf(wrapper, 0, 'name').trigger('click')
    await nextTick()
    const nameEditor = editorIn(wrapper, 0, 'name')
    await nameEditor.setValue('x')
    await cellOf(wrapper, 1, 'age').trigger('click')
    await nextTick()
    // The rejected commit blocks the row switch — the error stays visible.
    expect(rowEditing(wrapper, 0)).toBe('true')
    expect(editorIn(wrapper, 0, 'name').exists()).toBe(true)
    expect(cellOf(wrapper, 0, 'name').find('[data-iris-table-editor-error]').text()).toContain(
      'too short',
    )
    expect(rowEditing(wrapper, 1)).toBeNull()
  })

  it('Escape cancels a row whose async commit is pending without writing it back', async () => {
    let resolveValidator!: (v: string | null) => void
    const asyncCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((res) => {
                resolveValidator = res
              }),
          },
        ],
      },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    const wrapper = mount(IrisTable, {
      props: {
        columns: asyncCols,
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
      },
      attachTo: host,
    })
    await cellOf(wrapper, 0, 'age').trigger('click')
    await nextTick()
    // Blur on the async-validated column starts a pending commit; Escape then
    // cancels the WHOLE row while the validation promise is still in flight.
    const nameEditor = editorIn(wrapper, 0, 'name')
    await nameEditor.setValue('ok')
    await nameEditor.trigger('blur')
    const ageEditor = editorIn(wrapper, 0, 'age')
    await ageEditor.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(rowEditing(wrapper, 0)).toBeNull()
    // The validation resolves AFTER the row was cancelled — the session is
    // gone, so the commit is dropped (no write-back).
    resolveValidator(null)
    await settle()
    expect(wrapper.emitted('cellEdit')).toBeUndefined()
  })
})

describe('IrisTable batch Z — contextMenu (vxe contextMenu parity)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    vi.restoreAllMocks()
  })

  function contextMenu(): HTMLElement | null {
    return document.querySelector('[data-iris-table-context-menu]')
  }

  function renderMenuTable(onSelect: ReturnType<typeof vi.fn>) {
    return mount(IrisTable, {
      props: {
        columns: rowCols,
        data: rows,
        rowKey: 'id',
        contextMenu: {
          items: (params) => [
            { key: 'edit', label: 'Edit row' },
            { key: 'delete', label: 'Delete row', disabled: params.rowIndex === 1 },
          ],
          onSelect,
        },
      },
      attachTo: host,
    })
  }

  it('right-clicking a body cell opens the menu at the cursor with the items', async () => {
    const wrapper = renderMenuTable(vi.fn())
    await cellOf(wrapper, 0, 'name').trigger('contextmenu', { clientX: 120, clientY: 80 })
    await settle()
    const menu = contextMenu()
    expect(menu).not.toBeNull()
    // Teleported to document.body (the table root clips overflow).
    expect(menu!.parentElement).toBe(document.body)
    expect(menu!.getAttribute('role')).toBe('menu')
    const items = menu!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(2)
    expect(items[0]!.textContent).toBe('Edit row')
    expect(items[1]!.textContent).toBe('Delete row')
    // Positioned at the cursor via the virtual anchor.
    expect(menu!.style.transform).toContain('translate3d(120px, 80px')
  })

  it('clicking an item fires onSelect with the key + params and closes', async () => {
    const onSelect = vi.fn()
    const wrapper = renderMenuTable(onSelect)
    await cellOf(wrapper, 1, 'name').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await settle()
    const editItem = document.querySelector('[data-iris-table-context-menu-item="edit"]')!
    ;(editItem as HTMLButtonElement).click()
    await nextTick()
    expect(onSelect).toHaveBeenCalledWith(
      'edit',
      expect.objectContaining({ row: rows[1], rowIndex: 1, columnIndex: 0 }),
    )
    expect(onSelect.mock.calls[0]![1].column).toMatchObject({ key: 'name' })
    expect(contextMenu()).toBeNull()
  })

  it('Escape closes the menu', async () => {
    const wrapper = renderMenuTable(vi.fn())
    await cellOf(wrapper, 0, 'name').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await settle()
    expect(contextMenu()).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(contextMenu()).toBeNull()
  })

  it('outside pointer-down closes the menu', async () => {
    const wrapper = renderMenuTable(vi.fn())
    await cellOf(wrapper, 0, 'name').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await settle()
    expect(contextMenu()).not.toBeNull()
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(contextMenu()).toBeNull()
  })

  it('a disabled item is inert: click does not fire onSelect and the menu stays', async () => {
    const onSelect = vi.fn()
    const wrapper = renderMenuTable(onSelect)
    // Row index 1 → the delete item is disabled.
    await cellOf(wrapper, 1, 'note').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await settle()
    const deleteItem = document.querySelector(
      '[data-iris-table-context-menu-item="delete"]',
    ) as HTMLButtonElement
    expect(deleteItem.disabled).toBe(true)
    expect(deleteItem.getAttribute('aria-disabled')).toBe('true')
    deleteItem.click()
    await nextTick()
    expect(onSelect).not.toHaveBeenCalled()
    expect(contextMenu()).not.toBeNull()
  })

  it('right-clicking the header does NOT open the menu', async () => {
    const onSelect = vi.fn()
    const wrapper = renderMenuTable(onSelect)
    await wrapper.find('[data-iris-table-header="name"]').trigger('contextmenu')
    await settle()
    expect(contextMenu()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
