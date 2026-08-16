/* Batch CD row-drag insertion indicator (iris 独有 — vxe has no drop line).
   During an active rowDrag a 1px primary line (data-iris-row-drag-indicator)
   renders between rows at the over row's top/bottom edge, decided by the
   pointer vs. the over row's midpoint; pointerup commits through the SAME
   pure resolve so the row lands where the line was drawn. jsdom has no
   PointerEvent/layout — plain Events + per-row rect stubs (vxe-parity mold),
   act()-wrapped so React flushes between events (selection-drag mold). */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
]

// Stub per-row rects so closestCenter resolves real drop targets. The header
// occupies rect[0] (top 0), body rows follow at 40px (vxe-parity geometry):
// header center 20 · row1 center 60 · row2 center 100 · row3 center 140.
function stubRects(container: HTMLElement): void {
  const rowEls = [...container.querySelectorAll('[data-iris-table-row]')]
  rowEls.forEach((el, i) => {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: i * 40,
      width: 200,
      height: 40,
      right: 200,
      bottom: (i + 1) * 40,
      x: 0,
      y: i * 40,
      toJSON: () => ({}),
    })
  })
}

function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, init)
  return ev
}

function firePointer(el: Element, type: string, init: Record<string, unknown> = {}): void {
  act(() => {
    el.dispatchEvent(pointerEvent(type, init))
  })
}

interface Harness {
  container: HTMLElement
  onReorder: ReturnType<typeof vi.fn>
  handles: HTMLElement[]
  table: HTMLElement
  indicator: () => HTMLElement | null
}

function setup(): Harness {
  const onReorder = vi.fn()
  const { container } = render(
    <IrisTable columns={columns} data={rows} rowKey="id" rowDrag={{ onReorder }} />,
  )
  stubRects(container)
  const handles = [...container.querySelectorAll<HTMLElement>('[data-iris-table-cell="__drag"]')]
  const table = container.querySelector<HTMLElement>('[data-iris-table]')!
  return {
    container,
    onReorder,
    handles,
    table,
    indicator: () => container.querySelector<HTMLElement>('[data-iris-row-drag-indicator]'),
  }
}

/** Press `handles[fromIdx]`, cross the 4px threshold, then move to pointerY. */
function dragTo(h: Harness, fromIdx: number, pointerY: number): void {
  firePointer(h.handles[fromIdx]!, 'pointerdown', { button: 0, clientX: 10, clientY: 10 })
  firePointer(h.table, 'pointermove', { clientX: 12, clientY: pointerY })
}

function release(h: Harness, pointerY: number): void {
  firePointer(h.table, 'pointerup', { clientX: 12, clientY: pointerY })
}

function expectLine(h: Harness, side: 'above' | 'below' | null, top?: string): void {
  const el = h.indicator()
  if (side === null) {
    expect(el).toBeNull()
    return
  }
  expect(el).not.toBeNull()
  expect(el!.getAttribute('data-iris-row-drag-side')).toBe(side)
  if (top !== undefined) expect(el!.style.top).toBe(top)
  expect(el!.style.height).toBe('1px')
  expect(el!.style.background).toContain('var(--iris-primary)')
  expect(el!.style.pointerEvents).toBe('none')
  expect(el!.style.zIndex).toBe('2')
  expect(el!.style.position).toBe('absolute')
}

