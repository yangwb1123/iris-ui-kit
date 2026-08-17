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
  { id: 1, a: 'x', b: 'y', c: 'z', d: 'w' },
  { id: 2, a: 'x2', b: 'y2', c: 'z2', d: 'w2' },
]

const cols = (pins: Record<string, 'left' | 'right' | undefined>): IrisTableColumn<Row>[] =>
  ['a', 'b', 'c', 'd'].map((key) => ({
    key,
    title: key.toUpperCase(),
    ...(pins[key] ? { pinned: pins[key] } : {}),
  }))

/** [A(left), B(left), C] — two left-pinned + one free. */
const left2 = (): IrisTableColumn<Row>[] => cols({ a: 'left', b: 'left' }).slice(0, 3)
/** [A, B, C(right), D(right)] — two right-pinned + two free. */
const right2 = (): IrisTableColumn<Row>[] => cols({ c: 'right', d: 'right' })
/** [A(left), B, C, D(right)] — one left + two free + one right. */
const sandwich = (): IrisTableColumn<Row>[] => cols({ a: 'left', d: 'right' })
/** [A(left), B] — a single left-pinned column. */
const loneLeft = (): IrisTableColumn<Row>[] => cols({ a: 'left' }).slice(0, 2)
/** [A, B, C(right)] — a single right-pinned column. */
const loneRight = (): IrisTableColumn<Row>[] => cols({ c: 'right' }).slice(0, 3)

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
 * width 100) so the drag targets are meaningful. Grouped headers carry the
 * attr too, so `centerOf` resolves targets by the SAME DOM order. */
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

/** The clientX of `key`'s header center (index in the stubbed rect order). */
const centerOf = (key: string): number => {
  const els = [...document.querySelectorAll('[data-iris-table-header]')]
  const i = els.findIndex((el) => el.getAttribute('data-iris-table-header') === key)
  return i * 100 + 50
}

/** Press `from`'s header + one pointermove (activates the drag past the
 * threshold and collects rects). Returns the table root for further events. */
const startDrag = (container: HTMLElement, from: string, targetX: number): HTMLElement => {
  const table = container.querySelector('[data-iris-table]') as HTMLElement
  act(() => {
    header(from).dispatchEvent(
      makePointer('pointerdown', { button: 0, clientX: centerOf(from) - 10, clientY: 10 }),
    )
    table.dispatchEvent(makePointer('pointermove', { clientX: targetX, clientY: 20 }))
  })
  return table
}

/** Release INSIDE the table (bubbles to the root handler, then window). */
const releaseInside = (table: HTMLElement, x: number): void => {
  act(() => {
    table.dispatchEvent(makePointer('pointerup', { clientX: x, clientY: 20 }))
  })
}

/** Release OUTSIDE the table (window-level pointerup at clientX < root's
 * left edge — jsdom root rects are all zeros, so any negative x is left). */
const releaseOutside = (x: number): void => {
  act(() => {
    window.dispatchEvent(makePointer('pointerup', { clientX: x, clientY: 20 }))
  })
}

const payloadKeys = (fn: ReturnType<typeof vi.fn>): string[] =>
  (fn.mock.calls[0][0] as { key: string }[]).map((c) => c.key)

const zonesOf = (cols: IrisTableColumn<Row>[]): (string | null)[] =>
  cols.map((c) => c.pinned ?? null)

