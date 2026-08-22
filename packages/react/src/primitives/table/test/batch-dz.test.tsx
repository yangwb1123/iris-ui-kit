import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

/**
 * Batch DZ (iris 独有 — vxe has no cell-copy parity): cellDragCopy copies a
 * selected block via a bottom-edge grip (move grip has the top edge);
 * whole-block fit (越界忽略: no outline, zero commit), source untouched.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // jsdom has no document.elementFromPoint — remove the per-test stub.
  delete (document as { elementFromPoint?: unknown }).elementFromPoint
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'A', age: 10 },
  { id: 2, name: 'B', age: 20 },
  { id: 3, name: 'C', age: 30 },
  { id: 4, name: 'D', age: 40 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function cell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

function grip(): HTMLElement | null {
  return document.querySelector('[data-iris-range-copy]')
}

function gripCell(): HTMLElement | null {
  return grip()?.closest('[data-iris-cell-row][data-iris-cell-col]') ?? null
}

function cellText(row: number, col: number): string {
  return cell(row, col)?.textContent ?? ''
}

function stubPointerAt(target: HTMLElement | null): void {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => target,
  })
}

function selectRange(r0: number, c0: number, r1: number, c1: number): void {
  fireEvent.click(cell(r0, c0))
  if (r1 !== r0 || c1 !== c0) fireEvent.click(cell(r1, c1), { shiftKey: true })
}

// jsdom has no PointerEvent — dispatch plain Events with pointer fields (the
// vxe-parity rowDrag / fill-handle / move-grip pattern). act() flushes React
// state between events, so the up handler sees the move-set rect.
function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, init)
  return ev
}

function firePointer(el: HTMLElement, type: string, init: Record<string, unknown> = {}): void {
  act(() => {
    el.dispatchEvent(pointerEvent(type, init))
  })
}

/** Press the copy grip, move to (row, col) and release — a full drag. */
function dragCopyTo(row: number, col: number): void {
  const g = grip()!
  stubPointerAt(cell(row, col))
  firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
  firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
  firePointer(g, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
}

function expectOutOfBounds(onDataChange: ReturnType<typeof vi.fn>, r: number, c: number): void {
  const g = grip()!
  const fake = document.createElement('div')
  fake.dataset.irisCellRow = String(r)
  fake.dataset.irisCellCol = String(c)
  stubPointerAt(fake)
  firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
  firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
  expect(document.querySelector('[data-iris-copy-target]')).toBeNull()
  firePointer(g, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
  expect(onDataChange).not.toHaveBeenCalled()
}

describe('@iris-ui-kit/react IrisTable cell drag-copy (batch DZ, iris 独有)', () => {
  it('no cellDragCopy → no copy grip (fail-closed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(grip()).toBeNull()
  })

  it('cellDragCopy without a live range → no copy grip (fail-closed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDragCopy />)
    expect(grip()).toBeNull()
  })

  it('grip renders in the top-left cell bottom edge (12×4 primary pill, copy cursor)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDragCopy />)
    selectRange(0, 0, 1, 1)
    const g = grip()
    expect(g).not.toBeNull()
    expect(gripCell()?.dataset.irisCellRow).toBe('0')
    expect(gripCell()?.dataset.irisCellCol).toBe('0')
    expect(g!.style.width).toBe('12px')
    expect(g!.style.height).toBe('4px')
    expect(g!.style.background).toBe('var(--iris-primary)')
    expect(g!.style.cursor).toBe('copy')
    expect(g!.style.position).toBe('absolute')
    expect(g!.style.bottom).toBe('2px') // bottom edge — the top owns the move grip
    expect(g!.style.top).toBe('')
  })

  it('pressing the grip is not a click — the range survives', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDragCopy />)
    selectRange(0, 0, 1, 1)
    firePointer(grip()!, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    // The range toolbar's outside-press dismissal must NOT clear the range.
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
    expect(grip()).not.toBeNull()
  })

  it('复制: a single cell copies — source untouched, selection stays', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragCopyTo(1, 1)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: 'A', age: 10 }) // 源块不动
    // Destination column = drag-end column index (CN block-index semantics):
    // the value lands in the AGE column of row 2 — nothing is cleared.
    expect(next[1]).toEqual({ id: 2, name: 'B', age: 'A' })
    // Copy does NOT move the selection: it stays on the source block.
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
    expect(cell(1, 1).dataset.irisCellSelected).toBeUndefined()
    expect(gripCell()?.dataset.irisCellRow).toBe('0')
  })

  it('复制: a 2×2 block copies whole — one commit, source rows untouched', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 1, 1)
    dragCopyTo(2, 0)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: 'A', age: 10 })
    expect(next[1]).toEqual({ id: 2, name: 'B', age: 20 })
    expect(next[2]).toEqual({ id: 3, name: 'A', age: 10 })
    expect(next[3]).toEqual({ id: 4, name: 'B', age: 20 })
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
  })

  it('复制: an overlapping slide snapshots ORIGINAL values (Excel parity)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    // 2×2 rows 0-1 dragged one down: dest rows 1-2 get the PRE-COMMIT
    // snapshot (row 2 = row 1 values, row 1 = row 0 values) — never reads
    // its own writes; row 0 keeps its values.
    selectRange(0, 0, 1, 1)
    dragCopyTo(1, 0)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: 'A', age: 10 })
    expect(next[1]).toEqual({ id: 2, name: 'A', age: 10 })
    expect(next[2]).toEqual({ id: 3, name: 'B', age: 20 })
    expect(next[3]).toEqual({ id: 4, name: 'D', age: 40 })
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
  })

  it('越界忽略: drag ends beyond the last row/column → no outline, zero commit', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    expectOutOfBounds(onDataChange, 99, 0) // row beyond the last
    expectOutOfBounds(onDataChange, 0, 99) // column beyond the last
  })

  it('越界忽略: drag ends before the first row/column → no outline, zero commit', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(2, 0, 3, 0)
    expectOutOfBounds(onDataChange, -5, 0) // before the first row
    expectOutOfBounds(onDataChange, 2, -5) // before the first column
  })

  it('越界忽略: a 2×2 block just past the row boundary is ignored (fit is whole-block)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    // 4 rows, 2×2 source at rows 0-1 → row 2 fits, row 3 is out by one.
    selectRange(0, 0, 1, 1)
    expectOutOfBounds(onDataChange, 3, 0)
    // Sanity contrast: row 2 fits and commits.
    dragCopyTo(2, 0)
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('outline: dest rect cells get data-iris-copy-target + token outline while dragging', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDragCopy />)
    selectRange(0, 0, 1, 1)
    const g = grip()!
    stubPointerAt(cell(2, 0))
    firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    // Every cell of the resolved dest rect (rows 2-3 × cols 0-1) is marked…
    expect(cell(2, 0).dataset.irisCopyTarget).toBe('true')
    expect(cell(2, 1).dataset.irisCopyTarget).toBe('true')
    expect(cell(3, 0).dataset.irisCopyTarget).toBe('true')
    expect(cell(3, 1).dataset.irisCopyTarget).toBe('true')
    expect(cell(2, 0).style.outline).toBe('2px solid var(--iris-primary, #6366f1)')
    // …while the source block is never marked.
    expect(cell(0, 0).dataset.irisCopyTarget).toBeUndefined()
    expect(cell(1, 1).dataset.irisCopyTarget).toBeUndefined()
    // Release clears the outline (and commits the values).
    firePointer(g, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
    expect(document.querySelector('[data-iris-copy-target]')).toBeNull()
    expect(cellText(3, 1)).toContain('20')
  })

  it('keep-last: a pointermove outside the body keeps the last resolved rect', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    const g = grip()!
    stubPointerAt(cell(2, 0))
    firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    expect(cell(2, 0).dataset.irisCopyTarget).toBe('true')
    stubPointerAt(null) // next move hit-tests nothing → keep the rect
    firePointer(g, 'pointermove', { clientX: -999, clientY: -999, pointerId: 1 })
    expect(cell(2, 0).dataset.irisCopyTarget).toBe('true')
    firePointer(g, 'pointerup', { clientX: -999, clientY: -999, pointerId: 1 })
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[2]).toEqual({ id: 3, name: 'A', age: 30 })
  })

  it('formula columns are never read or written', () => {
    const formulaCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'total', title: 'Total', formula: '=1+1' },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={formulaCols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 1)
    dragCopyTo(1, 0)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: 'A', age: 10 }) // source kept
    expect(next[1]).toEqual({ id: 2, name: 'A', age: 20 }) // only name written
  })

  it('locked/readonly destination cells survive the copy', () => {
    const lockedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', locked: true },
      { key: 'age', title: 'Age' },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={lockedCols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 1)
    dragCopyTo(1, 0)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[1]).toEqual({ id: 2, name: 'B', age: 10 }) // name locked → kept
    expect(next[0]).toEqual({ id: 1, name: 'A', age: 10 })
  })

  it('keyless rows → the copy is a no-op', () => {
    const keylessRows: Row[] = [
      { name: 'A', age: 10 },
      { name: 'B', age: 20 },
      { name: 'C', age: 30 },
    ]
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={keylessRows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragCopyTo(2, 0)
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('press + release without a move is a zero-commit no-op', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(1, 1, 1, 1)
    firePointer(grip()!, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(grip()!, 'pointerup', { clientX: 10, clientY: 10, pointerId: 1 })
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
  })

  it('drop on the source block is a zero-commit no-op', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(1, 1, 1, 1)
    dragCopyTo(1, 1)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
    expect(gripCell()?.dataset.irisCellRow).toBe('1')
  })

  it('pointercancel drops the drag without committing and clears the outline', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    const g = grip()!
    stubPointerAt(cell(2, 0))
    firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    expect(cell(2, 0).dataset.irisCopyTarget).toBe('true')
    firePointer(g, 'pointercancel', { pointerId: 1 })
    expect(onDataChange).not.toHaveBeenCalled()
    expect(document.querySelector('[data-iris-copy-target]')).toBeNull()
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
  })

  it('move + copy grips coexist: the copy grip commits a copy, not a move', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        cellDragCopy
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    // Both grips live on the range's top-left cell — move on the top edge,
    // copy on the bottom edge (zero collision, no interference).
    expect(document.querySelector('[data-iris-range-move]')).not.toBeNull()
    expect(grip()).not.toBeNull()
    dragCopyTo(1, 1)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    // A copy: the source cell KEEPS its value (a move would clear it) and
    // the selection stays on the source block (a move would follow it).
    // Destination (1,1) is the AGE column (block-index semantics).
    expect(next[0]).toEqual({ id: 1, name: 'A', age: 10 })
    expect(next[1]).toEqual({ id: 2, name: 'B', age: 'A' })
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
  })

  it('fill handle + copy grip coexist on the same range', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange rangeFill cellDragCopy />)
    selectRange(1, 0, 2, 1)
    // Fill handle at the bottom-right cell, copy grip at the top-left cell's
    // bottom edge — neither suppresses the other.
    expect(document.querySelector('[data-iris-range-fill]')).not.toBeNull()
    expect(grip()).not.toBeNull()
    expect(gripCell()?.dataset.irisCellRow).toBe('1')
  })

  it('the copy is undoable (one commitRowList step)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDragCopy undo />)
    selectRange(0, 0, 0, 0)
    dragCopyTo(2, 0)
    expect(cellText(2, 0)).toContain('A')
    expect(cellText(0, 0)).toContain('A') // source never cleared
    fireEvent.keyDown(document.querySelector('[data-iris-table]')!, { key: 'z', ctrlKey: true })
    expect(cellText(2, 0)).toContain('C')
    expect(cellText(0, 0)).toContain('A')
  })
})
