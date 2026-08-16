import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
}

const rows: Row[] = [{ id: 1, a: 'x', b: 'y', c: 'z' }]

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

describe('@iris-ui-kit/react IrisTable pinned-count boundary drag — gapped-state regression (batch CV review Finding 1)', () => {
  it('T18 gapped pins [A(left), B(null), C(left)]: a zero-dx click resolves the leading prefix count — no-op fires nothing', () => {
    const onPinned = vi.fn()
    const onCount = vi.fn()
    const gappedCols: IrisTableColumn<Row>[] = [
      { key: 'a', title: 'A', pinned: 'left' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C', pinned: 'left' },
    ]
    render(
      <IrisTable
        columns={gappedCols}
        data={rows}
        rowKey="id"
        pinnedDrag
        onColumnPinnedChange={onPinned}
        onPinnedCountChange={onCount}
      />,
    )
    // The handle sits on the LAST left-pinned leaf (c) although the leading
    // prefix count is 1. Pre-fix resolve(0) summed a+c → 2 ≠ 1 → the zero-dx
    // click pinned b, unpinned c and fired both callbacks. Post-fix: no-op.
    expect(header('c').querySelector('[data-iris-pinned-drag-handle]')).not.toBeNull()
    const el = header('c').querySelector('[data-iris-pinned-drag-handle]') as HTMLElement
    const base = { button: 0, clientX: 280, clientY: 10, pointerId: 1 }
    act(() => {
      el.dispatchEvent(pointer('pointerdown', base))
      el.dispatchEvent(pointer('pointermove', base))
      el.dispatchEvent(pointer('pointerup', base))
    })
    expect(onPinned).not.toHaveBeenCalled()
    expect(onCount).not.toHaveBeenCalled()
    expect(header('a').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('b').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header('c').getAttribute('data-iris-table-pinned')).toBe('left')
  })
})
