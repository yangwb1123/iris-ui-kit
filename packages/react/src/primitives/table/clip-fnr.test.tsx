import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
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
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

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

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

/** Body-cell lookup that works without `cellRange` (row → leaf cell index). */
function cellAt(row: number, col: number): HTMLElement {
  const rows = Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
  return rows[row]!.querySelectorAll('[data-iris-table-cell]')[col] as HTMLElement
}

function openFnr(): HTMLInputElement {
  fireEvent.keyDown(root(), { key: 'f', ctrlKey: true })
  const find = document.querySelector('[data-iris-fnr-find]') as HTMLInputElement
  expect(find).not.toBeNull()
  return find
}

function queryFnr(query: string): void {
  fireEvent.change(document.querySelector('[data-iris-fnr-find]')!, {
    target: { value: query },
  })
}

function fnrMatches(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-fnr-match="true"]'))
}

// ── clipConfig: copy (Ctrl/Cmd+C) ──────────────────────────────────────────
describe('IrisTable clipConfig copy', () => {
  it('copies the selected range as TSV on Ctrl+C', async () => {
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    // Select the 2×2 range: (0,0) → (1,1).
    fireEvent.click(cell(0, 0))
    fireEvent.click(cell(1, 1), { shiftKey: true })
    fireEvent.keyDown(root(), { key: 'c', ctrlKey: true })
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25\nAlice\t32'))
  })

  it('neutralizes formula-like cells in the TSV', async () => {
    stubClipboard()
    const formulaRows: Row[] = [
      { id: 1, name: '=SUM(A1)', age: 25 },
      { id: 2, name: '-5', age: 32 },
    ]
    render(<IrisTable columns={cols} data={formulaRows} rowKey="id" cellRange clipConfig={{}} />)
    fireEvent.click(cell(0, 0))
    fireEvent.click(cell(1, 1), { shiftKey: true })
    fireEvent.keyDown(root(), { key: 'c', ctrlKey: true })
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith("'=SUM(A1)\t25\n'-5\t32"))
  })

  it('does nothing without a selected range', async () => {
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    fireEvent.keyDown(root(), { key: 'c', ctrlKey: true })
    // Give the async write a chance to run — it must never fire.
    await new Promise((r) => setTimeout(r, 20))
    expect(clipboardWrite).not.toHaveBeenCalled()
  })

  it('does nothing without clipConfig', async () => {
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    fireEvent.click(cell(1, 1), { shiftKey: true })
    fireEvent.keyDown(root(), { key: 'c', ctrlKey: true })
    await new Promise((r) => setTimeout(r, 20))
    expect(clipboardWrite).not.toHaveBeenCalled()
  })
})

