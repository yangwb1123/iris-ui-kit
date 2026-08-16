import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
}

const rows: Row[] = [
  { id: 1, a: 'x', b: 'y', c: 'z' },
  { id: 2, a: 'x2', b: 'y2', c: 'z2' },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B' },
  { key: 'c', title: 'C' },
]

/** Native pointer construction (jsdom may lack PointerEvent — see useDrag.test). */
const makePointer = (type: string, init: Record<string, unknown>): Event => {
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

const headerKeys = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-iris-table-header]')].map((el) =>
    el.getAttribute('data-iris-table-header'),
  )

/** jsdom getBoundingClientRect returns zeros, so every closestCenter would
 * resolve to the FIRST header — give the headers real rects (left: i*100,
 * width 100) so the in-band reorder tests are meaningful. */
const stubHeaderRects = (container: HTMLElement): void => {
  ;[...container.querySelectorAll('[data-iris-table-header]')].forEach((el, i) => {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: i * 100,
      top: 0,
      width: 100,
      height: 30,
      right: (i + 1) * 100,
      bottom: 30,
      x: i * 100,
      y: 0,
      toJSON: () => ({}),
    })
  })
}

/** Press `from`'s header + one pointermove (activates the drag past the
 * threshold and collects rects). Returns the table root for further events. */
const startDrag = (
  container: HTMLElement,
  from: string,
  pressX: number,
  moveX: number,
): HTMLElement => {
  const table = container.querySelector('[data-iris-table]') as HTMLElement
  act(() => {
    header(from).dispatchEvent(
      makePointer('pointerdown', { button: 0, clientX: pressX, clientY: 10 }),
    )
    table.dispatchEvent(makePointer('pointermove', { clientX: moveX, clientY: 20 }))
  })
  return table
}

/** Release OUTSIDE the table (window-level pointerup at clientX < root's
 * left edge — jsdom root rects are all zeros, so any negative x is left). */
const releaseOutside = (x: number): void => {
  act(() => {
    window.dispatchEvent(makePointer('pointerup', { clientX: x, clientY: 20 }))
  })
}

/** Release INSIDE the table (bubbles to the root handler, then window). */
const releaseInside = (table: HTMLElement, x: number): void => {
  act(() => {
    table.dispatchEvent(makePointer('pointerup', { clientX: x, clientY: 20 }))
  })
}

