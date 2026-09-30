import { describe, expect, it, vi } from 'vitest'
import { createVirtualizer } from './virtualizer'

function expectFiniteVirtualizerState(v: ReturnType<typeof createVirtualizer>): void {
  const state = v.getState()
  expect(Number.isFinite(state.offsetBefore)).toBe(true)
  expect(Number.isFinite(state.totalSize)).toBe(true)
  expect(Number.isFinite(state.startIndex)).toBe(true)
  expect(Number.isFinite(state.endIndex)).toBe(true)
  for (const item of state.items) {
    expect(Number.isFinite(item.index)).toBe(true)
    expect(Number.isFinite(item.start)).toBe(true)
    expect(Number.isFinite(item.size)).toBe(true)
  }
}

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

describe('createVirtualizer — development diagnostics', () => {
  it('keeps diagnostics guarded when process is unavailable or non-development', () => {
    const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setProcess = (value: unknown): void => {
      Object.defineProperty(globalThis, 'process', {
        configurable: true,
        enumerable: false,
        writable: true,
        value,
      })
    }
    const create = () => createVirtualizer({ count: 1, estimateSize: 20 })

    try {
      expect(Reflect.deleteProperty(globalThis, 'process')).toBe(true)
      expect(() => {
        const virtualizer = create()
        expect(virtualizer.detectCacheSkew).toBeUndefined()
      }).not.toThrow()

      for (const processLike of [
        undefined,
        {},
        { env: undefined },
        { env: { NODE_ENV: 'test' } },
      ]) {
        setProcess(processLike)
        expect(() => {
          const virtualizer = create()
          expect(virtualizer.detectCacheSkew).toBeUndefined()
        }).not.toThrow()
      }
      expect(warning).not.toHaveBeenCalled()

      setProcess({ env: { NODE_ENV: 'development' } })
      const virtualizer = create()
      expect(warning).toHaveBeenCalledWith(
        '[iris-ui] createVirtualizer: no getItemKey provided — using index as key. ' +
          'Measured sizes will map to wrong items when data is inserted or deleted. ' +
          'Provide a stable getItemKey for dynamic data lists.',
      )
      expect(virtualizer.detectCacheSkew).toBeTypeOf('function')
      expect(virtualizer.detectCacheSkew?.()).toBe(
        'Virtualizer is using index-as-key (no getItemKey provided). ' +
          'Item insertion/deletion will cause measured sizes to map to wrong positions. ' +
          'Provide a stable getItemKey for dynamic data.',
      )
    } finally {
      warning.mockRestore()
      if (processDescriptor) {
        Object.defineProperty(globalThis, 'process', processDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'process')
      }
    }
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

  it('normalizes positive fractional indices without accepting negative fractions as zero', () => {
    const v = createVirtualizer({ count: 3, estimateSize: 20, viewportSize: 1000 })
    v.measure(1.9, 40)
    expect(v.getState().items[1]).toMatchObject({ index: 1, size: 40 })

    const before = v.totalSize()
    v.measure(-0.5, 100)
    expect(v.totalSize()).toBe(before)
    expect(v.getState().items[0]).toMatchObject({ index: 0, size: 20 })
  })

  it('bounds a huge finite count before allocating the size tree', () => {
    const v = createVirtualizer({
      count: Number.MAX_SAFE_INTEGER,
      estimateSize: 20,
      viewportSize: 100,
    })
    expectFiniteVirtualizerState(v)
    expect(v.getState().items.length).toBeLessThan(10)
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

  it('uses the offset tree rather than an empty fixed window for zero-sized rows', () => {
    const v = createVirtualizer({
      count: 10,
      estimateSize: 0,
      fixedSize: 0,
      viewportSize: 100,
    })

    expect(v.totalSize()).toBe(0)
    expect(v.getState().items.map((item) => item.index)).toEqual([9])
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

  it('fails closed for non-finite and invalid configuration values', () => {
    for (const count of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -3]) {
      const v = createVirtualizer({
        count,
        estimateSize: Number.NaN,
        viewportSize: Number.POSITIVE_INFINITY,
        scrollOffset: Number.NEGATIVE_INFINITY,
        buffer: Number.NaN,
        fixedSize: Number.POSITIVE_INFINITY,
      })
      expect(v.getState().items).toEqual([])
      expectFiniteVirtualizerState(v)
    }

    const v = createVirtualizer({
      count: 2.9,
      estimateSize: (index) => [Number.POSITIVE_INFINITY, -10, Number.NaN][index] ?? 0,
    })
    expect(v.totalSize()).toBe(0)
    expectFiniteVirtualizerState(v)
  })

  it('ignores non-finite measurements and normalizes negative measurements and controls', () => {
    const v = createVirtualizer({ count: 3, estimateSize: 20, viewportSize: 40 })
    v.measure(0, 40)
    const beforeInvalidMeasurements = v.totalSize()

    v.measure(Number.NaN, 100)
    v.measure(1, Number.NaN)
    v.measure(1, Number.POSITIVE_INFINITY)
    v.measure(1, Number.NEGATIVE_INFINITY)
    expect(v.totalSize()).toBe(beforeInvalidMeasurements)

    v.measure(1, -10)
    v.setScroll(Number.NaN)
    v.setScroll(Number.POSITIVE_INFINITY)
    v.setScroll(-10)
    v.setViewportSize(Number.POSITIVE_INFINITY)
    v.setViewportSize(-10)
    v.setBuffer(Number.POSITIVE_INFINITY)
    v.setBuffer(-10)
    v.setFixedSize(Number.NaN)
    v.setFixedSize(-10)
    expectFiniteVirtualizerState(v)

    expect(v.scrollToOffset(Number.NaN)).toBe(0)
    expect(v.scrollToIndex(Number.NaN)).toBe(0)

    v.setCount(Number.NaN)
    expect(v.getState().items).toEqual([])
    expectFiniteVirtualizerState(v)
    v.replaceData(Number.POSITIVE_INFINITY)
    expect(v.getState().items).toEqual([])
    expectFiniteVirtualizerState(v)
  })

  it('keeps totals and offsets finite when finite sizes would overflow an aggregate', () => {
    const v = createVirtualizer({
      count: 3,
      estimateSize: Number.MAX_VALUE,
      viewportSize: Number.MAX_VALUE,
    })
    expectFiniteVirtualizerState(v)
    expect(v.totalSize()).toBeLessThanOrEqual(Number.MAX_VALUE)

    v.measure(0, Number.MAX_VALUE)
    v.setCount(5)
    v.measure(4, Number.MAX_VALUE)
    expectFiniteVirtualizerState(v)
    expect(v.totalSize()).toBeLessThanOrEqual(Number.MAX_VALUE)
  })
})