// ── clipConfig: paste (Ctrl/Cmd+V) ─────────────────────────────────────────
describe('IrisTable clipConfig paste', () => {
  it('writes clipboard cells into the range anchor onward, one onDataChange', async () => {
    stubClipboard()
    clipboardRead.mockResolvedValue('X\tY\nZ\tW')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(cell(0, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'X', age: 'Y' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Z', age: 'W' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })

  it('ignores overflow beyond the last row/col', async () => {
    stubClipboard()
    clipboardRead.mockResolvedValue('P\tQ\nR\tS\nT\tU')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    // Anchor at row 1: 3 clipboard lines would need rows 1–3, row 3 does not exist.
    fireEvent.click(cell(1, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'Charlie', age: 25 })
    expect(next[1]).toMatchObject({ id: 2, name: 'P', age: 'Q' })
    expect(next[2]).toMatchObject({ id: 3, name: 'R', age: 'S' })
  })

  it('does nothing without a selected range', async () => {
    stubClipboard()
    clipboardRead.mockResolvedValue('X\tY')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await new Promise((r) => setTimeout(r, 20))
    expect(onDataChange).not.toHaveBeenCalled()
  })
})

// ── clipConfig: rectangle paste (batch AK, iris 独有) ────────────────────
// A multi-cell selection fills EXACTLY the selected rectangle from its
// top-left (clipboard smaller → top-left fill, rest unchanged; larger →
// clipped to the rectangle AND the table bounds). Single-cell keeps the
// batch-O streaming behavior (pinned by the tests above).
describe('IrisTable clipConfig rectangle paste', () => {
  it('fills exactly the selected rectangle from its top-left, one onDataChange', async () => {
    stubClipboard()
    clipboardRead.mockResolvedValue('X\tY\nZ\tW')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    // Select the 2×2 rectangle (0,0) → (1,1).
    fireEvent.click(cell(0, 0))
    fireEvent.click(cell(1, 1), { shiftKey: true })
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'X', age: 'Y' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Z', age: 'W' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })

  it('smaller clipboard fills only the rectangle top-left, rest unchanged', async () => {
    stubClipboard()
    clipboardRead.mockResolvedValue('Q')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(cell(0, 0))
    fireEvent.click(cell(1, 1), { shiftKey: true })
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'Q', age: 25 })
    expect(next[1]).toMatchObject({ id: 2, name: 'Alice', age: 32 })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })

  it('larger clipboard is clipped to the rectangle and table bounds', async () => {
    stubClipboard()
    // 3×3 clipboard into a 2×2 rectangle anchored at (1,0): the third line and
    // the third column must be ignored; row 0 untouched.
    clipboardRead.mockResolvedValue('P\tQ\tX\nR\tS\tY\nT\tU\tZ')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(cell(1, 0))
    fireEvent.click(cell(2, 1), { shiftKey: true })
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'Charlie', age: 25 })
    expect(next[1]).toMatchObject({ id: 2, name: 'P', age: 'Q' })
    expect(next[2]).toMatchObject({ id: 3, name: 'R', age: 'S' })
  })

  it('a single-row multi-column selection does not stream past the rectangle', async () => {
    stubClipboard()
    // Anchor (1,0) → (1,1) is a 1×2 multi-cell selection: two clipboard lines
    // must NOT stream into row 2 (streaming would have written them).
    clipboardRead.mockResolvedValue('P\tQ\nR\tS')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(cell(1, 0))
    fireEvent.click(cell(1, 1), { shiftKey: true })
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'Charlie', age: 25 })
    expect(next[1]).toMatchObject({ id: 2, name: 'P', age: 'Q' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
  })
})

// ── fnr: find & replace bar ────────────────────────────────────────────────
describe('IrisTable fnr bar', () => {
  it('Ctrl+F opens the bar; typing highlights matching cells; Enter steps', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    const find = openFnr()
    // 'a' matches Charlie + Alice (case-insensitive) — one match per cell.
    queryFnr('a')
    expect(fnrMatches().length).toBe(2)
    expect(document.querySelector('[data-iris-fnr-active="true"]')).toBe(cellAt(0, 0))
    expect(document.querySelector('[data-iris-fnr-count]')?.textContent).toBe('1/2')
    fireEvent.keyDown(find, { key: 'Enter' })
    expect(document.querySelector('[data-iris-fnr-active="true"]')).toBe(cellAt(1, 0))
    // Enter wraps to the first match; Shift+Enter walks back.
    fireEvent.keyDown(find, { key: 'Enter' })
    expect(document.querySelector('[data-iris-fnr-active="true"]')).toBe(cellAt(0, 0))
    fireEvent.keyDown(find, { key: 'Enter', shiftKey: true })
    expect(document.querySelector('[data-iris-fnr-active="true"]')).toBe(cellAt(1, 0))
  })

  it('an empty query clears the highlights', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    openFnr()
    queryFnr('a')
    expect(fnrMatches().length).toBe(2)
    queryFnr('')
    expect(fnrMatches().length).toBe(0)
  })

  it('replace writes through commitRowList and recomputes matches', () => {
    const onDataChange = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr onDataChange={onDataChange} />)
    openFnr()
    queryFnr('ali')
    expect(fnrMatches().length).toBe(1)
    fireEvent.change(document.querySelector('[data-iris-fnr-replace]')!, {
      target: { value: 'Ada' },
    })
    fireEvent.click(document.querySelector('[data-iris-fnr-replace-btn]')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[1]).toMatchObject({ id: 2, name: 'Adace' })
    // Match list recomputes after the write-back: 'ali' no longer matches.
    expect(fnrMatches().length).toBe(0)
  })

  it('replace-all replaces every match in one commit', () => {
    const onDataChange = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr onDataChange={onDataChange} />)
    openFnr()
    queryFnr('a')
    expect(fnrMatches().length).toBe(2)
    fireEvent.change(document.querySelector('[data-iris-fnr-replace]')!, {
      target: { value: 'X' },
    })
    fireEvent.click(document.querySelector('[data-iris-fnr-replace-all]')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'ChXrlie' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Xlice' })
    expect(next[2]).toMatchObject({ id: 3, name: 'Bob', age: 28 })
    expect(fnrMatches().length).toBe(0)
  })

  it('Esc closes the bar and clears the highlights', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr />)
    const find = openFnr()
    queryFnr('a')
    expect(fnrMatches().length).toBe(2)
    fireEvent.keyDown(find, { key: 'Escape' })
    expect(document.querySelector('[data-iris-fnr-bar]')).toBeNull()
    expect(fnrMatches().length).toBe(0)
  })

  it('Ctrl+F does nothing when fnr is off', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    fireEvent.keyDown(root(), { key: 'f', ctrlKey: true })
    expect(document.querySelector('[data-iris-fnr-bar]')).toBeNull()
  })

  it('Ctrl+F does not open the bar while a cell editor is open', () => {
    const editableCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age' },
    ]
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" fnr />)
    fireEvent.doubleClick(cellAt(0, 0))
    const editor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    expect(editor).not.toBeNull()
    fireEvent.keyDown(editor, { key: 'f', ctrlKey: true })
    expect(document.querySelector('[data-iris-fnr-bar]')).toBeNull()
  })
})
