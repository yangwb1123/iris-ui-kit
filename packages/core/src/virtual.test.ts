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

describe('computeGridVirtualRange with frozen', () => {
  it('returns frozen rows separate from scrollable rows', () => {
    const grid = computeGridVirtualRange({
      rows: { itemCount: 100, scrollTop: 200, viewportSize: 100, itemSize: 20 },
      columns: { itemCount: 50, scrollTop: 0, viewportSize: 150, itemSize: 60 },
      frozen: { rows: 2 },
    })
    // Frozen rows: first 2 rows, offset 0
    expect(grid.frozenRows).toBeDefined()
    expect(grid.frozenRows!.startIndex).toBe(0)
    expect(grid.frozenRows!.endIndex).toBe(1)
    expect(grid.frozenRows!.offsetBefore).toBe(0)
    expect(grid.frozenRows!.totalSize).toBe(40) // 2 * 20
    // Scrollable rows: items 2..99 (98 items), scrollTop adjusted
    expect(grid.rows.startIndex).toBe(10) // scrollTop=200 on 98 items
    expect(grid.rows.itemCount).toBeUndefined() // itemCount is not on the window
  })

  it('returns frozen columns separate from scrollable columns', () => {
    const grid = computeGridVirtualRange({
      rows: { itemCount: 100, scrollTop: 0, viewportSize: 100, itemSize: 20 },
      columns: { itemCount: 50, scrollTop: 300, viewportSize: 150, itemSize: 60 },
      frozen: { columns: 1 },
    })
    // Frozen columns: first column
    expect(grid.frozenColumns).toBeDefined()
    expect(grid.frozenColumns!.startIndex).toBe(0)
    expect(grid.frozenColumns!.endIndex).toBe(0)
    expect(grid.frozenColumns!.offsetBefore).toBe(0)
    expect(grid.frozenColumns!.totalSize).toBe(60) // 1 * 60
    // Scrollable columns: remaining 49 items
    expect(grid.columns.startIndex).toBe(5) // scrollLeft=300 on 49 items of 60px
  })

  it('handles both frozen rows and columns simultaneously', () => {
    const grid = computeGridVirtualRange({
      rows: { itemCount: 100, scrollTop: 0, viewportSize: 100, itemSize: 20 },
      columns: { itemCount: 50, scrollTop: 0, viewportSize: 150, itemSize: 60 },
      frozen: { rows: 3, columns: 2 },
    })
    expect(grid.frozenRows!.endIndex).toBe(2)
    expect(grid.frozenRows!.totalSize).toBe(60) // 3 * 20
    expect(grid.frozenColumns!.endIndex).toBe(1)
    expect(grid.frozenColumns!.totalSize).toBe(120) // 2 * 60
  })

  it('handles frozen count exceeding item count (clamp to available)', () => {
    const grid = computeGridVirtualRange({
      rows: { itemCount: 2, scrollTop: 0, viewportSize: 100, itemSize: 20 },
      columns: { itemCount: 50, scrollTop: 0, viewportSize: 150, itemSize: 60 },
      frozen: { rows: 5 }, // only 2 rows exist
    })
    expect(grid.frozenRows!.endIndex).toBe(1) // all rows frozen
    expect(grid.rows.endIndex).toBe(-1) // no scrollable rows
  })

  it('handles zero frozen count', () => {
    const grid = computeGridVirtualRange({
      rows: { itemCount: 100, scrollTop: 0, viewportSize: 100, itemSize: 20 },
      columns: { itemCount: 50, scrollTop: 0, viewportSize: 150, itemSize: 60 },
      frozen: { rows: 0, columns: 0 },
    })
    expect(grid.frozenRows).toBeUndefined()
    expect(grid.frozenColumns).toBeUndefined()
    expect(grid.rows.startIndex).toBe(0)
    expect(grid.columns.startIndex).toBe(0)
  })

  it('no frozen config returns no frozen windows (backward compatible)', () => {
    const grid = computeGridVirtualRange({
      rows: { itemCount: 100, scrollTop: 0, viewportSize: 100, itemSize: 20 },
      columns: { itemCount: 50, scrollTop: 0, viewportSize: 150, itemSize: 60 },
    })
    expect(grid.frozenRows).toBeUndefined()
    expect(grid.frozenColumns).toBeUndefined()
  })
})
