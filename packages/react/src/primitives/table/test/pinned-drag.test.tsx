import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
}

const rows: Row[] = [{ id: 1, a: 'x', b: 'y', c: 'z' }]

const cols: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B' },
  { key: 'c', title: 'C' },
]

/** Native pointer construction (jsdom may lack PointerEvent — useDrag.test precedent). */
const pointer = (type: string, init: Record<string, unknown>): Event => {
  const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
  if (typeof PointerCtor === 'function') {
    return new (PointerCtor as new (t: string, i?: EventInit) => Event)(type, {
      bubbles: true,
      ...(init as EventInit),
    })
  }
  const event = new Event(type, { bubbles: true })
  Object.assign(event, init)
  return event
}

const header = (key: string): HTMLElement =>
  document.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement

const pinHandle = (): HTMLElement =>
  document.querySelector('[data-iris-pinned-drag-handle]') as HTMLElement

const handleIn = (key: string): HTMLElement | null =>
  header(key).querySelector('[data-iris-pinned-drag-handle]')

/** One drag gesture on the pin-boundary handle: useDrag binds listeners to
 * the SPAN itself — pointerdown at fromX → move → release at toX
 * (commit-on-release). dx = toX − fromX resolves the new count via widths. */
const dragPinHandle = (fromX: number, toX: number): void => {
  act(() => {
    const el = pinHandle()
    const base = { button: 0, clientY: 10, pointerId: 1 }
    el.dispatchEvent(pointer('pointerdown', { ...base, clientX: fromX }))
    el.dispatchEvent(pointer('pointermove', { ...base, clientX: toX }))
    el.dispatchEvent(pointer('pointerup', { ...base, clientX: toX }))
  })
}

