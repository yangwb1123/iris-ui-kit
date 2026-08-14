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

function handle(): HTMLElement | null {
  return document.querySelector('[data-iris-range-fill]')
}

function handleCell(): HTMLElement | null {
  return handle()?.closest('[data-iris-cell-row][data-iris-cell-col]') ?? null
}

function fillTargets(): HTMLElement[] {
  return [...document.querySelectorAll('[data-iris-range-fill-target="true"]')] as HTMLElement[]
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
// vxe-parity rowDrag pattern). act() flushes the React state updates between
// events, so the move handler sees the pointerdown-set fillTarget.
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

/** Press the fill handle, move to (row, col) and release — a full drag. */
function dragFillTo(row: number, col: number): void {
  const h = handle()!
  stubPointerAt(cell(row, col))
  firePointer(h, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
  firePointer(h, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
  firePointer(h, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
}

describe('@iris-ui-kit/react IrisTable drag fill (batch AQ, iris 独有)', () => {
  it('no rangeFill → no fill handle', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    fireEvent.click(cell(0, 0))
    expect(handle()).toBeNull()
  })

  it('rangeFill without a live range → no fill handle', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange rangeFill />)
    expect(handle()).toBeNull()
  })

  it('handle renders inside the range bottom-right cell (6px primary square, crosshair)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange rangeFill />)
    selectRange(0, 0, 1, 1)
    const h = handle()
    expect(h).not.toBeNull()
    expect(handleCell()?.dataset.irisCellRow).toBe('1')
    expect(handleCell()?.dataset.irisCellCol).toBe('1')
    expect(h!.style.width).toBe('6px')
    expect(h!.style.height).toBe('6px')
    expect(h!.style.background).toBe('var(--iris-primary)')
    expect(h!.style.cursor).toBe('crosshair')
    expect(h!.style.position).toBe('absolute')
  })

  it('pressing the handle is not a click — the range survives', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange rangeFill />)
    selectRange(0, 0, 1, 1)
    firePointer(handle()!, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    // The range toolbar's outside-press dismissal must NOT clear the range.
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
    expect(handle()).not.toBeNull()
  })

  it('drag down fills the rows cyclically (single-row source) + extends the range', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragFillTo(3, 0)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[1]).toEqual({ id: 2, name: 'A', age: 20 })
    expect(next[2]).toEqual({ id: 3, name: 'A', age: 30 })
    expect(next[3]).toEqual({ id: 4, name: 'A', age: 40 })
    // Range extended to the drag end; the handle moves to the new end cell.
    expect(cell(3, 0).dataset.irisCellSelected).toBe('true')
    expect(handleCell()?.dataset.irisCellRow).toBe('3')
    expect(handleCell()?.dataset.irisCellCol).toBe('0')
  })

  it('a multi-row source cycles A/B/A… down the column', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 1, 0)
    dragFillTo(3, 0)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[2]).toEqual({ id: 3, name: 'A', age: 30 })
    expect(next[3]).toEqual({ id: 4, name: 'B', age: 40 })
  })

  it('drag right fills the columns', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragFillTo(0, 1)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: 'A', age: 'A' })
    expect(cell(0, 1).dataset.irisCellSelected).toBe('true')
  })

  it('L-shape drag highlights the target rectangle (source range excluded)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange rangeFill />)
    selectRange(0, 0, 0, 0)
    const h = handle()!
    stubPointerAt(cell(2, 1))
    firePointer(h, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(h, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    const targets = fillTargets()
    expect(targets.length).toBe(5)
    const keys = targets.map((el) => `${el.dataset.irisCellRow}:${el.dataset.irisCellCol}`).sort()
    expect(keys).toEqual(['0:1', '1:0', '1:1', '2:0', '2:1'])
    expect(cell(0, 0).dataset.irisRangeFillTarget).toBeUndefined()
    firePointer(h, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
    expect(fillTargets().length).toBe(0)
    expect(cell(2, 1).dataset.irisCellSelected).toBe('true')
  })

  it('dragging up/left is ignored — no fill, no range growth', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 1, 1)
    dragFillTo(0, 0)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(0, 0).dataset.irisCellSelected).toBe('true')
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
    expect(cell(2, 0).dataset.irisCellSelected).toBeUndefined()
    expect(handleCell()?.dataset.irisCellRow).toBe('1')
  })

  it('pointercancel drops the target highlight without committing', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    const h = handle()!
    stubPointerAt(cell(2, 0))
    firePointer(h, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(h, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    expect(fillTargets().length).toBe(2)
    firePointer(h, 'pointercancel', { pointerId: 1 })
    expect(fillTargets().length).toBe(0)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(2, 0).dataset.irisCellSelected).toBeUndefined()
  })

  it('the drag end clamps to the table bounds', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    const h = handle()!
    // elementFromPoint can only return rendered cells, but a defensive clamp
    // keeps an out-of-bounds drag end inside the table.
    const fake = document.createElement('div')
    fake.dataset.irisCellRow = '99'
    fake.dataset.irisCellCol = '0'
    stubPointerAt(fake)
    firePointer(h, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    firePointer(h, 'pointermove', { clientX: 50, clientY: 100, pointerId: 1 })
    expect(fillTargets().length).toBe(3)
    firePointer(h, 'pointerup', { clientX: 50, clientY: 100, pointerId: 1 })
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[3]).toEqual({ id: 4, name: 'A', age: 40 })
    expect(cell(3, 0).dataset.irisCellSelected).toBe('true')
  })

  it('formula columns are skipped (display-only)', () => {
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
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragFillTo(1, 1)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    // Only the plain column is written — the formula cell is untouched.
    expect(next[1]).toEqual({ id: 2, name: 'A', age: 20 })
    expect(cell(1, 1).dataset.irisCellSelected).toBe('true')
  })

  it('rows without the row key → the fill is a no-op', () => {
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
        rangeFill
        onDataChange={onDataChange}
      />,
    )
    selectRange(0, 0, 0, 0)
    dragFillTo(2, 0)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(2, 0).dataset.irisCellSelected).toBeUndefined()
  })
})