describe('IrisTable columnDrag frozen-zone clamp (batch DC, iris 独有 — vxe has no frozen-zone reorder)', () => {
  it('T1 left-zone intra-reorder: a left-pinned column swaps with its left-pinned sibling', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={left2()} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('b'))
    releaseInside(table, centerOf('b'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['b', 'a', 'c'])
  })

  it('T2 cross-zone clamp: a free column dropped over the left zone clamps to the free-zone start', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={sandwich()} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'c', centerOf('a'))
    releaseInside(table, centerOf('a'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['a', 'c', 'b', 'd'])
    // The reordered columns keep their pin zones — [left][free][right] intact.
    expect(zonesOf(onReorder.mock.calls[0][0] as IrisTableColumn<Row>[])).toEqual([
      'left',
      null,
      null,
      'right',
    ])
  })

  it('T3 cross-zone clamp: a left column dropped over the right zone clamps to the left-zone end', () => {
    const onReorder = vi.fn()
    // [A(left), B(left), C, D] — the left zone spans [0..1], the drop lands
    // over D beyond it, so A clamps to the left-zone end (index 1).
    const four = left2().concat(cols({}).slice(3))
    const { container } = render(
      <IrisTable columns={four} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('d'))
    releaseInside(table, centerOf('d'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['b', 'a', 'c', 'd'])
  })

  it('T4 right-zone intra-reorder: a right-pinned column swaps with its right-pinned sibling', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={right2()} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'c', centerOf('d'))
    releaseInside(table, centerOf('d'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['a', 'b', 'd', 'c'])
  })

  it('T5 cross-zone clamp: a lone left pin dropped over the free zone is a net-zero no-op', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={loneLeft()} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('b'))
    releaseInside(table, centerOf('b'))
    expect(onReorder).not.toHaveBeenCalled()
    expect(headerKeys(container)).toEqual(['a', 'b'])
    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('T6 no-pin regression: a zero-pin table drag is byte-identical to the vxe reorder', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols({}).slice(0, 3)}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
      />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('c'))
    releaseInside(table, centerOf('c'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['b', 'c', 'a'])
  })

  it('T7 free-zone intra-reorder: free columns between pins reorder among themselves', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={sandwich()} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'b', centerOf('c'))
    releaseInside(table, centerOf('c'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('T8 net-zero clamp no-call: the last left column dropped over the right zone never fires', () => {
    const onReorder = vi.fn()
    // [A(left), B(left), C, D(right)] — B is the last left column; dropping it
    // over the right zone clamps back onto itself (net-zero) → no call.
    const { container } = render(
      <IrisTable
        columns={cols({ a: 'left', b: 'left', d: 'right' })}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
      />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'b', centerOf('d'))
    releaseInside(table, centerOf('d'))
    expect(onReorder).not.toHaveBeenCalled()
    expect(headerKeys(container)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('T9 clamped commit: the callback receives the clamped array and the DOM follows when the parent applies it', () => {
    const Harness = (): React.ReactElement => {
      const [state, setState] = React.useState<IrisTableColumn<Row>[]>(
        left2().concat(cols({}).slice(3)),
      )
      return (
        <IrisTable
          columns={state}
          data={rows}
          rowKey="id"
          columnDrag={{ onReorder: (next) => setState(next as IrisTableColumn<Row>[]) }}
        />
      )
    }
    const { container } = render(<Harness />)
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('d'))
    releaseInside(table, centerOf('d'))
    // The clamp landed A at the left-zone end — never past the free zone.
    expect(headerKeys(container)).toEqual(['b', 'a', 'c', 'd'])
  })

  it('T10 cross-zone clamp: a lone right pin dropped over the free zone is a net-zero no-op', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable columns={loneRight()} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'c', centerOf('a'))
    releaseInside(table, centerOf('a'))
    expect(onReorder).not.toHaveBeenCalled()
    expect(headerKeys(container)).toEqual(['a', 'b', 'c'])
    expect(header('c').getAttribute('data-iris-table-pinned')).toBe('right')
  })

  it('T11 controlled + no onColumnPinnedChange: an in-zone reorder fires onReorder only (pin channel untouched)', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisTable
        columns={left2()}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
        pinnedColumns={{ a: 'left', b: 'left' }}
      />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('b'))
    releaseInside(table, centerOf('b'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['b', 'a', 'c'])
    // No pin callback exists, and the controlled pins are untouched.
    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('b').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('T12 grouped leaves: the frozen-zone clamp runs on the LEAF array', () => {
    const onReorder = vi.fn()
    const groupedCols: IrisTableColumn<Row>[] = [
      {
        key: 'person',
        title: 'Person',
        children: [
          { key: 'a', title: 'A', pinned: 'left' },
          { key: 'b', title: 'B', pinned: 'left' },
        ],
      },
      { key: 'c', title: 'C' },
    ]
    const { container } = render(
      <IrisTable columns={groupedCols} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('b'))
    releaseInside(table, centerOf('b'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['b', 'a', 'c'])
  })

  it('T13 gapped state: [A(left), B, C(left), D] — a same-span drop passes through as-is', () => {
    const onReorder = vi.fn()
    const gapped: IrisTableColumn<Row>[] = cols({ a: 'left', c: 'left' })
    const { container } = render(
      <IrisTable columns={gapped} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'a', centerOf('b'))
    releaseInside(table, centerOf('b'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder)).toEqual(['b', 'a', 'c', 'd'])
    // Both left pins survived the reorder.
    expect(zonesOf(onReorder.mock.calls[0][0] as IrisTableColumn<Row>[])).toEqual([
      null,
      'left',
      'left',
      null,
    ])
  })

  it('T14 CH regression: the drag-out pin still pins (no reorder) and an in-band zone drop still reorders with columnPinMenu on', () => {
    // Drag-out side: release outside the LEFT edge pins, never reorders.
    const onReorder = vi.fn()
    const onPinned = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols({}).slice(0, 3)}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder }}
        columnPinMenu
        onColumnPinnedChange={onPinned}
      />,
    )
    stubHeaderRects(container)
    startDrag(container, 'c', centerOf('c'))
    releaseOutside(-50)
    expect(onPinned).toHaveBeenCalledWith('c', 'left')
    expect(onReorder).not.toHaveBeenCalled()
    expect(header('c').getAttribute('data-iris-table-pinned')).toBe('left')
    cleanup()

    // In-band side: the menu config keeps the clamped reorder path alive.
    const onReorder2 = vi.fn()
    const { container: c2 } = render(
      <IrisTable
        columns={left2()}
        data={rows}
        rowKey="id"
        columnDrag={{ onReorder: onReorder2 }}
        columnPinMenu
      />,
    )
    stubHeaderRects(c2)
    const table = startDrag(c2, 'a', centerOf('b'))
    releaseInside(table, centerOf('b'))
    expect(onReorder2).toHaveBeenCalledTimes(1)
    expect(payloadKeys(onReorder2)).toEqual(['b', 'a', 'c'])
  })

  it('T15 cross-zone clamp: a right column dropped over the free zone clamps to the right-zone start', () => {
    const onReorder = vi.fn()
    const five: IrisTableColumn<Row>[] = [
      ...cols({}).slice(0, 3),
      { key: 'd', title: 'D', pinned: 'right' },
      { key: 'e', title: 'E', pinned: 'right' },
    ]
    const { container } = render(
      <IrisTable columns={five} data={rows} rowKey="id" columnDrag={{ onReorder }} />,
    )
    stubHeaderRects(container)
    const table = startDrag(container, 'e', centerOf('b'))
    releaseInside(table, centerOf('b'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    // E clamps to the right-zone start (index 3) — never into the free zone.
    expect(payloadKeys(onReorder)).toEqual(['a', 'b', 'c', 'e', 'd'])
    expect(zonesOf(onReorder.mock.calls[0][0] as IrisTableColumn<Row>[])).toEqual([
      null,
      null,
      null,
      'right',
      'right',
    ])
  })
})
