import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

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

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true },
]

const baseCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function editCell(rowId: string | number, colKey: string, value: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, colKey))
  })
  act(() => {
    fireEvent.change(editor()!, { target: { value } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
  })
}

function auditTrigger(): HTMLElement | null {
  return document.querySelector('[data-iris-audit-trigger]')
}

function openPanel(): HTMLElement {
  fireEvent.click(auditTrigger()!)
  const panel = document.querySelector('[data-iris-audit-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return panel
}

function entries(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-audit-entry]'))
}

// ── Audit log (iris 独有, batch AT) ────────────────────────────────────────
describe('IrisTable audit log', () => {
  it('an edit commit records ONE entry (type edit + rowKey + column + old→new)', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    const log = r.current!.getAuditLog()
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

  it('insertRow records type insert with the added row key', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" auditLog tableRef={r} />)
    act(() => {
      r.current?.insertRow({ id: 4, name: 'Dora', age: 41 }, 0)
    })
    const log = r.current!.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ type: 'insert', rowKey: 4 })
    expect(log[0]!.column).toBeUndefined()
  })

  it('removeRow records type remove', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" auditLog tableRef={r} />)
    act(() => {
      r.current?.removeRow(2)
    })
    expect(r.current!.getAuditLog()[0]).toMatchObject({ type: 'remove', rowKey: 2 })
  })

  it('undo replay records type undo with the reverted cell diff', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog undo tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    act(() => {
      fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })
    })
    const log = r.current!.getAuditLog()
    expect(log).toHaveLength(2)
    expect(log[0]).toMatchObject({ type: 'undo', rowKey: 1, column: 'name' })
    expect(log[0]!.oldValue).toBe('Renamed')
    expect(log[0]!.newValue).toBe('Charlie')
  })

  it('the toolbar panel lists entries newest-first with type/rowKey/old→new', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    editCell(2, 'age', '33')
    const panel = openPanel()
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
  })

  it('the panel clear button empties the trail and shows the empty state', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    const panel = openPanel()
    expect(entries()).toHaveLength(1)
    fireEvent.click(panel.querySelector('[data-iris-audit-clear]') as HTMLElement)
    expect(entries()).toHaveLength(0)
    expect(panel.querySelector('[data-iris-audit-empty]')).not.toBeNull()
    expect(r.current!.getAuditLog()).toHaveLength(0)
  })

  it('clearAuditLog via the handle wipes entries; seq never resets', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    act(() => {
      r.current?.clearAuditLog()
    })
    expect(r.current!.getAuditLog()).toHaveLength(0)
    // Audit integrity: a cleared trail resumes at a HIGHER seq.
    editCell(1, 'age', '26')
    expect(r.current!.getAuditLog()[0]!.seq).toBe(2)
  })

  it('Esc / outside pointer-down close the panel', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog />)
    editCell(1, 'name', 'Renamed')
    openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-iris-audit-panel]')).toBeNull()
    fireEvent.click(auditTrigger()!)
    expect(document.querySelector('[data-iris-audit-panel]')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(document.querySelector('[data-iris-audit-panel]')).toBeNull()
  })

  it('is inert without the auditLog prop (no trigger, no entries)', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    expect(auditTrigger()).toBeNull()
    expect(document.querySelector('[data-iris-audit-panel]')).toBeNull()
    expect(r.current!.getAuditLog()).toHaveLength(0)
  })
})
