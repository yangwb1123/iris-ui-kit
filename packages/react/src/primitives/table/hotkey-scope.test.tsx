import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

// Batch DJ (iris 独有): `hotkeyScope` / `outerScope` gate the table's WINDOW
// keydown listeners (undo/redo, clip copy/paste, fnr Ctrl+F/Escape,
// batch-edit Escape). Default = shortcuts fire only while focus is INSIDE the
// table; `hotkeyScope:false` = permissive (anywhere); `outerScope` = global.

afterEach(() => {
  cleanup()
  external?.remove()
  clipboardWrite.mockReset()
  clipboardRead.mockReset()
  Reflect.deleteProperty(navigator, 'clipboard')
})

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

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function cellValue(rowId: string | number, key: string): string {
  return cell(rowId, key)?.textContent ?? ''
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

function ctrlZ(): void {
  fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })
}

function ctrlF(target: HTMLElement): void {
  fireEvent.keyDown(target, { key: 'f', ctrlKey: true })
}

function fnrOpen(): boolean {
  return document.querySelector('[data-iris-fnr-find]') !== null
}

// An element rendered OUTSIDE the table root — the de-focused keydown target.
let external: HTMLButtonElement
beforeEach(() => {
  external = document.createElement('button')
  external.setAttribute('data-testid', 'external')
  document.body.appendChild(external)
})

const clipboardWrite = vi.fn<(text: string) => Promise<void>>()
const clipboardRead = vi.fn<() => Promise<string>>()

function stubClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite, readText: clipboardRead },
  })
  clipboardWrite.mockResolvedValue(undefined)
  clipboardRead.mockResolvedValue('')
}

// ── Default scope: in-table only ───────────────────────────────────────────
describe('hotkeyScope default (in-table only)', () => {
  it('fnr Ctrl+F opens while focus is inside the table', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr />)
    ctrlF(root())
    expect(fnrOpen()).toBe(true)
  })

  it('fnr Ctrl+F does NOT open while focus is outside the table', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr />)
    ctrlF(external)
    expect(fnrOpen()).toBe(false)
  })

  it('recovers: blocked while defocused, opens again once refocused', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr />)
    ctrlF(external)
    expect(fnrOpen()).toBe(false)
    ctrlF(root())
    expect(fnrOpen()).toBe(true)
  })

  it('undo Ctrl+Z reverts in-table but is inert while defocused', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" undo />)
    editCell(1, 'name', 'Renamed')
    expect(cellValue(1, 'name')).toContain('Renamed')
    // Defocused: the shortcut must NOT undo.
    act(() => fireEvent.keyDown(external, { key: 'z', ctrlKey: true }))
    expect(cellValue(1, 'name')).toContain('Renamed')
    // Back in-table: undo fires.
    act(() => ctrlZ())
    expect(cellValue(1, 'name')).toContain('Charlie')
  })

  it('clip copy only fires while focus is inside the table', async () => {
    stubClipboard()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    fireEvent.click(document.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!)
    fireEvent.click(document.querySelector('[data-iris-cell-row="1"][data-iris-cell-col="1"]')!, {
      shiftKey: true,
    })
    act(() => fireEvent.keyDown(external, { key: 'c', ctrlKey: true }))
    await new Promise((r) => setTimeout(r, 20))
    expect(clipboardWrite).not.toHaveBeenCalled()
    act(() => fireEvent.keyDown(root(), { key: 'c', ctrlKey: true }))
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalled())
  })
})

// ── outerScope: global ─────────────────────────────────────────────────────
describe('outerScope (global)', () => {
  it('fnr Ctrl+F opens even while focus is outside the table', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr outerScope />)
    ctrlF(external)
    expect(fnrOpen()).toBe(true)
  })

  it('outerScope wins even when hotkeyScope is also set', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr hotkeyScope outerScope />)
    ctrlF(external)
    expect(fnrOpen()).toBe(true)
  })

  it('clip copy fires from outside the table under outerScope', async () => {
    stubClipboard()
    render(
      <IrisTable columns={baseCols} data={rows} rowKey="id" cellRange clipConfig={{}} outerScope />,
    )
    fireEvent.click(document.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!)
    fireEvent.click(document.querySelector('[data-iris-cell-row="1"][data-iris-cell-col="1"]')!, {
      shiftKey: true,
    })
    act(() => fireEvent.keyDown(external, { key: 'c', ctrlKey: true }))
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalled())
  })
})

// ── hotkeyScope:false (permissive) ─────────────────────────────────────────
describe('hotkeyScope false (permissive)', () => {
  it('fnr Ctrl+F opens while focus is outside the table', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr hotkeyScope={false} />)
    ctrlF(external)
    expect(fnrOpen()).toBe(true)
  })

  it('undo fires even while defocused under permissive mode', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" undo hotkeyScope={false} />)
    editCell(1, 'name', 'Renamed')
    expect(cellValue(1, 'name')).toContain('Renamed')
    act(() => fireEvent.keyDown(external, { key: 'z', ctrlKey: true }))
    expect(cellValue(1, 'name')).toContain('Charlie')
  })
})

// ── prop change takes the latest value (no stale closure) ──────────────────
describe('hotkeyScope prop changes', () => {
  it('switching outerScope on mid-life flips the gate immediately', () => {
    const { rerender } = render(
      <IrisTable columns={editableCols} data={rows} rowKey="id" fnr outerScope={false} />,
    )
    ctrlF(external)
    expect(fnrOpen()).toBe(false)
    rerender(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr outerScope />)
    ctrlF(external)
    expect(fnrOpen()).toBe(true)
  })

  it('unmounting cleans up the window listeners (no leak/ghost)', () => {
    const { unmount } = render(
      <IrisTable columns={editableCols} data={rows} rowKey="id" fnr outerScope />,
    )
    unmount()
    // Nothing should crash and the external target no longer triggers anything.
    ctrlF(external)
    expect(fnrOpen()).toBe(false)
  })
})