describe('IrisTable rowDrag insertion line — render (batch CD, iris 独有)', () => {
  it('① draws the line BELOW the over row when the pointer is past its midpoint', () => {
    const h = setup()
    // Pointer y=110 over row 2 (center 100) → strictly below → line at its
    // bottom edge (top 80 + 40 = 120).
    dragTo(h, 0, 110)
    expectLine(h, 'below', '120px')
  })

  it('② draws the line ABOVE the over row when the pointer is at/above its midpoint', () => {
    const h = setup()
    // Pointer y=90 over row 2 (center 100) → at/above → line at its top edge.
    dragTo(h, 0, 90)
    expectLine(h, 'above', '80px')
  })

  it('③ flips the line when the pointer crosses the over row midpoint', () => {
    const h = setup()
    dragTo(h, 0, 90)
    expectLine(h, 'above', '80px')
    // Same over row, pointer now strictly below its center → line flips.
    firePointer(h.table, 'pointermove', { clientX: 12, clientY: 110 })
    expectLine(h, 'below', '120px')
    // Still exactly one indicator node (no double-render).
    expect(h.container.querySelectorAll('[data-iris-row-drag-indicator]').length).toBe(1)
  })

  it('④ shows NO line over the dragged row itself', () => {
    const h = setup()
    // Drag row 2 (handles[1]), pointer over row 2 → overId === activeId.
    dragTo(h, 1, 100)
    expectLine(h, null)
  })

  it('⑤ shows NO line over the header row (non-row target)', () => {
    const h = setup()
    // Pointer over the header (rect[0], center 20) — resolve yields no row.
    dragTo(h, 0, 20)
    expectLine(h, null)
  })

  it('⑥ shows NO line before the drag threshold is crossed', () => {
    const h = setup()
    firePointer(h.handles[0]!, 'pointerdown', { button: 0, clientX: 10, clientY: 10 })
    // Both axes inside the 4px threshold → drag never starts.
    firePointer(h.table, 'pointermove', { clientX: 12, clientY: 12 })
    expectLine(h, null)
  })
})

describe('IrisTable rowDrag insertion line — cleanup (batch CD, iris 独有)', () => {
  it('⑦ pointerup clears the line and commits to the EXACT drawn position', () => {
    const h = setup()
    // Line above row 2 (insertIndex 2) → drop lands [2,1,3].
    dragTo(h, 0, 90)
    expectLine(h, 'above', '80px')
    release(h, 90)
    expectLine(h, null)
    expect(h.onReorder).toHaveBeenCalledTimes(1)
    expect((h.onReorder.mock.calls[0]![0] as Row[]).map((r) => r.id)).toEqual([2, 1, 3])
    // Second drag: line below row 2 (insertIndex 3) → drop lands [2,3,1].
    dragTo(h, 0, 110)
    expectLine(h, 'below', '120px')
    release(h, 110)
    expectLine(h, null)
    expect(h.onReorder).toHaveBeenCalledTimes(2)
    expect((h.onReorder.mock.calls[1]![0] as Row[]).map((r) => r.id)).toEqual([2, 3, 1])
  })

  it('⑧ net-zero drop draws the line but never notifies onReorder', () => {
    const h = setup()
    // Drag row 2 (from index 1) over row 1, pointer below row 1's center
    // (y=70 > 60) → line below row 1 = exactly row 2's current slot.
    dragTo(h, 1, 70)
    expectLine(h, 'below', '80px')
    release(h, 70)
    expectLine(h, null)
    expect(h.onReorder).not.toHaveBeenCalled()
  })

  it('⑨ pointerleave clears the line and aborts the drag', () => {
    const h = setup()
    dragTo(h, 0, 90)
    expectLine(h, 'above', '80px')
    // React implements onPointerLeave over the native `pointerout` event (a
    // dispatched plain `pointerleave` never reaches the synthetic handler).
    firePointer(h.table, 'pointerout', {})
    expectLine(h, null)
    // The cancelled drag must not commit on a trailing pointerup.
    release(h, 90)
    expect(h.onReorder).not.toHaveBeenCalled()
  })

  it('⑩ pointercancel clears the line and aborts the drag', () => {
    const h = setup()
    dragTo(h, 0, 90)
    expectLine(h, 'above', '80px')
    firePointer(h.table, 'pointercancel', {})
    expectLine(h, null)
    release(h, 90)
    expect(h.onReorder).not.toHaveBeenCalled()
  })
})
