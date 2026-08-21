import { describe, expect, it } from 'vitest'
import {
  computeResponsiveColumns,
  RESPONSIVE_NARROW_WIDTH,
  type ResponsiveColumn,
} from './responsive'

interface Col extends ResponsiveColumn {
  width?: number
}

/** Test double for the adapter's resolved-width chain (override → declared → default). */
function widthOf(col: Col): number {
  return col.width ?? 140
}

describe('@iris-ui-kit/core computeResponsiveColumns (batch CY)', () => {
  it('is inert at/above the 480px threshold (480 exactly = full width)', () => {
    const cols: Col[] = [
      { key: 'a', width: 100 },
      { key: 'b', width: 100 },
    ]
    expect(computeResponsiveColumns(cols, 480, { widthOf })).toBe(cols)
    expect(computeResponsiveColumns(cols, 481, { widthOf })).toBe(cols)
    expect(computeResponsiveColumns(cols, 1000, { widthOf })).toBe(cols)
  })

  it('is fail-closed for unmeasured / non-positive container widths', () => {
    const cols: Col[] = [
      { key: 'a', width: 100 },
      { key: 'b', width: 100 },
    ]
    expect(computeResponsiveColumns(cols, 0, { widthOf })).toBe(cols)
    expect(computeResponsiveColumns(cols, -5, { widthOf })).toBe(cols)
  })

  it('479px collapses the tail until the natural width fits', () => {
    const cols: Col[] = [
      { key: 'a', width: 100 },
      { key: 'b', width: 100 },
      { key: 'c', width: 100 },
      { key: 'd', width: 100 },
      { key: 'e', width: 100 },
    ]
    // 5 × 100 = 500 > 479 → hide the tail (e) → 400 fits.
    const kept = computeResponsiveColumns(cols, 479, { widthOf })
    expect(kept).toEqual([cols[0], cols[1], cols[2], cols[3]])
    expect(kept).not.toBe(cols)
  })

  it('hides the MINIMUM needed — a fitting table returns the same reference', () => {
    const cols: Col[] = [
      { key: 'a', width: 150 },
      { key: 'b', width: 150 },
      { key: 'c', width: 150 },
    ]
    // 450 ≤ 479 already fits → no collapse, reference-preserving.
    expect(computeResponsiveColumns(cols, 479, { widthOf })).toBe(cols)
    // 450 > 440 → hide only the tail, stopping as soon as it fits.
    const kept = computeResponsiveColumns(cols, 440, { widthOf })
    expect(kept).toEqual([cols[0], cols[1]])
  })

  it('pinned columns survive and count toward the natural width', () => {
    const cols: Col[] = [
      { key: 'pin', width: 200, pinned: 'left' },
      { key: 'a', width: 100 },
      { key: 'b', width: 100 },
      { key: 'c', width: 100 },
    ]
    // Natural = 200 + 300 = 500. Pinned is never a candidate: hide from the
    // tail until the remainder (200 + kept) fits 350.
    const kept = computeResponsiveColumns(cols, 350, {
      widthOf,
      isPinned: (c) => (c as Col).pinned != null,
    })
    expect(kept.map((c) => c.key)).toEqual(['pin', 'a'])
  })

  it('enforces the floor: ≥1 unprotected column always remains', () => {
    const cols: Col[] = [
      { key: 'pin', width: 300, pinned: 'left' },
      { key: 'a', width: 300 },
    ]
    // Natural = 600; even the pinned column alone (300) exceeds 250, but the
    // floor keeps a: the result never blanks the table.
    const kept = computeResponsiveColumns(cols, 250, {
      widthOf,
      isPinned: (c) => (c as Col).pinned != null,
    })
    expect(kept).toEqual(cols)
  })

  it('honors a custom floor', () => {
    const cols: Col[] = [
      { key: 'a', width: 100 },
      { key: 'b', width: 100 },
      { key: 'c', width: 100 },
      { key: 'd', width: 100 },
    ]
    const kept = computeResponsiveColumns(cols, 120, { widthOf, floor: 2 })
    expect(kept.map((c) => c.key)).toEqual(['a', 'b'])
  })

  it('keeps a grouped column whole: natural width = sum of its leaves', () => {
    const cols: Col[] = [
      {
        key: 'g',
        children: [
          { key: 'a', width: 120 },
          { key: 'b', width: 120 },
        ],
      },
      { key: 'c', width: 120 },
      { key: 'd', width: 120 },
    ]
    // Group natural = 240; total = 480 > 440 → tail (d) hides → 360 fits.
    const kept = computeResponsiveColumns(cols, 440, { widthOf })
    expect(kept.map((c) => c.key)).toEqual(['g', 'c'])
  })

  it('hides multiple tails when the container is very narrow', () => {
    const cols: Col[] = [
      { key: 'a', width: 100 },
      { key: 'b', width: 100 },
      { key: 'c', width: 100 },
      { key: 'd', width: 100 },
      { key: 'e', width: 100 },
    ]
    const kept = computeResponsiveColumns(cols, 230, { widthOf })
    expect(kept.map((c) => c.key)).toEqual(['a', 'b'])
  })

  it('returns the input unchanged for empty column lists and pinned-only tables', () => {
    expect(computeResponsiveColumns([], 400, { widthOf })).toEqual([])
    const pinnedOnly: Col[] = [
      { key: 'a', width: 100, pinned: 'left' },
      { key: 'b', width: 100, pinned: 'right' },
    ]
    expect(
      computeResponsiveColumns(pinnedOnly, 100, {
        widthOf,
        isPinned: (c) => (c as Col).pinned != null,
      }),
    ).toBe(pinnedOnly)
  })

  it('fails closed when a column width is non-finite or negative', () => {
    const cols: Col[] = [
      { key: 'a', width: 100 },
      { key: 'b', width: 100 },
    ]
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(
        computeResponsiveColumns(cols, 200, {
          widthOf: (col) => (col.key === 'b' ? invalid : col.width!),
        }),
      ).toBe(cols)
    }
  })

  it('exposes the documented 480px threshold constant', () => {
    expect(RESPONSIVE_NARROW_WIDTH).toBe(480)
  })
})
