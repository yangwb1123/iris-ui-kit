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

describe('createVirtualizer — replaceData', () => {
  it('clears measured sizes and uses estimates for new data', () => {
    const v = createVirtualizer({ count: 3, estimateSize: 20, viewportSize: 1000 })
    v.measure(0, 100)
    v.measure(1, 50)
    expect(v.totalSize()).toBe(100 + 50 + 20)
    v.replaceData(5) // replace with 5 new items
    expect(v.totalSize()).toBe(5 * 20) // all estimates
    expect(v.getState().endIndex).toBe(4)
  })

  it('retains scroll position after replaceData (within bounds)', () => {
    const v = createVirtualizer({ count: 100, estimateSize: 20, viewportSize: 100 })
    v.setScroll(500)
    v.replaceData(10) // smaller dataset
    const s = v.getState()
    // max scroll for 10 items = 200 - 100 = 100
    expect(s.startIndex).toBe(5) // clamped to 100/20 = 5
  })

  it('replaceData differs from setCount — setCount preserves keyed measurements', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const v = createVirtualizer({
      count: 3,
      estimateSize: 20,
      viewportSize: 1000,
      getItemKey: (i) => items[i]!.id,
    })
    v.measure(0, 100) // measure 'a' as 100
    expect(v.totalSize()).toBe(100 + 20 + 20)

    // replaceData: clear all
    // We can't change the key function, but replaceData should clear measured cache
    v.replaceData(3)
    expect(v.totalSize()).toBe(3 * 20) // all estimates
  })
})

describe('createVirtualizer — cache skew', () => {
  it('detectCacheSkew warns when getItemKey is not provided', () => {
    const v = createVirtualizer({ count: 5, estimateSize: 20, viewportSize: 100 })
    if (v.detectCacheSkew) {
      const warning = v.detectCacheSkew()
      expect(warning).not.toBeNull()
      expect(warning).toContain('index-as-key')
    }
  })

  it('detectCacheSkew returns null when getItemKey is provided', () => {
    const v = createVirtualizer({
      count: 5,
      estimateSize: 20,
      viewportSize: 100,
      getItemKey: (i) => `item-${i}`,
    })
    if (v.detectCacheSkew) {
      expect(v.detectCacheSkew()).toBeNull()
    }
  })

  it('default key (index) causes wrong size after deletion', () => {
    // Simulate: data = [A, B, C] measured sizes, then delete B → [A, C]
    // With index-as-key: A was at 0, B at 1 (32px), C at 2 (28px)
    // After delete: A still 0 OK, C is now index 1 but gets B's old 32px!
    const v = createVirtualizer({ count: 3, estimateSize: 20, viewportSize: 1000 })
    v.measure(0, 40) // A = 40
    v.measure(1, 32) // B = 32
    v.measure(2, 28) // C = 28
    expect(v.totalSize()).toBe(40 + 32 + 28)

    // Simulate deletion of B (index 1) → new count = 2
    v.setCount(2)
    const s = v.getState()
    // A is at index 0 → size 40 OK
    expect(s.items[0]).toMatchObject({ index: 0, size: 40 }) // A still correct
    // C is at index 1 but gets the measured size for key=1 which was B's 32!
    expect(s.items[1]).toMatchObject({ index: 1, size: 32 }) // wrong! C should be 28
  })

  it('stable key prevents cache skew after deletion', () => {
    const data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const v = createVirtualizer({
      count: 3,
      estimateSize: 20,
      viewportSize: 1000,
      getItemKey: (i) => data[i]!.id,
    })
    v.measure(0, 40) // a = 40
    v.measure(1, 32) // b = 32
    v.measure(2, 28) // c = 28

    // Delete b: data becomes [a, c]
    data.splice(1, 1)
    v.setCount(2)
    const s = v.getState()
    // a still at index 0 → size 40
    expect(s.items[0]).toMatchObject({ key: 'a', size: 40 })
    // c now at index 1, but key 'c' → gets measured 28, not 32
    expect(s.items[1]).toMatchObject({ key: 'c', size: 28 })
  })
})

describe('createVirtualizer — edge cases', () => {
  it('measure on out-of-bounds index is a no-op', () => {
    const v = createVirtualizer({ count: 5, estimateSize: 20, viewportSize: 1000 })
    const before = v.totalSize()
    v.measure(-1, 999)
    v.measure(100, 999)
    expect(v.totalSize()).toBe(before)
  })

  it('handles zero estimate size — Fenwick tree lowerBound returns last item', () => {
    const v = createVirtualizer({ count: 10, estimateSize: 0, viewportSize: 100 })
    expect(v.totalSize()).toBe(0)
    const s = v.getState()
    // With all-zero sizes, the lowerBound returns count (out of bounds),
    // clamped to last index. Only the last item is rendered.
    expect(s.items).toHaveLength(1)
    expect(s.items[0]!.index).toBe(9)
  })

  it('setCount with same count re-seats measurements (reorder)', () => {
    const data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const v = createVirtualizer({
      count: 3,
      estimateSize: 20,
      viewportSize: 1000,
      getItemKey: (i) => data[i]!.id,
    })
    v.measure(2, 100) // measure c at index 2

    // Reorder: [c, a, b]
    data.reverse()
    v.setCount(3)
    const s = v.getState()
    expect(s.items[0]).toMatchObject({ key: 'c', size: 100 }) // c's size traveled
  })
})