describe('IrisTable columnDrag drag-out pin (batch CH, iris 独有 — vxe has none)', () => {
  it('T1 controlled: dragging a header past the left edge pins it left + fires the callback, no reorder', () => {
    const onReorder = vi.fn()
    const onPinned = vi.fn()
    const Harness = (): React.ReactElement => {
      const [pinned, setPinned] = React.useState<Record<string, 'left' | 'right' | null>>({})
      return (
        <IrisTable
          columns={cols}
          data={rows}
          rowKey="id"
          columnDrag={{ onReorder }}
          columnPinMenu
          pinnedColumns={pinned}
          onColumnPinnedChange={(key, side) => {
            onPinned(key, side)
            setPinned((p) => ({ ...p, [key]: side }))
          }}
        />
      )
    }
    const { container } = render(<Harness />)
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    releaseOutside(-50)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onReorder).not.toHaveBeenCalled()
    // Parent applied the pin → the column renders sticky left.
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('b').style.position).toBe('sticky')
    expect(header('b').style.left).toBe('0px')
    expect(header('a').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(headerKeys(container)).toEqual(['a', 'b', 'c'])
  })

  it('T2 uncontrolled: the drag-out pin lands in the internal map (no callback needed)', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} columnPinMenu />,
    )
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    releaseOutside(-50)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('b').style.position).toBe('sticky')
    expect(header('b').style.left).toBe('0px')
    expect(
      container
        .querySelector('[data-iris-table-row="1"] [data-iris-table-cell="b"]')!
        .getAttribute('data-iris-table-pinned'),
    ).toBe('left')
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('T3 fail-closed: columnDrag WITHOUT columnPinMenu never pins on a drag-out', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    // No window listener exists in this config — the outside release resolves nothing.
    releaseOutside(-50)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('T4 fail-closed: columnPinMenu WITHOUT columnDrag never starts a drag', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" columnPinMenu />)
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    releaseOutside(-50)
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(container.querySelectorAll('[data-iris-col-drag-active]')).toHaveLength(0)
  })

  it('T5 already-left is a no-op: no callback, no reorder, pin stays', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B', pinned: 'left' },
      { key: 'c', title: 'C' },
    ]
    const onReorder = vi.fn()
    const onPinned = vi.fn()
    const { container } = render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
        columnPinMenu
        onColumnPinnedChange={onPinned}
      />,
    )
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    releaseOutside(-50)
    expect(onPinned).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('T6 right→left: dragging a right-pinned column out left flips it to left', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B', pinned: 'right' },
      { key: 'c', title: 'C' },
    ]
    const onReorder = vi.fn()
    const onPinned = vi.fn()
    const { container } = render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
        columnPinMenu
        onColumnPinnedChange={onPinned}
      />,
    )
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    releaseOutside(-50)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    expect(onReorder).not.toHaveBeenCalled()
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('b').style.position).toBe('sticky')
  })

  it('T7 in-band drop still reorders (gated config keeps the reorder path)', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} columnPinMenu />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', 10, 250)
    releaseInside(table, 250)
    expect(onReorder).toHaveBeenCalled()
    const next = onReorder.mock.calls[0][0] as { key: string }[]
    expect(next.map((c) => c.key)).toEqual(['b', 'c', 'a'])
  })

  it('T8 same-column drop: no reorder, no pin', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} columnPinMenu />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', 10, 60)
    releaseInside(table, 60)
    expect(onReorder).not.toHaveBeenCalled()
    expect(header('a').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('T9 window pointerup resolves an outside release (no stuck activeId)', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder: vi.fn() }}
        columnPinMenu
      />,
    )
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    // Drag is active while the pointer is outside the root.
    expect(header('b').getAttribute('data-iris-col-drag-active')).toBe('true')
    releaseOutside(-50)
    // Resolved: pinned + the controller is back to idle (no stuck highlight).
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(container.querySelectorAll('[data-iris-col-drag-active]')).toHaveLength(0)
  })

  it('T10 tap (press + release without a move) cancels: no pin, no reorder', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} columnPinMenu />,
    )
    stubHeaderRects(container)
    const table = container.querySelector('[data-iris-table]') as HTMLElement
    act(() => {
      header('a').dispatchEvent(makePointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }))
    })
    releaseInside(table, 10)
    expect(onReorder).not.toHaveBeenCalled()
    expect(header('a').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(container.querySelectorAll('[data-iris-col-drag-active]')).toHaveLength(0)
  })

  it('T11 window pointercancel aborts the drag: no pin, no reorder, no stuck', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" columnDrag={{ onReorder }} columnPinMenu />,
    )
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    expect(header('b').getAttribute('data-iris-col-drag-active')).toBe('true')
    act(() => {
      window.dispatchEvent(makePointer('pointercancel', {}))
    })
    expect(onReorder).not.toHaveBeenCalled()
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(container.querySelectorAll('[data-iris-col-drag-active]')).toHaveLength(0)
  })

  it('T12 controlled: no optimistic flip — only the callback fires', () => {
    const onReorder = vi.fn()
    const onPinned = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
        columnPinMenu
        pinnedColumns={{}}
        onColumnPinnedChange={onPinned}
      />,
    )
    stubHeaderRects(container)
    startDrag(container, 'b', 110, 150)
    releaseOutside(-50)
    expect(onPinned).toHaveBeenCalledWith('b', 'left')
    // Parent never wrote the map back → the table still renders unpinned.
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('T13 grouped headers: the dragged LEAF pins; group cells stay unpinned', () => {
    const groupedCols: IrisTableColumn<Row>[] = [
      {
        key: 'person',
        title: 'Person',
        children: [
          { key: 'a', title: 'A' },
          { key: 'b', title: 'B' },
        ],
      },
      { key: 'c', title: 'C' },
    ]
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={groupedCols}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
        columnPinMenu
      />,
    )
    stubHeaderRects(container)
    startDrag(container, 'a', 110, 150)
    releaseOutside(-50)
    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('a').style.position).toBe('sticky')
    expect(header('person').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
  })
})
