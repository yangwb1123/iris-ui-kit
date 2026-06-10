import { describe, expect, it } from 'vitest'
import { buildOffsets, computeVirtualRange, computeGridVirtualRange } from './virtual'

describe('computeVirtualRange (fixed height)', () => {
  const base = { itemCount: 100, viewportSize: 100, itemSize: 20 }

  it('returns an empty window for zero items', () => {
    expect(
      computeVirtualRange({ itemCount: 0, scrollTop: 0, viewportSize: 100, itemSize: 20 }),
    ).toEqual({ startIndex: 0, endIndex: -1, offsetBefore: 0, totalSize: 0 })
  })

  it('renders the top window at scrollTop 0', () => {
    expect(computeVirtualRange({ ...base, scrollTop: 0 })).toEqual({
      startIndex: 0,
      endIndex: 5,
      offsetBefore: 0,
      totalSize: 2000,
    })
  })

  it('shifts the window and offset as you scroll', () => {
    expect(computeVirtualRange({ ...base, scrollTop: 50 })).toEqual({
      startIndex: 2,
      endIndex: 7,
      offsetBefore: 40,
      totalSize: 2000,
    })
  })

  it('applies the buffer on both sides and clamps at the top', () => {
    expect(computeVirtualRange({ ...base, scrollTop: 50, buffer: 2 })).toEqual({
      startIndex: 0,
      endIndex: 9,
      offsetBefore: 0,
      totalSize: 2000,
    })
  })

  it('clamps scrollTop past the end', () => {
    const w = computeVirtualRange({ ...base, scrollTop: 100000 })
    expect(w.endIndex).toBe(99)
    expect(w.startIndex).toBe(95)
    expect(w.offsetBefore).toBe(1900)
  })

  it('renders all items when the viewport is larger than the content', () => {
    const w = computeVirtualRange({ itemCount: 3, scrollTop: 0, viewportSize: 100, itemSize: 20 })
    expect(w.startIndex).toBe(0)
    expect(w.endIndex).toBe(2)
    expect(w.totalSize).toBe(60)
  })

  it('degrades gracefully when itemSize is 0', () => {
    const w = computeVirtualRange({ itemCount: 5, scrollTop: 0, viewportSize: 100, itemSize: 0 })
    expect(w).toEqual({ startIndex: 0, endIndex: 4, offsetBefore: 0, totalSize: 0 })
  })
})

describe('buildOffsets', () => {
  it('produces cumulative prefix sums incl. the total', () => {
    const sizes = [10, 20, 30, 40]
    expect(buildOffsets(4, (i) => sizes[i])).toEqual([0, 10, 30, 60, 100])
  })
})

describe('computeVirtualRange (variable height)', () => {
  const sizes = [10, 20, 30, 40] // offsets [0,10,30,60,100], total 100
  const sizeAt = (i: number) => sizes[i]

  it('covers the viewport from the top', () => {
    expect(
      computeVirtualRange({ itemCount: 4, scrollTop: 0, viewportSize: 35, itemSize: sizeAt }),
    ).toEqual({ startIndex: 0, endIndex: 2, offsetBefore: 0, totalSize: 100 })
  })

  it('finds the right start index + offset mid-scroll', () => {
    expect(
      computeVirtualRange({ itemCount: 4, scrollTop: 35, viewportSize: 35, itemSize: sizeAt }),
    ).toEqual({ startIndex: 2, endIndex: 3, offsetBefore: 30, totalSize: 100 })
  })

  it('applies the buffer with variable offsets', () => {
    expect(
      computeVirtualRange({
        itemCount: 4,
        scrollTop: 35,
        viewportSize: 35,
        itemSize: sizeAt,
        buffer: 1,
      }),
    ).toEqual({ startIndex: 1, endIndex: 3, offsetBefore: 10, totalSize: 100 })
  })

  it('clamps at the bottom', () => {
    const w = computeVirtualRange({
      itemCount: 4,
      scrollTop: 1000,
      viewportSize: 35,
      itemSize: sizeAt,
    })
    expect(w.endIndex).toBe(3)
    expect(w.offsetBefore).toBe(60)
    expect(w.totalSize).toBe(100)
  })
})

describe('computeVirtualRange (precomputed offsets)', () => {
  const sizes = [10, 20, 30, 40] // offsets [0,10,30,60,100]
  const offsets = buildOffsets(4, (i) => sizes[i])

  it('matches the itemSize-function path exactly when given cached offsets', () => {
    for (const scrollTop of [0, 35, 1000]) {
      for (const buffer of [0, 1, 2]) {
        const viaFn = computeVirtualRange({
          itemCount: 4,
          scrollTop,
          viewportSize: 35,
          itemSize: (i) => sizes[i],
          buffer,
        })
        const viaOffsets = computeVirtualRange({
          itemCount: 4,
          scrollTop,
          viewportSize: 35,
          itemSize: (i) => sizes[i],
          offsets,
          buffer,
        })
        expect(viaOffsets).toEqual(viaFn)
      }
    }
  })

  it('does not call itemSize when offsets are supplied (no per-scroll rebuild)', () => {
    let calls = 0
    const sizeAt = (i: number): number => {
      calls += 1
      return sizes[i]
    }
    computeVirtualRange({
      itemCount: 4,
      scrollTop: 35,
      viewportSize: 35,
      itemSize: sizeAt,
      offsets,
    })
    expect(calls).toBe(0)
  })
})

describe('computeGridVirtualRange (2D)', () => {
  it('computes independent row and column windows in one call', () => {
    const grid = computeGridVirtualRange({
      rows: { itemCount: 100, scrollTop: 200, viewportSize: 100, itemSize: 20 },
      columns: { itemCount: 50, scrollTop: 300, viewportSize: 150, itemSize: 60 },
    })
    // rows: each call matches the 1D computation for that axis
    expect(grid.rows).toEqual(
      computeVirtualRange({ itemCount: 100, scrollTop: 200, viewportSize: 100, itemSize: 20 }),
    )
    expect(grid.columns).toEqual(
      computeVirtualRange({ itemCount: 50, scrollTop: 300, viewportSize: 150, itemSize: 60 }),
    )
    expect(grid.rows.startIndex).toBe(10) // 200/20
    expect(grid.columns.startIndex).toBe(5) // 300/60
  })

  it('supports cached offsets per axis', () => {
    const colOffsets = buildOffsets(4, () => 60) // [0,60,120,180,240]
    const grid = computeGridVirtualRange({
      rows: { itemCount: 4, scrollTop: 0, viewportSize: 40, itemSize: 20 },
      columns: {
        itemCount: 4,
        scrollTop: 60,
        viewportSize: 120,
        itemSize: () => 60,
        offsets: colOffsets,
      },
    })
    expect(grid.columns.startIndex).toBe(1)
    expect(grid.columns.offsetBefore).toBe(60)
  })
})
