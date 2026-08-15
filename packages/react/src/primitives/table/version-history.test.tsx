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

/** Inline cell edit — the commitValue funnel (deliberately NOT versioned). */
function editCell(rowId: string | number, colKey: string, value: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, colKey))
  })
  act(() => {
    fireEvent.change(editor()!, { target: { value } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
  })
}

function historyTrigger(): HTMLElement | null {
  return document.querySelector('[data-iris-history-trigger]')
}

function openPanel(): HTMLElement {
  fireEvent.click(historyTrigger()!)
  const panel = document.querySelector('[data-iris-history-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return panel
}

function entries(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-history-entry]'))
}

// ── Version history (iris 独有, batch BA) ────────────────────────────────
describe('IrisTable version history', () => {
  it('an edit commit pushes a version: lightweight entry (index + type, no rows)', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    const versions = r.current!.getVersions()
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ index: 0, type: 'edit' })
    // Lightweight: the handle snapshot deliberately carries NO rows.
    expect(versions[0]).not.toHaveProperty('rows')
  })

  it('insertRow pushes a version with type insert (monotonic index)', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    act(() => {
      r.current?.insertRow({ id: 4, name: 'Dora', age: 41 }, 0)
    })
    act(() => {
      r.current?.removeRow(4)
    })
    const versions = r.current!.getVersions()
    expect(versions).toHaveLength(2)
    expect(versions[0]).toMatchObject({ index: 1, type: 'remove' })
    expect(versions[1]).toMatchObject({ index: 0, type: 'insert' })
  })

  it('an inline cell edit (commitValue funnel) does NOT push a version', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    expect(r.current!.getVersions()).toHaveLength(0)
  })

  it('the panel lists versions newest-first; clicking an entry restores + closes without re-pushing', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    act(() => {
      r.current?.updateRow(2, { age: 33 })
    })
    const panel = openPanel()
    const items = entries()
    expect(items).toHaveLength(2)
    // Newest first: the second commit (#1) is on top.
    expect(items[0]!.querySelector('[data-iris-history-index]')!.textContent).toBe('#1')
    expect(items[0]!.querySelector('[data-iris-history-type]')!.textContent).toBe('edit')
    expect(items[0]!.querySelector('[data-iris-history-time]')!.textContent).not.toBe('')
    expect(items[1]!.querySelector('[data-iris-history-index]')!.textContent).toBe('#0')
    expect(panel.querySelector('[data-iris-history-empty]')).toBeNull()
    // Click the newest entry → restores the state BEFORE the second commit.
    fireEvent.click(items[0]!)
    expect(cell(1, 'name').textContent).toBe('Renamed')
    expect(cell(2, 'age').textContent).toBe('32')
    expect(document.querySelector('[data-iris-history-panel]')).toBeNull()
    // No new version was pushed by the restore replay.
    expect(r.current!.getVersions()).toHaveLength(2)
  })

  it('restoreVersion via the handle applies the rows without pushing; the next commit resumes the monotonic index', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    act(() => {
      r.current?.updateRow(2, { age: 33 })
    })
    act(() => {
      r.current?.restoreVersion(0)
    })
    expect(cell(1, 'name').textContent).toBe('Charlie')
    expect(cell(2, 'age').textContent).toBe('32')
    expect(r.current!.getVersions()).toHaveLength(2)
    // The next commit pushes the RESTORED rows as a new (monotonic) version.
    act(() => {
      r.current?.updateRow(3, { name: 'Bob2' })
    })
    const versions = r.current!.getVersions()
    expect(versions).toHaveLength(3)
    expect(versions[0]).toMatchObject({ index: 2, type: 'edit' })
  })

  it('an unknown index is a no-op', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    act(() => {
      r.current?.restoreVersion(99)
    })
    expect(cell(1, 'name').textContent).toBe('Renamed')
    expect(r.current!.getVersions()).toHaveLength(1)
  })

  it('undo replay pushes a version with type undo (the commitRowList funnel)', () => {
    const r = tableRef()
    render(
      <IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory undo tableRef={r} />,
    )
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    act(() => {
      fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })
    })
    const versions = r.current!.getVersions()
    expect(versions).toHaveLength(2)
    expect(versions[0]).toMatchObject({ type: 'undo' })
  })

  it('Esc / outside pointer-down close the panel', () => {
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory />)
    openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-iris-history-panel]')).toBeNull()
    fireEvent.click(historyTrigger()!)
    expect(document.querySelector('[data-iris-history-panel]')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(document.querySelector('[data-iris-history-panel]')).toBeNull()
  })

  it('is inert without the versionHistory prop (no trigger, empty versions, restore no-op)', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" tableRef={r} />)
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    expect(historyTrigger()).toBeNull()
    expect(document.querySelector('[data-iris-history-panel]')).toBeNull()
    expect(r.current!.getVersions()).toHaveLength(0)
    act(() => {
      r.current?.restoreVersion(0)
    })
    expect(cell(1, 'name').textContent).toBe('Renamed')
  })
})