describe('@iris-ui-kit/react IrisTable pinned-count boundary drag (batch CV, iris 独有 — vxe has no pinned boundary handle)', () => {
  it('T1 renders the boundary handle at the last left-pinned leaf header only when pinnedDrag + a left pin exist', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    const { container, unmount } = render(
      <IrisTable columns={pinnedCols} data={rows} rowKey="id" pinnedDrag />,
    )
    expect(handleIn('a')).not.toBeNull()
    expect(container.querySelectorAll('[data-iris-pinned-drag-handle]')).toHaveLength(1)
    expect(handleIn('a')!.getAttribute('role')).toBe('separator')
    expect(handleIn('a')!.getAttribute('aria-orientation')).toBe('vertical')
    expect(handleIn('a')!.querySelector('[data-iris-pinned-drag-line]')).not.toBeNull()
    unmount()
    // Fail-closed: pinnedDrag off → no handle even with static pins.
    const off = render(<IrisTable columns={pinnedCols} data={rows} rowKey="id" />)
    expect(off.container.querySelectorAll('[data-iris-pinned-drag-handle]')).toHaveLength(0)
    off.unmount()
    // Fail-closed: pinnedDrag on but zero left pins → no boundary.
    const zero = render(<IrisTable columns={cols} data={rows} rowKey="id" pinnedDrag />)
    expect(zero.container.querySelectorAll('[data-iris-pinned-drag-handle]')).toHaveLength(0)
  })

  it('T2 drag right adjusts the pinned count — attrs + onPinnedCountChange once + per-column change', () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    const { container } = render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onColumnPinnedChange={onPinned}
        onPinnedCountChange={onCount}
      />,
    )
    // +200px past the 140px boundary → budget 340 → a+b (280) fit → count 2.
    dragPinHandle(140, 340)
    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('c').getAttribute('data-iris-table-pinned')).toBeNull()
    // a was already left → only b's per-column change fires.
    expect(onPinned).toHaveBeenCalledTimes(1)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledTimes(1)
    expect(onCount).toHaveBeenCalledWith(2)
    // The handle followed the boundary to b's trailing edge.
    expect(handleIn('b')).not.toBeNull()
    expect(container.querySelectorAll('[data-iris-pinned-drag-handle]')).toHaveLength(1)
  })

  it('T3 drag left unpins — both directions move the count', () => {
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B', pinned: 'left' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onPinnedCountChange={onCount}
      />,
    )
    // −200px from the 280px boundary → budget 80 → nothing fits → 0.
    dragPinHandle(280, 80)
    expect(onCount).toHaveBeenCalledWith(0)
    expect(header('a').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(document.querySelectorAll('[data-iris-pinned-drag-handle]')).toHaveLength(0)
  })

  it('T4 all-pinned clamp: dragging far right pins every column up to the cap', () => {
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onPinnedCountChange={onCount}
      />,
    )
    dragPinHandle(140, 100000)
    expect(onCount).toHaveBeenCalledWith(3)
    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('c').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(handleIn('c')).not.toBeNull()
  })

  it('T5 zero clamp: dragging far left unpins everything and removes the handle', () => {
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onPinnedCountChange={onCount}
      />,
    )
    dragPinHandle(140, -100000)
    expect(onCount).toHaveBeenCalledWith(0)
    expect(header('a').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(document.querySelectorAll('[data-iris-pinned-drag-handle]')).toHaveLength(0)
  })

  it('T6 no-op drag fires nothing: sub-column moves keep the count', () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onColumnPinnedChange={onPinned}
        onPinnedCountChange={onCount}
      />,
    )
    // +10px keeps the boundary inside a (140) — same count, zero callbacks.
    dragPinHandle(140, 150)
    expect(onPinned).not.toHaveBeenCalled()
    expect(onCount).not.toHaveBeenCalled()
    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(handleIn('a')).not.toBeNull()
  })

  it('T7 ghost: the handle translates with the pointer while dragging, resets on release', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(<IrisTable columns={pinnedCols} data={rows} rowKey="id" pinnedDrag />)
    act(() => {
      pinHandle().dispatchEvent(
        pointer('pointerdown', { button: 0, clientX: 140, clientY: 10, pointerId: 1 }),
      )
      pinHandle().dispatchEvent(pointer('pointermove', { clientX: 340, clientY: 10, pointerId: 1 }))
    })
    expect(pinHandle().getAttribute('data-iris-pinned-drag-active')).toBe('true')
    expect(pinHandle().style.transform).toBe('translateX(200px)')
    act(() => {
      pinHandle().dispatchEvent(pointer('pointerup', { clientX: 340, clientY: 10, pointerId: 1 }))
    })
    // Committed (count 2 → handle moved to b) and the ghost reset.
    expect(pinHandle().getAttribute('data-iris-pinned-drag-active')).toBeNull()
    expect(pinHandle().style.transform).toBe('')
  })

  it('T8 right-block clamp: the boundary never crosses the first right-pinned column', () => {
    const onCount = vi.fn()
    const rightCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C', pinned: 'right' },
    ]
    render(
      <IrisTable
        columns={rightCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onPinnedCountChange={onCount}
      />,
    )
    dragPinHandle(140, 100000)
    expect(onCount).toHaveBeenCalledWith(2) // cap = first right-pinned index
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('c').getAttribute('data-iris-table-pinned')).toBe('right')
  })

  it('T9 controlled: no optimistic flip — callbacks fire, the DOM follows only the parent', () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        pinnedDrag
        pinnedColumns={{ a: 'left' }}
        onColumnPinnedChange={onPinned}
        onPinnedCountChange={onCount}
      />,
    )
    dragPinHandle(140, 340)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onCount).toHaveBeenCalledWith(2)
    // Parent never wrote the map back → b still renders unpinned.
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(handleIn('a')).not.toBeNull()
  })

  it('T10 static-declaration seed: the handle exists with zero maps; unpinning writes an explicit null override', () => {
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onPinnedCountChange={onCount}
      />,
    )
    expect(handleIn('a')).not.toBeNull()
    // −60px → budget 80 < 140 → count 0: the explicit null must beat col.pinned.
    dragPinHandle(140, 80)
    expect(onCount).toHaveBeenCalledWith(0)
    expect(header('a').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('T11 keyboard: Arrow-Right/Arrow-Left nudge the count by one and clamp at both ends', () => {
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onPinnedCountChange={onCount}
      />,
    )
    act(() => fireEvent.keyDown(pinHandle(), { key: 'ArrowRight' }))
    expect(onCount).toHaveBeenCalledWith(2)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    act(() => fireEvent.keyDown(pinHandle(), { key: 'ArrowRight' }))
    expect(onCount).toHaveBeenCalledWith(3)
    expect(header('c').getAttribute('data-iris-table-pinned')).toBe('left')
    // All pinned → another ArrowRight is a no-op.
    act(() => fireEvent.keyDown(pinHandle(), { key: 'ArrowRight' }))
    expect(onCount).toHaveBeenCalledTimes(2)
    act(() => fireEvent.keyDown(pinHandle(), { key: 'ArrowLeft' }))
    expect(onCount).toHaveBeenCalledWith(2)
    expect(header('c').getAttribute('data-iris-table-pinned')).toBeNull()
    act(() => fireEvent.keyDown(pinHandle(), { key: 'ArrowLeft' }))
    expect(onCount).toHaveBeenCalledWith(1)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('T12 grouped headers: the boundary handle lives in the grouped leaf and drags the same way', () => {
    const onCount = vi.fn()
    const groupedCols: IrisTableColumn<Row>[] = [
      {
        key: 'person',
        title: 'Person',
        children: [
          { key: 'a', title: 'A', pinned: 'left' },
          { key: 'b', title: 'B' },
        ],
      },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={groupedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onPinnedCountChange={onCount}
      />,
    )
    expect(handleIn('a')).not.toBeNull()
    dragPinHandle(140, 340)
    expect(onCount).toHaveBeenCalledWith(2)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('person').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('T13 resizableColumns: the boundary handle coexists and suppresses the boundary resize grip', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    const { container } = render(
      <IrisTable columns={pinnedCols} data={rows} rowKey="id" pinnedDrag resizableColumns />,
    )
    expect(container.querySelectorAll('[data-iris-pinned-drag-handle]')).toHaveLength(1)
    // a is the boundary → its resize handle is suppressed; b and c keep theirs.
    expect(container.querySelectorAll('[data-iris-table-resize-handle]')).toHaveLength(2)
    expect(
      container.querySelector('[data-iris-table-resize-handle][data-column-key="a"]'),
    ).toBeNull()
    expect(
      container.querySelector('[data-iris-table-resize-handle][data-column-key="b"]'),
    ).not.toBeNull()
    // Without pinnedDrag the boundary resize handle returns.
    cleanup()
    const without = render(
      <IrisTable columns={pinnedCols} data={rows} rowKey="id" resizableColumns />,
    )
    expect(without.container.querySelectorAll('[data-iris-table-resize-handle]')).toHaveLength(3)
  })

  it('T14 columnDrag: pressing the pin handle never arms the column drag', () => {
    const onReorder = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    const { container } = render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        columnDrag={{ onReorder }}
      />,
    )
    act(() => {
      pinHandle().dispatchEvent(
        pointer('pointerdown', { button: 0, clientX: 140, clientY: 10, pointerId: 1 }),
      )
    })
    expect(container.querySelectorAll('[data-iris-col-drag-active]')).toHaveLength(0)
    act(() => {
      window.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 10, pointerId: 1 }))
    })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('T15 columnVirtualization: the boundary handle still renders and drags', () => {
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        columnVirtualization
        onPinnedCountChange={onCount}
      />,
    )
    expect(handleIn('a')).not.toBeNull()
    dragPinHandle(140, 340)
    expect(onCount).toHaveBeenCalledWith(2)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('T16 width-aware resolution: the drag budget uses the real column widths (not the 140 default)', () => {
    const onCount = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        defaultColumnWidths={{ a: 100, b: 200 }}
        onPinnedCountChange={onCount}
      />,
    )
    // +160px: real budget 100+160=260 < a+b=300 → count stays 1 (a 140-based
    // budget would be 140+160=300 and pin b — the discriminator).
    dragPinHandle(100, 260)
    expect(onCount).not.toHaveBeenCalled()
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    // +200px: budget exactly 300 → b joins.
    dragPinHandle(100, 300)
    expect(onCount).toHaveBeenCalledWith(2)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('T17 lead columns never count: seq/selection columns are excluded from the boundary math', () => {
    const onCount = vi.fn()
    const onPinned = vi.fn()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ]
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        seq
        onColumnPinnedChange={onPinned}
        onPinnedCountChange={onCount}
      />,
    )
    dragPinHandle(140, 100000)
    // 3 leaf columns, not 4 (the seq lead column is never part of the count).
    expect(onCount).toHaveBeenCalledWith(3)
    expect(onPinned.mock.calls.every(([key]) => ['a', 'b', 'c'].includes(key))).toBe(true)
    expect(header('__seq').getAttribute('data-iris-table-pinned')).toBeNull()
  })
})
