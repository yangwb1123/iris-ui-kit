import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
]

let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => host.remove())

/** Flush microtasks (floating positioning, async validation) then the render queue. */
async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0))
  await nextTick()
}

function exposeOf(wrapper: ReturnType<typeof mount>): IrisTableExpose<Row> {
  return wrapper.vm as unknown as IrisTableExpose<Row>
}

function cellOf(wrapper: ReturnType<typeof mount>, rowKey: string | number, key: string) {
  return wrapper.find(`[data-iris-table-row-key="${rowKey}"] [data-iris-table-cell="${key}"]`)
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

/** Double-click a cell, type a value, commit with Enter (cell edit mode). */
async function editCell(
  wrapper: ReturnType<typeof mount>,
  rowKey: string | number,
  colKey: string,
  value: string,
): Promise<void> {
  await cellOf(wrapper, rowKey, colKey).trigger('dblclick')
  await nextTick()
  const input = editor()
  expect(input).not.toBeNull()
  input!.value = value
  await input!.dispatchEvent(new Event('input'))
  await nextTick()
  await input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await nextTick()
}

function auditTrigger(): HTMLElement | null {
  return document.querySelector('[data-iris-audit-trigger]')
}

async function openPanel(): Promise<HTMLElement> {
  auditTrigger()!.click()
  await settle()
  const panel = document.querySelector('[data-iris-audit-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return panel
}

function entries(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-audit-entry]'))
}

// ── Audit log (iris 独有, batch EN — vue sync of react batch AT) ──────────
describe('IrisTable audit log', () => {
  it('an edit commit records ONE entry (type edit + rowKey + column + old→new)', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: editableCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    await editCell(wrapper, 1, 'name', 'Renamed')
    const log = exposeOf(wrapper).getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      type: 'edit',
      rowKey: 1,
      column: 'name',
      oldValue: 'Charlie',
      newValue: 'Renamed',
    })
    expect(log[0]!.seq).toBe(1)
  })

  it('consecutive edits never invert — each entry keeps its own old→new (F1 guard)', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: editableCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    await editCell(wrapper, 1, 'name', 'Renamed')
    await editCell(wrapper, 2, 'age', '33')
    const log = exposeOf(wrapper).getAuditLog()
    expect(log).toHaveLength(2)
    // First commit: name edit with the TRUE original value.
    expect(log[1]).toMatchObject({ seq: 1, type: 'edit', rowKey: 1, column: 'name' })
    expect(log[1]!.oldValue).toBe('Charlie')
    expect(log[1]!.newValue).toBe('Renamed')
    // Second commit: age edit — a stale-base diff would flip this pair.
    expect(log[0]).toMatchObject({ seq: 2, type: 'edit', rowKey: 2, column: 'age' })
    expect(log[0]!.oldValue).toBe(32)
    expect(log[0]!.newValue).toBe(33)
  })

  it('row-mode edits record ONE entry per committed cell', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns: editableCols,
        data: rows,
        rowKey: 'id',
        auditLog: true,
        editConfig: { mode: 'row' },
      },
      attachTo: host,
    })
    await cellOf(wrapper, 1, 'name').trigger('click')
    await nextTick()
    const nameEditor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    nameEditor.value = 'Renamed'
    await nameEditor.dispatchEvent(new Event('input'))
    await nextTick()
    await nameEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    const ageEditorEl = cellOf(wrapper, 1, 'age').find('[data-iris-table-editor]').element
    const ageEditor = ageEditorEl as HTMLInputElement
    ageEditor.value = '26'
    await ageEditor.dispatchEvent(new Event('input'))
    await nextTick()
    await ageEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    const log = exposeOf(wrapper).getAuditLog()
    expect(log).toHaveLength(2)
    expect(log[1]).toMatchObject({ type: 'edit', rowKey: 1, column: 'name' })
    expect(log[0]).toMatchObject({ type: 'edit', rowKey: 1, column: 'age' })
    expect(log[0]!.oldValue).toBe(25)
    expect(log[0]!.newValue).toBe(26)
  })

  it('removeRows records type remove with the removed row key', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: baseCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    exposeOf(wrapper).removeRows([2])
    await nextTick()
    const log = exposeOf(wrapper).getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ type: 'remove', rowKey: 2 })
    expect(log[0]!.column).toBeUndefined()
  })

  it('loadData records a structural diff entry (type edit, react commitRowList parity)', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: baseCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    exposeOf(wrapper).loadData([...rows, { id: 4, name: 'Dora', age: 41 }])
    await nextTick()
    const log = exposeOf(wrapper).getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ type: 'edit', rowKey: 4 })
    expect(log[0]!.column).toBeUndefined()
  })

  it('proxy + loadData re-baseline — a later removeRows diffs against the new list', async () => {
    const d = { resolve: (_v: { rows: Row[]; total: number }) => {} }
    const query = vi.fn(
      () =>
        new Promise<{ rows: Row[]; total: number }>((resolve) => {
          d.resolve = resolve
        }),
    )
    const wrapper = mount(IrisTable, {
      props: {
        columns: baseCols,
        data: [],
        rowKey: 'id',
        auditLog: true,
        proxyConfig: { query },
      },
      attachTo: host,
    })
    await nextTick()
    d.resolve({ rows: [rows[0]!, rows[1]!, rows[2]!], total: 3 })
    await settle()
    // loadData replaces the proxy live list (records 'edit'), then
    // removeRows must diff against the REPLACED list — the removed key is
    // the one from the loaded rows, never a stale base.
    exposeOf(wrapper).loadData([rows[0]!, rows[2]!, { id: 4, name: 'Dora', age: 41 }])
    await nextTick()
    exposeOf(wrapper).removeRows([4])
    await nextTick()
    const log = exposeOf(wrapper).getAuditLog()
    expect(log).toHaveLength(2)
    expect(log[0]).toMatchObject({ type: 'remove', rowKey: 4 })
    expect(log[1]).toMatchObject({ type: 'edit' })
  })

  it('the toolbar panel lists entries newest-first with type/rowKey/old→new', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: editableCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    await editCell(wrapper, 1, 'name', 'Renamed')
    await editCell(wrapper, 2, 'age', '33')
    const panel = await openPanel()
    const items = entries()
    expect(items).toHaveLength(2)
    // Newest first: the age edit is #2 on top.
    expect(items[0]!.querySelector('[data-iris-audit-seq]')!.textContent).toBe('#2')
    expect(items[0]!.querySelector('[data-iris-audit-type]')!.textContent).toBe('edit')
    expect(items[0]!.querySelector('[data-iris-audit-rowkey]')!.textContent).toBe('2')
    expect(items[0]!.querySelector('[data-iris-audit-cell]')!.textContent).toContain('age')
    expect(items[0]!.querySelector('[data-iris-audit-old]')!.textContent).toBe('32')
    expect(items[0]!.querySelector('[data-iris-audit-new]')!.textContent).toBe('33')
    expect(items[1]!.querySelector('[data-iris-audit-seq]')!.textContent).toBe('#1')
    expect(panel.querySelector('[data-iris-audit-empty]')).toBeNull()
    // In-place refresh: an edit while the panel stays open appends #3
    // WITHOUT re-opening (the panel subscribes to the controller).
    await editCell(wrapper, 3, 'age', '29')
    await settle()
    expect(entries()).toHaveLength(3)
    expect(entries()[0]!.querySelector('[data-iris-audit-seq]')!.textContent).toBe('#3')
  })

  it('the panel clear button empties the trail and shows the empty state', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: editableCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    await editCell(wrapper, 1, 'name', 'Renamed')
    const panel = await openPanel()
    expect(entries()).toHaveLength(1)
    ;(panel.querySelector('[data-iris-audit-clear]') as HTMLElement).click()
    await settle()
    expect(entries()).toHaveLength(0)
    expect(panel.querySelector('[data-iris-audit-empty]')).not.toBeNull()
    expect(exposeOf(wrapper).getAuditLog()).toHaveLength(0)
  })

  it('clearAuditLog via the handle wipes entries; seq never resets', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: editableCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    await editCell(wrapper, 1, 'name', 'Renamed')
    exposeOf(wrapper).clearAuditLog()
    expect(exposeOf(wrapper).getAuditLog()).toHaveLength(0)
    // Audit integrity: a cleared trail resumes at a HIGHER seq.
    await editCell(wrapper, 1, 'age', '26')
    expect(exposeOf(wrapper).getAuditLog()[0]!.seq).toBe(2)
  })

  it('Esc / outside pointer-down close the panel; the trigger toggles', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: editableCols, data: rows, rowKey: 'id', auditLog: true },
      attachTo: host,
    })
    await editCell(wrapper, 1, 'name', 'Renamed')
    await openPanel()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(document.querySelector('[data-iris-audit-panel]')).toBeNull()
    auditTrigger()!.click()
    await settle()
    expect(document.querySelector('[data-iris-audit-panel]')).not.toBeNull()
    document.dispatchEvent(new Event('pointerdown'))
    await nextTick()
    expect(document.querySelector('[data-iris-audit-panel]')).toBeNull()
  })

  it('is inert without the auditLog prop (no trigger, no entries)', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns: editableCols, data: rows, rowKey: 'id' },
      attachTo: host,
    })
    await editCell(wrapper, 1, 'name', 'Renamed')
    expect(auditTrigger()).toBeNull()
    expect(document.querySelector('[data-iris-audit-panel]')).toBeNull()
    expect(exposeOf(wrapper).getAuditLog()).toHaveLength(0)
  })
})
