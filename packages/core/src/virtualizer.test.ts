import { describe, expect, it, vi } from 'vitest'
import { createVirtualizer } from './virtualizer'

describe('createVirtualizer — fixed estimate', () => {
  it('renders only the visible window (+buffer) of a huge list', () => {
    const v = createVirtualizer({ count: 100_000, estimateSize: 20, viewportSize: 100, buffer: 1 })
    const s = v.getState()
    // viewport 100 / 20px = items 0..4 fully cover it; +1 buffer below → endIndex 5
    expect(s.startIndex).toBe(0)
    expect(s.endIndex).toBe(5)
    expect(s.items).toHaveLength(6)
    expect(s.totalSize).toBe(100_000 * 20)
    expect(s.offsetBefore).toBe(0)
    expect(s.items[0]).toEqual({ index: 0, key: 0, start: 0, size: 20 })
  })

  it('windows around the scroll offset with correct offsetBefore', () => {
    const v = createVirtualizer({ count: 1000, estimateSize: 20, viewportSize: 100 })
    v.setScroll(500) // 500/20 = item 25 at top
    const s = v.getState()
    expect(s.startIndex).toBe(25)
    expect(s.offsetBefore).toBe(500)
    expect(s.items[0]?.start).toBe(500)
    // 5 visible rows from 25
    expect(s.endIndex).toBe(29)
  })

  it('clamps scroll to the max and never renders past the end', () => {
    const v = createVirtualizer({ count: 10, estimateSize: 20, viewportSize: 100 })
    v.setScroll(99999)
    const s = v.getState()
    expect(s.endIndex).toBe(9)
    // max scroll = total(200) - viewport(100) = 100 → first = 5
    expect(s.startIndex).toBe(5)
  })

  it('is empty when count is 0', () => {
    const v = createVirtualizer({ count: 0, estimateSize: 20, viewportSize: 100 })
    const s = v.getState()
    expect(s.items).toEqual([])
    expect(s.endIndex).toBe(-1)
    expect(s.totalSize).toBe(0)
  })
})

describe('createVirtualizer — measurement feedback', () => {
  it('measure(index,size) updates totalSize and item offsets incrementally', () => {
    const v = createVirtualizer({ count: 5, estimateSize: 20, viewportSize: 1000 })
    expect(v.totalSize()).toBe(100)
    v.measure(0, 50) // item 0 is now 50px instead of 20
    expect(v.totalSize()).toBe(130)
    const s = v.getState()
    // item 1's start shifts from 20 → 50
    expect(s.items[1]).toMatchObject({ index: 1, start: 50, size: 20 })
    expect(s.items[2]).toMatchObject({ index: 2, start: 70 })
  })

  it('does not emit when a measurement equals the current size', () => {
    const v = createVirtualizer({ count: 5, estimateSize: 20, viewportSize: 1000 })
    const listener = vi.fn()
    v.subscribe(listener)
    v.measure(0, 20) // same as estimate → no-op
    expect(listener).not.toHaveBeenCalled()
    v.measure(0, 40)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('remeasure() drops measured sizes back to the estimate', () => {
    const v = createVirtualizer({ count: 3, estimateSize: 20, viewportSize: 1000 })
    v.measure(0, 100)
    expect(v.totalSize()).toBe(140)
    v.remeasure()
    expect(v.totalSize()).toBe(60)
  })

  it('keeps measured sizes attached to keys across a reorder (setCount rebuild)', () => {
    const order = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const v = createVirtualizer({
      count: 3,
      estimateSize: 20,
      viewportSize: 1000,
      getItemKey: (i) => order[i]!.id,
    })
    v.measure(0, 100) // measure 'a' (at index 0) as 100px
    expect(v.getState().items[0]).toMatchObject({ key: 'a', size: 100 })
    // reorder: move 'a' to the end
    order.reverse() // c, b, a
    v.setCount(3) // re-seat measured sizes onto new positions
    const s = v.getState()
    expect(s.items.map((it) => it.key)).toEqual(['c', 'b', 'a'])
    // 'a' kept its measured 100px even though it's now at index 2
    expect(s.items[2]).toMatchObject({ key: 'a', size: 100 })
    expect(s.items[0]).toMatchObject({ key: 'c', size: 20 })
  })
})

describe('createVirtualizer — variable estimate function', () => {
  it('supports a per-index estimate', () => {
    const v = createVirtualizer({
      count: 4,
      estimateSize: (i) => (i % 2 === 0 ? 10 : 30),
      viewportSize: 1000,
    })
    expect(v.totalSize()).toBe(10 + 30 + 10 + 30)
    const s = v.getState()
    expect(s.items.map((it) => it.start)).toEqual([0, 10, 40, 50])
  })
})

describe('createVirtualizer — scrollToIndex / scrollToOffset', () => {
  it('scrollToIndex(start) returns the item top, clamped', () => {
    const v = createVirtualizer({ count: 100, estimateSize: 20, viewportSize: 100 })
    expect(v.scrollToIndex(10, 'start')).toBe(200) // item 10 top = 200
    expect(v.getState().startIndex).toBe(10)
  })

  it('scrollToIndex(end) aligns the item to the viewport bottom', () => {
    const v = createVirtualizer({ count: 100, estimateSize: 20, viewportSize: 100 })
    // item 10 at [200,220); end-align → 220 - 100 = 120
    expect(v.scrollToIndex(10, 'end')).toBe(120)
  })

  it('scrollToIndex clamps at the list end', () => {
    const v = createVirtualizer({ count: 10, estimateSize: 20, viewportSize: 100 })
    // max scroll = 200 - 100 = 100
    expect(v.scrollToIndex(9, 'start')).toBe(100)
  })

  it('scrollToOffset clamps and applies', () => {
    const v = createVirtualizer({ count: 10, estimateSize: 20, viewportSize: 100 })
    expect(v.scrollToOffset(-50)).toBe(0)
    expect(v.scrollToOffset(99999)).toBe(100)
  })
})

describe('createVirtualizer — growth + viewport', () => {
  it('setCount grows the list (infinite append)', () => {
    const v = createVirtualizer({ count: 5, estimateSize: 20, viewportSize: 1000 })
    expect(v.totalSize()).toBe(100)
    v.setCount(10)
    expect(v.totalSize()).toBe(200)
    expect(v.getState().endIndex).toBe(9)
  })

  it('setViewportSize re-windows', () => {
    const v = createVirtualizer({ count: 100, estimateSize: 20, viewportSize: 40 })
    expect(v.getState().endIndex).toBe(1) // 40/20 = 2 rows
    v.setViewportSize(200)
    expect(v.getState().endIndex).toBe(9) // 200/20 = 10 rows
  })
})
