import { describe, it, expect, vi } from 'vitest'
import { createCellRange } from './cell-range'

describe('createCellRange', () => {
  it('starts with no selection', () => {
    const cr = createCellRange()
    expect(cr.getState()).toEqual({ anchor: null, active: null })
    expect(cr.getRange()).toBeNull()
    expect(cr.isInRange(0, 0)).toBe(false)
  })

  it('startRange sets both anchor and active to the same cell', () => {
    const cr = createCellRange()
    cr.startRange(2, 3)
    expect(cr.getState()).toEqual({ anchor: { row: 2, col: 3 }, active: { row: 2, col: 3 } })
    expect(cr.getRange()).toEqual({ start: { row: 2, col: 3 }, end: { row: 2, col: 3 } })
  })

  it('isInRange returns true for the single anchor cell', () => {
    const cr = createCellRange()
    cr.startRange(1, 2)
    expect(cr.isInRange(1, 2)).toBe(true)
    expect(cr.isInRange(0, 2)).toBe(false)
    expect(cr.isInRange(1, 3)).toBe(false)
  })

  it('extendRange moves active while anchor stays fixed', () => {
    const cr = createCellRange()
    cr.startRange(0, 0)
    cr.extendRange(3, 4)
    const s = cr.getState()
    expect(s.anchor).toEqual({ row: 0, col: 0 })
    expect(s.active).toEqual({ row: 3, col: 4 })
  })

  it('isInRange covers the full rectangle after extendRange', () => {
    const cr = createCellRange()
    cr.startRange(1, 1)
    cr.extendRange(3, 4)
    // Corners
    expect(cr.isInRange(1, 1)).toBe(true)
    expect(cr.isInRange(3, 4)).toBe(true)
    // Interior
    expect(cr.isInRange(2, 2)).toBe(true)
    expect(cr.isInRange(1, 4)).toBe(true)
    // Just outside
    expect(cr.isInRange(0, 1)).toBe(false)
    expect(cr.isInRange(1, 0)).toBe(false)
    expect(cr.isInRange(4, 4)).toBe(false)
    expect(cr.isInRange(3, 5)).toBe(false)
  })

  it('isInRange handles inverted (drag up-left from anchor)', () => {
    const cr = createCellRange()
    // Anchor at bottom-right, extend to top-left
    cr.startRange(5, 5)
    cr.extendRange(2, 1)
    // Normalized: start (2,1) → end (5,5)
    expect(cr.isInRange(2, 1)).toBe(true)
    expect(cr.isInRange(5, 5)).toBe(true)
    expect(cr.isInRange(3, 3)).toBe(true)
    expect(cr.isInRange(1, 1)).toBe(false)
    expect(cr.isInRange(6, 5)).toBe(false)
    expect(cr.getRange()).toEqual({ start: { row: 2, col: 1 }, end: { row: 5, col: 5 } })
  })

  it('clearRange resets to null', () => {
    const cr = createCellRange()
    cr.startRange(1, 1)
    cr.extendRange(3, 3)
    cr.clearRange()
    expect(cr.getState()).toEqual({ anchor: null, active: null })
    expect(cr.getRange()).toBeNull()
    expect(cr.isInRange(2, 2)).toBe(false)
  })

  it('extendRange without prior startRange treats target as anchor', () => {
    const cr = createCellRange()
    cr.extendRange(4, 4)
    expect(cr.getState()).toEqual({ anchor: { row: 4, col: 4 }, active: { row: 4, col: 4 } })
    expect(cr.isInRange(4, 4)).toBe(true)
  })

  it('startRange after extendRange resets anchor to the new cell', () => {
    const cr = createCellRange()
    cr.startRange(0, 0)
    cr.extendRange(5, 5)
    cr.startRange(2, 2)
    expect(cr.getState()).toEqual({ anchor: { row: 2, col: 2 }, active: { row: 2, col: 2 } })
    expect(cr.isInRange(0, 0)).toBe(false)
    expect(cr.isInRange(2, 2)).toBe(true)
  })

  it('subscribe fires on every state change', () => {
    const cr = createCellRange()
    const cb = vi.fn()
    const unsub = cr.subscribe(cb)
    cr.startRange(1, 1)
    cr.extendRange(2, 2)
    cr.clearRange()
    expect(cb).toHaveBeenCalledTimes(3)
    unsub()
    cr.startRange(0, 0)
    // Unsubscribed — no more calls
    expect(cb).toHaveBeenCalledTimes(3)
  })
})
