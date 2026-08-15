import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  clipboardWrite.mockReset()
  clipboardRead.mockReset()
  // Restore the pristine jsdom navigator (no Clipboard API) between tests.
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

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
]

/** keyboardNavigation cell (data-grid-row/col). */
function cellAt(r: number, c: number): HTMLElement {
  return document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`) as HTMLElement
}

/** cellRange cell (data-iris-cell-row/col). */
function cell(r: number, c: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${r}"][data-iris-cell-col="${c}"]`,
  ) as HTMLElement
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function queryInput(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-query-input]')
}

function focusGridCell(r: number, c: number): HTMLElement {
  const cellEl = cellAt(r, c)!
  act(() => {
    cellEl.focus()
    fireEvent.focus(cellEl)
  })
  return cellEl
}

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

describe('@iris-ui-kit/react IrisTable keymap (batch BG, iris 独有)', () => {
  it('default bindings: F2 edits, Delete clears, Ctrl+Z undoes (unchanged without keymap)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        undo
        onDataChange={onDataChange}
      />,
    )
    focusGridCell(0, 1)
    act(() => fireEvent.keyDown(cellAt(0, 1), { key: 'Delete' }))
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenLastCalledWith([
      { id: 1, name: 'Charlie', age: '' },
      { id: 2, name: 'Alice', age: 32 },
      { id: 3, name: 'Bob', age: 28 },
    ])
    // Ctrl+Z (default undo) restores the cleared cell through commitRowList.
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true }))
    expect(onDataChange).toHaveBeenCalledTimes(2)
    expect(onDataChange).toHaveBeenLastCalledWith(rows)
    // F2 (default edit) begins editing the focused cell (row 0, age 25).
    act(() => fireEvent.keyDown(cellAt(0, 1), { key: 'F2' }))
    expect(editor()).not.toBeNull()
    expect(editor()!.value).toBe('25')
  })

  it('default bindings: Ctrl+C copies the range TSV (clipConfig gate)', async () => {
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    fireEvent.click(cell(0, 0))
    fireEvent.click(cell(1, 1), { shiftKey: true })
    act(() => fireEvent.keyDown(root(), { key: 'c', ctrlKey: true }))
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25\nAlice\t32'))
  })

  it('default bindings: Ctrl+D fills one step down through the range-fill pipeline', () => {
    const onDataChange = vi.fn()
    const fillRows: Row[] = [
      { id: 1, name: 'A', age: 10 },
      { id: 2, name: 'B', age: 20 },
      { id: 3, name: 'C', age: 30 },
      { id: 4, name: 'D', age: 40 },
    ]
    render(
      <IrisTable
        columns={cols}
        data={fillRows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(cell(0, 0))
    act(() => fireEvent.keyDown(root(), { key: 'd', ctrlKey: true }))
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenLastCalledWith([
      { id: 1, name: 'A', age: 10 },
      { id: 2, name: 'A', age: 20 },
      { id: 3, name: 'C', age: 30 },
      { id: 4, name: 'D', age: 40 },
    ])
  })

  it('default bindings: Ctrl+K focuses the query input (query prop gate)', () => {
    render(<IrisTable columns={cols} data={rows} query="" onQueryChange={vi.fn()} />)
    act(() => fireEvent.keyDown(root(), { key: 'k', ctrlKey: true }))
    expect(document.activeElement).toBe(queryInput())
  })

  it('overrides: edit F3 rebinds F2; clear Delete drops the Backspace alias', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        keymap={{ edit: 'F3', clear: 'Delete' }}
        onDataChange={onDataChange}
      />,
    )
    const cellEl = focusGridCell(0, 0)
    // F2 (the default edit key) is inert after the wholesale override.
    act(() => fireEvent.keyDown(cellEl, { key: 'F2' }))
    expect(editor()).toBeNull()
    act(() => fireEvent.keyDown(cellEl, { key: 'F3' }))
    expect(editor()).not.toBeNull()
    expect(editor()!.value).toBe('Charlie')
    // Close the editor (Enter commits) so the clear keys work again.
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    focusGridCell(0, 0)
    // Backspace alias is GONE — the override replaced the action wholesale.
    act(() => fireEvent.keyDown(cellAt(0, 0), { key: 'Backspace' }))
    expect(onDataChange).not.toHaveBeenCalled()
    act(() => fireEvent.keyDown(cellAt(0, 0), { key: 'Delete' }))
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenLastCalledWith([
      { id: 1, name: '', age: 25 },
      { id: 2, name: 'Alice', age: 32 },
      { id: 3, name: 'Bob', age: 28 },
    ])
  })

  it('overrides: undo Ctrl+Q rebinds Ctrl+Z', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        undo
        keymap={{ undo: 'Ctrl+Q' }}
        onDataChange={onDataChange}
      />,
    )
    focusGridCell(0, 1)
    act(() => fireEvent.keyDown(cellAt(0, 1), { key: 'Delete' }))
    // Default Ctrl+Z no longer undoes…
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true }))
    expect(onDataChange).toHaveBeenCalledTimes(1)
    // …the rebound Ctrl+Q does.
    act(() => fireEvent.keyDown(root(), { key: 'q', ctrlKey: true }))
    expect(onDataChange).toHaveBeenCalledTimes(2)
    expect(onDataChange).toHaveBeenLastCalledWith(rows)
  })

  it('invalid overrides ("" / whitespace / "Meta") are ignored → defaults retained', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        undo
        keymap={{ edit: '', clear: '  ', undo: 'Meta' }}
        onDataChange={onDataChange}
      />,
    )
    focusGridCell(0, 1)
    // Default clear still works (Delete), default edit still works (F2)…
    act(() => fireEvent.keyDown(cellAt(0, 1), { key: 'Delete' }))
    expect(onDataChange).toHaveBeenCalledTimes(1)
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true }))
    expect(onDataChange).toHaveBeenCalledTimes(2)
    expect(onDataChange).toHaveBeenLastCalledWith(rows)
    act(() => fireEvent.keyDown(cellAt(0, 1), { key: 'F2' }))
    expect(editor()).not.toBeNull()
  })

  it('exact modifier matching: Alt+Ctrl+Z inert, Ctrl+Shift+Z redoes (never undoes)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        undo
        onDataChange={onDataChange}
      />,
    )
    focusGridCell(0, 1)
    act(() => fireEvent.keyDown(cellAt(0, 1), { key: 'Delete' }))
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })) // undo
    expect(onDataChange).toHaveBeenCalledTimes(2)
    expect(onDataChange).toHaveBeenLastCalledWith(rows)
    // Alt+Ctrl+Z matches neither undo nor redo.
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true, altKey: true }))
    expect(onDataChange).toHaveBeenCalledTimes(2)
    // Ctrl+Shift+Z redoes (exact: it never lands on undo).
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true, shiftKey: true }))
    expect(onDataChange).toHaveBeenCalledTimes(3)
    expect(onDataChange).toHaveBeenLastCalledWith([
      { id: 1, name: 'Charlie', age: '' },
      { id: 2, name: 'Alice', age: 32 },
      { id: 3, name: 'Bob', age: 28 },
    ])
  })

  it('feature gates ×5: a keymap never enables a disabled feature', async () => {
    // (1) edit override without tableShortcuts → inert.
    render(<IrisTable columns={cols} data={rows} keyboardNavigation keymap={{ edit: 'F3' }} />)
    const cellEl = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(cellEl, { key: 'F3' }))
    expect(editor()).toBeNull()
    cleanup()

    // (2) fill without rangeFill → inert.
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" cellRange onDataChange={onDataChange} />,
    )
    fireEvent.click(cell(0, 0))
    act(() => fireEvent.keyDown(root(), { key: 'd', ctrlKey: true }))
    expect(onDataChange).not.toHaveBeenCalled()
    cleanup()

    // (3) query without the controlled `query` prop → no input, no focus.
    render(<IrisTable columns={cols} data={rows} />)
    expect(queryInput()).toBeNull()
    act(() => fireEvent.keyDown(root(), { key: 'k', ctrlKey: true }))
    expect(queryInput()).toBeNull()
    cleanup()

    // (4) copy without clipConfig → clipboard untouched.
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    act(() => fireEvent.keyDown(root(), { key: 'c', ctrlKey: true }))
    await new Promise((r) => setTimeout(r, 20))
    expect(clipboardWrite).not.toHaveBeenCalled()
    cleanup()

    // (5) undo without the undo prop → Ctrl+Z inert.
    const onDataChange2 = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        onDataChange={onDataChange2}
      />,
    )
    focusGridCell(0, 1)
    act(() => fireEvent.keyDown(cellAt(0, 1), { key: 'Delete' }))
    expect(onDataChange2).toHaveBeenCalledTimes(1)
    act(() => fireEvent.keyDown(root(), { key: 'z', ctrlKey: true }))
    expect(onDataChange2).toHaveBeenCalledTimes(1)
  })

  it('collision = first handler wins: an edit-bound Ctrl+C never also copies', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        keyboardNavigation
        tableShortcuts
        cellRange
        clipConfig={{}}
        keymap={{ edit: 'Ctrl+C', copy: 'Ctrl+C' }}
      />,
    )
    fireEvent.click(cell(0, 0)) // live range for the copy branch
    focusGridCell(0, 0) // focused cell for the edit branch
    act(() => fireEvent.keyDown(cellAt(0, 0), { key: 'c', ctrlKey: true }))
    // The root handler (edit) ran first and claimed the key — the window
    // clip listener sees defaultPrevented and backs off.
    expect(editor()).not.toBeNull()
    expect(editor()!.value).toBe('Charlie')
    await new Promise((r) => setTimeout(r, 20))
    expect(clipboardWrite).not.toHaveBeenCalled()
  })
})
