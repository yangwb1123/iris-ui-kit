import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // jsdom has no document.elementFromPoint — the stub added per-test is
  // removed so a later test never sees a stale hit-test.
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
  return document.querySelector('[data-iris-range-move]')
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
// vxe-parity rowDrag / fill-handle pattern). act() flushes the React state
// updates between events, so the move handler sees the pointerdown-set target.
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

/** Press the move grip, move to (row, col) and release — a full drag. */
function dragMoveTo(row: number, col: number): void {
  const g = grip()!
  stubPointerAt(cell(row, col))
  firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
  firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
  firePointer(g, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
}

describe('@iris-ui-kit/react IrisTable cell drag-move (batch CN, iris 独有)', () => {
  it('no cellDrag → no move grip (fail-closed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(grip()).toBeNull()
  })

  it('cellDrag without a live range → no move grip (fail-closed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDrag />)
    expect(grip()).toBeNull()
  })

  it('grip renders inside the range top-left cell (12×4 primary pill, move cursor)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDrag />)
    selectRange(0, 0, 1, 1)
    const g = grip()
    expect(g).not.toBeNull()
    expect(gripCell()?.dataset.irisCellRow).toBe('0')
    expect(gripCell()?.dataset.irisCellCol).toBe('0')
    expect(g!.style.width).toBe('12px')
    expect(g!.style.height).toBe('4px')
    expect(g!.style.background).toBe('var(--iris-primary)')
    expect(g!.style.cursor).toBe('move')
    expect(g!.style.position).toBe('absolute')
    expect(g!.style.top).toBe('2px')
  })

  it('pressing the grip is not a click — the range survives', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDrag />)
    selectRange(0, 0, 1, 1)
    firePointer(grip()!, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    // The range toolbar's outside-press dismissal must NOT clear the range.
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
    expect(grip()).not.toBeNull()
  })

  it('移动: a single cell cuts to the target and clears the source', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragMoveTo(1, 1)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: '', age: 10 })
    expect(next[1]).toEqual({ id: 2, name: 'B', age: 'A' })
    // Excel parity: the selection follows the moved block.
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
    expect(cell(0, 0).dataset.irisCellSelected).toBeUndefined()
    expect(gripCell()?.dataset.irisCellRow).toBe('1')
    expect(gripCell()?.dataset.irisCellCol).toBe('1')
  })

  it('移动: a 2×2 block moves whole (writes + clears in one commit)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 1, 1)
    dragMoveTo(2, 0)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: '', age: '' })
    expect(next[1]).toEqual({ id: 2, name: '', age: '' })
    expect(next[2]).toEqual({ id: 3, name: 'A', age: 10 })
    expect(next[3]).toEqual({ id: 4, name: 'B', age: 20 })
    expect(cell(2, 0).dataset.irisCellSelected).toBe('true')
    expect(cell(3, 1).dataset.irisCellSelected).toBe('true')
  })

  it('移动: overlapping slide down one row is an atomic cut-move', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 1, 0)
    dragMoveTo(1, 0)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: '', age: 10 })
    expect(next[1]).toEqual({ id: 2, name: 'A', age: 20 })
    expect(next[2]).toEqual({ id: 3, name: 'B', age: 30 })
    expect(next[3]).toEqual({ id: 4, name: 'D', age: 40 })
    expect(cell(2, 0).dataset.irisCellSelected).toBe('true')
  })

  it('越界: the drag end clamps down to the table bottom', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    const g = grip()!
    const fake = document.createElement('div')
    fake.dataset.irisCellRow = '99'
    fake.dataset.irisCellCol = '0'
    stubPointerAt(fake)
    firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    firePointer(g, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[3]).toEqual({ id: 4, name: 'A', age: 40 })
    expect(next[0]).toEqual({ id: 1, name: '', age: 10 })
    expect(cell(3, 0).dataset.irisCellSelected).toBe('true')
  })

  it('越界: the drag end clamps up to the table top', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(2, 0, 3, 0)
    const g = grip()!
    const fake = document.createElement('div')
    fake.dataset.irisCellRow = '-5'
    fake.dataset.irisCellCol = '0'
    stubPointerAt(fake)
    firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    firePointer(g, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: 'C', age: 10 })
    expect(next[1]).toEqual({ id: 2, name: 'D', age: 20 })
    expect(next[2]).toEqual({ id: 3, name: '', age: 30 })
    expect(next[3]).toEqual({ id: 4, name: '', age: 40 })
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
  })

  it('越界: the drag end clamps right to the last column', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    const g = grip()!
    const fake = document.createElement('div')
    fake.dataset.irisCellRow = '0'
    fake.dataset.irisCellCol = '99'
    stubPointerAt(fake)
    firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    firePointer(g, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: '', age: 'A' })
    expect(cell(0, 1).dataset.irisCellSelected).toBe('true')
  })

  it('pointercancel drops the drag without committing', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    const g = grip()!
    stubPointerAt(cell(2, 0))
    firePointer(g, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(g, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    firePointer(g, 'pointercancel', { pointerId: 1 })
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
  })

  it('press + release on the source block is a zero-commit no-op', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(1, 1, 1, 1)
    dragMoveTo(1, 1)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
  })

  it('formula columns are never read, written or cleared', () => {
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
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 1)
    dragMoveTo(1, 0)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: '', age: 10 })
    expect(next[1]).toEqual({ id: 2, name: 'A', age: 20 })
  })

  it('locked/readonly cells survive both phases (source keeps, dest never overwritten)', () => {
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
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 1)
    dragMoveTo(1, 0)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: 'A', age: '' })
    expect(next[1]).toEqual({ id: 2, name: 'B', age: 10 })
  })

  it('keyless rows → the move is a no-op', () => {
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
        cellDrag
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragMoveTo(2, 0)
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('the move is undoable (one commitRowList step)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange cellDrag undo />)
    selectRange(0, 0, 0, 0)
    dragMoveTo(2, 0)
    expect(cellText(2, 0)).toContain('A')
    expect(cellText(0, 0)).toBe('')
    fireEvent.keyDown(document.querySelector('[data-iris-table]')!, { key: 'z', ctrlKey: true })
    expect(cellText(0, 0)).toContain('A')
    expect(cellText(2, 0)).toContain('C')
  })
})
