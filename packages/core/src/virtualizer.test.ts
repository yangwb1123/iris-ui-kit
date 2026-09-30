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

  it('updates estimates without discarding measured sizes', () => {
    const v = createVirtualizer({ count: 3, estimateSize: 20, viewportSize: 1000 })
    v.measure(0, 40)

    v.setEstimateSize(30)

    expect(v.getState().items.map((item) => item.size)).toEqual([40, 30, 30])
    expect(v.totalSize()).toBe(100)
  })

  it('re-evaluates a stable estimate function while retaining measurements', () => {
    let estimate = 20
    const estimateSize = () => estimate
    const v = createVirtualizer({
      count: 3,
      estimateSize,
      viewportSize: 1000,
    })
    v.measure(0, 40)
    estimate = 30

    v.setEstimateSize(estimateSize)

    // The function source is allowed to be stable while its closure changes;
    // callers can pass the same source again to refresh unmeasured rows.
    expect(v.getState().items.map((item) => item.size)).toEqual([40, 30, 30])
  })

  it('does not notify when estimate refresh produces the same window', () => {
    const v = createVirtualizer({ count: 3, estimateSize: () => 20, viewportSize: 1000 })
    const listener = vi.fn()

    v.subscribe(listener)
    v.setEstimateSize(() => 20)

    expect(listener).not.toHaveBeenCalled()
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

describe('createVirtualizer — snapshot boundaries', () => {
  it('isolates getState state, items, and item objects from the controller', () => {
    const v = createVirtualizer({ count: 5, estimateSize: 20, viewportSize: 40 })
    const snapshot = v.getState()
    const internal = v.store.getState()

    expect(snapshot).not.toBe(internal)
    expect(snapshot.items).not.toBe(internal.items)
    expect(snapshot.items[0]).not.toBe(internal.items[0])
    expect(v.getState()).toBe(snapshot)

    snapshot.offsetBefore = 999
    snapshot.totalSize = 999
    snapshot.startIndex = 999
    snapshot.endIndex = 999
    snapshot.items[0]!.start = 999
    snapshot.items[0]!.size = 999
    snapshot.items.length = 0

    expect(v.getState()).toMatchObject({
      offsetBefore: 0,
      totalSize: 100,
      startIndex: 0,
      endIndex: 1,
      items: [
        { index: 0, key: 0, start: 0, size: 20 },
        { index: 1, key: 1, start: 20, size: 20 },
      ],
    })

    v.setScroll(20)
    expect(v.getState()).toMatchObject({ startIndex: 1 })
    expect(v.getState().items[0]).toMatchObject({ index: 1, start: 20, size: 20 })
  })

  it('isolates snapshots delivered to subscribers from the controller', () => {
    const v = createVirtualizer({ count: 5, estimateSize: 20, viewportSize: 40 })
    const listener = vi.fn((snapshot) => {
      snapshot.totalSize = -1
      snapshot.items[0]!.size = -1
      snapshot.items.length = 0
    })
    v.subscribe(listener)

    v.setScroll(20)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(v.getState()).toMatchObject({
      startIndex: 1,
      endIndex: 2,
      totalSize: 100,
      items: [
        { index: 1, key: 1, start: 20, size: 20 },
        { index: 2, key: 2, start: 40, size: 20 },
      ],
    })
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

  it('setBuffer updates overscan without replacing the controller', () => {
    const v = createVirtualizer({ count: 100, estimateSize: 20, viewportSize: 100 })
    v.setScroll(200)
    expect(v.getState()).toMatchObject({ startIndex: 10, endIndex: 14 })
    v.setBuffer(2)
    expect(v.getState()).toMatchObject({ startIndex: 8, endIndex: 16 })
    v.setBuffer(Number.NaN)
    expect(v.getState()).toMatchObject({ startIndex: 10, endIndex: 14 })
  })

  it('fixedSize keeps the closed-form zero-viewport buffer boundary', () => {
    const v = createVirtualizer({
      count: 30,
      estimateSize: 36,
      fixedSize: 36,
      viewportSize: 0,
      buffer: 4,
    })
    expect(v.getState()).toMatchObject({ startIndex: 0, endIndex: 3 })
    v.setFixedSize(null)
    expect(v.getState()).toMatchObject({ startIndex: 0, endIndex: 4 })
  })

  it('fixedSize includes rows intersecting the viewport after a partial scroll', () => {
    const v = createVirtualizer({
      count: 10,
      estimateSize: 20,
      fixedSize: 20,
      viewportSize: 20,
    })

    v.setScroll(10)

    expect(v.getState().items.map((item) => item.index)).toEqual([0, 1])
  })

  it('uses measured offsets when a fixed-size row diverges from its estimate', () => {
    const v = createVirtualizer({
      count: 4,
      estimateSize: 20,
      fixedSize: 20,
      viewportSize: 30,
      buffer: 0,
    })

    v.measure(0, 40)
    expect(v.getState().items.find((item) => item.index === 0)).toMatchObject({
      start: 0,
      size: 40,
    })

    v.setScroll(20)
    expect(v.getState().items.map((item) => item.index)).toEqual(expect.arrayContaining([0, 1]))
    expect(v.getState().items.find((item) => item.index === 0)).toMatchObject({
      start: 0,
      size: 40,
    })

    v.setScroll(40)
    expect(v.getState().items.map((item) => item.index)).toEqual(expect.arrayContaining([1, 2]))
  })

  // TC-A — acceptance 1: setFixedSize disagrees with the unmeasured estimate
  it('keeps the offset-tree window when setFixedSize disagrees with the estimate', () => {
    const v = createVirtualizer({ count: 10, estimateSize: 40, viewportSize: 100 })
    v.setScroll(120)
    v.setFixedSize(30)

    const state = v.getState()
    expect(state.offsetBefore).toBeLessThanOrEqual(120)
    expect(state.items.some((item) => item.start <= 120 && item.start + item.size > 120)).toBe(true)
    expect(state.totalSize).toBe(400)
  })

  // TC-B — acceptance 2: creation-time config mismatch
  it('keeps the offset-tree window when creation-time fixedSize disagrees with the estimate', () => {
    const v = createVirtualizer({
      count: 10,
      estimateSize: 40,
      fixedSize: 30,
      viewportSize: 100,
    })
    v.setScroll(120)

    const state = v.getState()
    expect(state.offsetBefore).toBeLessThanOrEqual(120)
    expect(state.items.some((item) => item.start <= 120 && item.start + item.size > 120)).toBe(true)
    expect(state.totalSize).toBe(400)
  })

  // TC-D — acceptance 4: matched config keeps the closed-form window
  it('keeps the closed-form window when fixedSize matches the estimate', () => {
    const v = createVirtualizer({ count: 10, estimateSize: 30, fixedSize: 30, viewportSize: 100 })
    v.setScroll(120)

    const state = v.getState()
    expect(state.totalSize).toBe(300)
    expect(state.startIndex).toBe(4)
    expect(state.offsetBefore).toBe(120)
  })

  // TC-E — R2 function-estimate branch
  it('falls back to the offset tree for a function estimate that disagrees with fixedSize', () => {
    const v = createVirtualizer({
      count: 10,
      estimateSize: () => 40,
      fixedSize: 30,
      viewportSize: 100,
    })
    v.setScroll(120)

    const state = v.getState()
    expect(state.offsetBefore).toBeLessThanOrEqual(120)
    expect(state.items.some((item) => item.start <= 120 && item.start + item.size > 120)).toBe(true)
    expect(state.totalSize).toBe(400)
  })

  // TC-F1 — R4.4 count growth revalidates agreement
  it('revalidates fixed-size agreement when setCount grows a divergent function estimate', () => {
    const v = createVirtualizer({
      count: 5,
      estimateSize: (index) => (index < 5 ? 30 : 40),
      fixedSize: 30,
      viewportSize: 100,
    })
    expect(v.getState().totalSize).toBe(150) // estimates match: closed form is valid

    v.setCount(10)
    v.setScroll(250)

    const state = v.getState()
    expect(state.totalSize).toBe(350)
    expect(state.offsetBefore).toBeLessThanOrEqual(250)
    expect(state.items.some((item) => item.start <= 250 && item.start + item.size > 250)).toBe(true)
  })

  // TC-F2 — R4.5 replaceData revalidates agreement
  it('revalidates fixed-size agreement when replaceData grows a divergent function estimate', () => {
    const v = createVirtualizer({
      count: 5,
      estimateSize: (index) => (index < 5 ? 30 : 40),
      fixedSize: 30,
      viewportSize: 100,
    })

    v.replaceData(10)
    v.setScroll(250)

    const state = v.getState()
    expect(state.totalSize).toBe(350)
    expect(state.offsetBefore).toBeLessThanOrEqual(250)
    expect(state.items.some((item) => item.start <= 250 && item.start + item.size > 250)).toBe(true)
  })

  // TC-G — R4.6 remeasure revalidates a stateful estimate
  it('revalidates fixed-size agreement when remeasure drops a stale estimate', () => {
    let estimate: 'match' | 'diverge' = 'match'
    const v = createVirtualizer({
      count: 10,
      estimateSize: () => (estimate === 'match' ? 30 : 40),
      fixedSize: 30,
      viewportSize: 100,
    })
    expect(v.getState().totalSize).toBe(300)

    estimate = 'diverge'
    v.remeasure()
    v.setScroll(120)

    const state = v.getState()
    expect(state.totalSize).toBe(400)
    expect(state.offsetBefore).toBeLessThanOrEqual(120)
    expect(state.items.some((item) => item.start <= 120 && item.start + item.size > 120)).toBe(true)
  })
})
