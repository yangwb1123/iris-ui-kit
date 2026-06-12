import { describe, it, expect, vi } from 'vitest'
import { createSortable, closestCenter, type SortableRect } from './sortable'

// A 3-cell horizontal strip: ids 'a' (x 0-10), 'b' (x 20-30), 'c' (x 40-50),
// all 10×10 so the centers sit at x = 5, 25, 45 (y = 5).
const STRIP: SortableRect[] = [
  { id: 'a', left: 0, top: 0, width: 10, height: 10 },
  { id: 'b', left: 20, top: 0, width: 10, height: 10 },
  { id: 'c', left: 40, top: 0, width: 10, height: 10 },
]

describe('closestCenter', () => {
  it('returns null when there are no targets', () => {
    expect(closestCenter({ x: 5, y: 5 }, [])).toBeNull()
  })

  it('returns the only target regardless of distance', () => {
    expect(closestCenter({ x: 999, y: 999 }, [STRIP[0]!])).toBe('a')
  })

  it('picks the target whose center is nearest the point', () => {
    expect(closestCenter({ x: 6, y: 5 }, STRIP)).toBe('a')
    expect(closestCenter({ x: 24, y: 5 }, STRIP)).toBe('b')
    expect(closestCenter({ x: 50, y: 5 }, STRIP)).toBe('c')
  })

  it('uses 2D distance, not just the x axis', () => {
    const grid: SortableRect[] = [
      { id: 'top', left: 0, top: 0, width: 10, height: 10 },
      { id: 'bottom', left: 0, top: 100, width: 10, height: 10 },
    ]
    expect(closestCenter({ x: 5, y: 90 }, grid)).toBe('bottom')
    expect(closestCenter({ x: 5, y: 10 }, grid)).toBe('top')
  })

  it('resolves ties to the earliest target in the list', () => {
    const tied: SortableRect[] = [
      { id: 'first', left: 0, top: 0, width: 10, height: 10 },
      { id: 'second', left: 0, top: 0, width: 10, height: 10 },
    ]
    expect(closestCenter({ x: 5, y: 5 }, tied)).toBe('first')
  })
})

describe('createSortable', () => {
  it('starts idle', () => {
    const s = createSortable()
    expect(s.getState()).toEqual({ activeId: null, overId: null })
    expect(s.isActive('a')).toBe(false)
    expect(s.isOver('a')).toBe(false)
  })

  it('start sets activeId and clears any stale overId', () => {
    const s = createSortable()
    s.start('card-1')
    s.over('col-2')
    s.start('card-9')
    expect(s.getState()).toEqual({ activeId: 'card-9', overId: null })
    expect(s.isActive('card-9')).toBe(true)
  })

  it('over sets the drop target while dragging', () => {
    const s = createSortable()
    s.start('card-1')
    s.over('col-2')
    expect(s.getState()).toEqual({ activeId: 'card-1', overId: 'col-2' })
    expect(s.isOver('col-2')).toBe(true)
  })

  it('over is ignored when idle (no active drag)', () => {
    const s = createSortable()
    s.over('col-2')
    expect(s.getState()).toEqual({ activeId: null, overId: null })
  })

  it('moveOver computes closestCenter and stores it as overId', () => {
    const s = createSortable()
    s.start('card-1')
    const id = s.moveOver({ x: 24, y: 5 }, STRIP)
    expect(id).toBe('b')
    expect(s.getState().overId).toBe('b')
  })

  it('moveOver returns the id but does not set overId when idle', () => {
    const s = createSortable()
    const id = s.moveOver({ x: 24, y: 5 }, STRIP)
    expect(id).toBe('b')
    expect(s.getState().overId).toBeNull()
  })

  it('end returns the resolved move and resets to idle', () => {
    const s = createSortable()
    s.start('card-1')
    s.over('col-2')
    const resolved = s.end()
    expect(resolved).toEqual({ activeId: 'card-1', overId: 'col-2' })
    expect(s.getState()).toEqual({ activeId: null, overId: null })
  })

  it('cancel resets to idle without resolving', () => {
    const s = createSortable()
    s.start('card-1')
    s.over('col-2')
    s.cancel()
    expect(s.getState()).toEqual({ activeId: null, overId: null })
  })

  it('notifies subscribers on state change and stops after unsubscribe', () => {
    const s = createSortable()
    const cb = vi.fn()
    const unsubscribe = s.subscribe(cb)
    s.start('card-1')
    s.over('col-2')
    expect(cb).toHaveBeenCalledTimes(2)
    unsubscribe()
    s.end()
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('does not re-notify when over is set to the same target', () => {
    const s = createSortable()
    s.start('card-1')
    const cb = vi.fn()
    s.subscribe(cb)
    s.over('col-2')
    s.over('col-2')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('press records a pending drag WITHOUT touching the store or notifying', () => {
    const s = createSortable()
    const cb = vi.fn()
    s.subscribe(cb)
    s.press('card-1', 10, 10)
    expect(s.isPending()).toBe(true)
    expect(s.getState()).toEqual({ activeId: null, overId: null })
    expect(cb).not.toHaveBeenCalled()
  })

  it('tryStart stays pending below the threshold, promotes once past it', () => {
    const s = createSortable()
    s.press('card-1', 0, 0)
    expect(s.tryStart(2, 2)).toBe(false) // within default 4px
    expect(s.isPending()).toBe(true)
    expect(s.getState().activeId).toBeNull()
    expect(s.tryStart(10, 0)).toBe(true) // crossed threshold
    expect(s.isActive('card-1')).toBe(true)
    expect(s.isPending()).toBe(false)
    expect(s.tryStart(20, 0)).toBe(false) // already promoted → no repeat
  })

  it('tryStart honors a custom threshold', () => {
    const s = createSortable()
    s.press('c', 0, 0)
    expect(s.tryStart(8, 0, 12)).toBe(false)
    expect(s.tryStart(13, 0, 12)).toBe(true)
  })

  it('a press→cancel tap causes NO notification (store stays idle)', () => {
    const s = createSortable()
    const cb = vi.fn()
    s.subscribe(cb)
    s.press('card-1', 5, 5)
    s.cancel()
    expect(cb).not.toHaveBeenCalled()
    expect(s.isPending()).toBe(false)
    expect(s.getState()).toEqual({ activeId: null, overId: null })
  })

  it('start() clears a pending press', () => {
    const s = createSortable()
    s.press('card-1', 0, 0)
    s.start('card-2')
    expect(s.isPending()).toBe(false)
    expect(s.isActive('card-2')).toBe(true)
  })

  it('cancel() does not notify when already idle', () => {
    const s = createSortable()
    const cb = vi.fn()
    s.subscribe(cb)
    s.cancel()
    expect(cb).not.toHaveBeenCalled()
  })
})
