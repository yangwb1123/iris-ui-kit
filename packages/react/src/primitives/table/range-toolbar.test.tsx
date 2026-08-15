import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setFileSaveHandler } from '@iris-ui-kit/core'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  clipboardWrite.mockReset()
  // Restore the pristine jsdom navigator (no Clipboard API) between tests.
  Reflect.deleteProperty(navigator, 'clipboard')
  setFileSaveHandler(null)
  vi.restoreAllMocks()
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
function stubClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite },
  })
  clipboardWrite.mockResolvedValue(undefined)
}

function cell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

/** Body-cell lookup that works without `cellRange` (row → leaf cell index). */
function cellAt(row: number, col: number): HTMLElement {
  const rowsEl = Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
  return rowsEl[row]!.querySelectorAll('[data-iris-table-cell]')[col] as HTMLElement
}

function bar(): HTMLElement | null {
  return document.querySelector('[data-iris-table-range-toolbar]')
}

function selectRange(r0: number, c0: number, r1: number, c1: number): void {
  fireEvent.click(cell(r0, c0))
  if (r1 !== r0 || c1 !== c0) fireEvent.click(cell(r1, c1), { shiftKey: true })
}

describe('@iris-ui-kit/react IrisTable range toolbar (batch AH, iris 独有)', () => {
  it('no range → no bar', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    expect(bar()).toBeNull()
  })

  it('selecting a range shows the bar with the three actions', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(bar()).not.toBeNull()
    expect(document.querySelector('[data-iris-table-range-copy]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-range-export]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-range-clear]')).not.toBeNull()
  })

  it('extending the range keeps the bar (remounts at the new anchor)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(bar()).not.toBeNull()
    fireEvent.click(cell(2, 1), { shiftKey: true })
    expect(bar()).not.toBeNull()
  })

  it('cellRange + onCellClick: the unified click path still anchors the bar', async () => {
    // Review-finding regression: the cellRange spread onClick was shadowed by
    // the unified onClick, so with BOTH props the anchor never updated →
    // useFloating never positioned → the bar rendered visibility:hidden.
    const onCellClick = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange onCellClick={onCellClick} />)
    fireEvent.click(cell(0, 0))
    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 0, columnIndex: 0 }),
    )
    // The bar must become VISIBLE (a positioned anchor), not just rendered.
    await waitFor(() => expect(bar()!.style.visibility).not.toBe('hidden'))
    // Extending through the same path re-anchors it.
    fireEvent.click(cell(1, 1), { shiftKey: true })
    await waitFor(() => expect(bar()!.style.visibility).not.toBe('hidden'))
  })

  it('toolbar aria-label describes the bar, not the first action', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(bar()?.getAttribute('aria-label')).toBe('Cell range actions')
  })

  it('copy writes the CURRENT range as TSV to the clipboard (no clipConfig needed)', async () => {
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 0, 1, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-copy]')!)
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25\nAlice\t32'))
  })

  it('clear zeroes the range cells through one onDataChange commit', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" cellRange onDataChange={onDataChange} />,
    )
    selectRange(0, 0, 1, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-clear]')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: '', age: '' })
    expect(next[1]).toEqual({ id: 2, name: '', age: '' })
    expect(next[2]).toEqual({ id: 3, name: 'Bob', age: 28 })
    // The selection survives a cell clear (only the VALUES were zeroed).
    expect(bar()).not.toBeNull()
  })

  it('export downloads the range slice as a headerless CSV', async () => {
    const handler = vi.fn()
    setFileSaveHandler(handler)
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 0, 1, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-export]')!)
    await waitFor(() => expect(handler).toHaveBeenCalled())
    const BOM = String.fromCharCode(0xfeff)
    expect(handler).toHaveBeenCalledWith({
      filename: 'table-range.csv',
      content: `${BOM}Charlie,25\nAlice,32`,
      mimeType: 'text/csv;charset=utf-8;',
    })
  })

  it('range export masks sensitive columns — same rule as the copy TSV (batch AY review fix)', async () => {
    const handler = vi.fn()
    setFileSaveHandler(handler)
    const maskedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', mask: 'sensitive' },
    ]
    render(<IrisTable columns={maskedCols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 0, 1, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-export]')!)
    await waitFor(() => expect(handler).toHaveBeenCalled())
    const BOM = String.fromCharCode(0xfeff)
    expect(handler).toHaveBeenCalledWith({
      filename: 'table-range.csv',
      content: `${BOM}Charlie,****\nAlice,****`,
      mimeType: 'text/csv;charset=utf-8;',
    })
  })

  it('range export honors exportRaw (masked column exported raw)', async () => {
    const handler = vi.fn()
    setFileSaveHandler(handler)
    const rawCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', mask: 'sensitive', exportRaw: true },
    ]
    render(<IrisTable columns={rawCols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 0, 1, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-export]')!)
    await waitFor(() => expect(handler).toHaveBeenCalled())
    const BOM = String.fromCharCode(0xfeff)
    expect(handler).toHaveBeenCalledWith({
      filename: 'table-range.csv',
      content: `${BOM}Charlie,25\nAlice,32`,
      mimeType: 'text/csv;charset=utf-8;',
    })
  })

  it('outside pointer-down dismisses (clears the range → bar hides)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(bar()).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(bar()).toBeNull()
  })

  it('Escape dismisses the bar', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(bar()).not.toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(bar()).toBeNull()
  })

  it('no cellRange prop → no bar even when clicking cells', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    fireEvent.click(cellAt(0, 0))
    expect(bar()).toBeNull()
  })
})
