import { describe, it, expect } from 'vitest'
import { matchTypeahead } from './roving'
import {
  nextEnabledIndex,
  firstEnabledIndex,
  lastEnabledIndex,
  nextGridCell,
  type GridNavOptions,
} from './roving'

describe('nextEnabledIndex', () => {
  it('steps forward and backward', () => {
    expect(nextEnabledIndex(0, 1, 3)).toBe(1)
    expect(nextEnabledIndex(2, -1, 3)).toBe(1)
  })

  it('wraps around when loop=true (default)', () => {
    expect(nextEnabledIndex(2, 1, 3)).toBe(0)
    expect(nextEnabledIndex(0, -1, 3)).toBe(2)
  })

  it('clamps to ends when loop=false', () => {
    expect(nextEnabledIndex(2, 1, 3, () => true, false)).toBe(2)
    expect(nextEnabledIndex(0, -1, 3, () => true, false)).toBe(0)
  })

  it('skips disabled indices', () => {
    const enabled = (i: number) => i !== 1
    expect(nextEnabledIndex(0, 1, 3, enabled)).toBe(2)
  })

  it('returns -1 for an empty set', () => {
    expect(nextEnabledIndex(0, 1, 0)).toBe(-1)
  })

  it('rejects non-finite and fractional counts without scanning forever', () => {
    const disabled = () => false
    expect(nextEnabledIndex(0, 1, Number.NaN, disabled)).toBe(-1)
    expect(nextEnabledIndex(0, 1, Number.POSITIVE_INFINITY, disabled)).toBe(-1)
    expect(nextEnabledIndex(0, 1, 2.5, disabled)).toBe(-1)
    expect(firstEnabledIndex(-1, disabled)).toBe(-1)
    expect(firstEnabledIndex(Number.POSITIVE_INFINITY, disabled)).toBe(-1)
    expect(lastEnabledIndex(2.5, disabled)).toBe(-1)
    expect(nextEnabledIndex(0, 1, Number.MAX_SAFE_INTEGER)).toBe(1)
  })

  it('does not return an invalid current index', () => {
    expect(nextEnabledIndex(Number.NaN, 1, 3)).toBe(-1)
    expect(nextEnabledIndex(1.5, 1, 3)).toBe(-1)
    expect(nextEnabledIndex(Number.POSITIVE_INFINITY, 1, 3)).toBe(-1)
    expect(nextEnabledIndex(-1, 1, 3)).toBe(0)
  })
})

describe('firstEnabledIndex / lastEnabledIndex', () => {
  it('finds the first and last enabled', () => {
    const enabled = (i: number) => i === 1 || i === 2
    expect(firstEnabledIndex(4, enabled)).toBe(1)
    expect(lastEnabledIndex(4, enabled)).toBe(2)
  })
  it('returns -1 when none enabled', () => {
    const disabled = () => false
    expect(firstEnabledIndex(3, disabled)).toBe(-1)
    expect(lastEnabledIndex(3, disabled)).toBe(-1)
  })
})

describe('nextGridCell (2D roving)', () => {
  const grid: GridNavOptions = { rowCount: 3, colCount: 4 }

  it('arrows move within row (L/R) and column (U/D)', () => {
    expect(nextGridCell({ row: 1, col: 1 }, 'ArrowRight', grid)).toEqual({ row: 1, col: 2 })
    expect(nextGridCell({ row: 1, col: 1 }, 'ArrowLeft', grid)).toEqual({ row: 1, col: 0 })
    expect(nextGridCell({ row: 1, col: 1 }, 'ArrowDown', grid)).toEqual({ row: 2, col: 1 })
    expect(nextGridCell({ row: 1, col: 1 }, 'ArrowUp', grid)).toEqual({ row: 0, col: 1 })
  })

  it('does not move past an edge by default (no wrap)', () => {
    expect(nextGridCell({ row: 1, col: 3 }, 'ArrowRight', grid)).toEqual({ row: 1, col: 3 })
    expect(nextGridCell({ row: 0, col: 1 }, 'ArrowUp', grid)).toEqual({ row: 0, col: 1 })
  })

  it('wraps within the row when loop is set', () => {
    expect(nextGridCell({ row: 1, col: 3 }, 'ArrowRight', { ...grid, loop: true })).toEqual({
      row: 1,
      col: 0,
    })
    expect(nextGridCell({ row: 1, col: 0 }, 'ArrowLeft', { ...grid, loop: true })).toEqual({
      row: 1,
      col: 3,
    })
  })

  it('skips disabled cells along the travel direction', () => {
    const isEnabled = ({ col }: { row: number; col: number }) => col !== 2
    expect(nextGridCell({ row: 0, col: 1 }, 'ArrowRight', { ...grid, isEnabled })).toEqual({
      row: 0,
      col: 3,
    }) // skips col 2
  })

  it('returns the current cell when every candidate is disabled', () => {
    const current = Object.freeze({ row: 1, col: 1 })
    const disabled = () => false
    expect(nextGridCell(current, 'ArrowRight', { ...grid, isEnabled: disabled, loop: true })).toBe(
      current,
    )
    expect(nextGridCell(current, 'ArrowDown', { ...grid, isEnabled: disabled })).toBe(current)
    expect(nextGridCell(current, 'Home', { ...grid, isEnabled: disabled })).toBe(current)
    expect(nextGridCell(current, 'PageDown', { ...grid, isEnabled: disabled })).toBe(current)
  })

  it('Home / End jump to the row first / last enabled cell', () => {
    expect(nextGridCell({ row: 2, col: 2 }, 'Home', grid)).toEqual({ row: 2, col: 0 })
    expect(nextGridCell({ row: 2, col: 1 }, 'End', grid)).toEqual({ row: 2, col: 3 })
    const isEnabled = ({ col }: { row: number; col: number }) => col !== 0
    expect(nextGridCell({ row: 0, col: 2 }, 'Home', { ...grid, isEnabled })).toEqual({
      row: 0,
      col: 1,
    }) // col 0 disabled → nearest enabled
  })

  it('PageUp / PageDown jump pageSize rows, nearest enabled in the column', () => {
    const big: GridNavOptions = { rowCount: 10, colCount: 3, pageSize: 5 }
    expect(nextGridCell({ row: 8, col: 1 }, 'PageUp', big)).toEqual({ row: 3, col: 1 })
    expect(nextGridCell({ row: 2, col: 1 }, 'PageDown', big)).toEqual({ row: 7, col: 1 })
    // clamps at the edge
    expect(nextGridCell({ row: 1, col: 1 }, 'PageUp', big)).toEqual({ row: 0, col: 1 })
    const disabledTarget = ({ row, col }: { row: number; col: number }) => row !== 1 || col !== 1
    expect(
      nextGridCell({ row: 0, col: 1 }, 'PageDown', {
        rowCount: 3,
        colCount: 3,
        isEnabled: disabledTarget,
      }),
    ).toEqual({ row: 2, col: 1 }) // keeps the same column when the target row is disabled
  })

  it('returns the current cell for an empty grid', () => {
    expect(nextGridCell({ row: 0, col: 0 }, 'ArrowDown', { rowCount: 0, colCount: 0 })).toEqual({
      row: 0,
      col: 0,
    })
  })

  it('rejects invalid dimensions and current cells without producing invalid targets', () => {
    const current = { row: 1, col: 1 }
    const disabled = () => false
    expect(nextGridCell(current, 'ArrowDown', { rowCount: -1, colCount: 3 })).toBe(current)
    expect(nextGridCell(current, 'ArrowDown', { rowCount: Number.NaN, colCount: 3 })).toBe(current)
    expect(
      nextGridCell(current, 'ArrowDown', {
        rowCount: Number.POSITIVE_INFINITY,
        colCount: 3,
        isEnabled: disabled,
      }),
    ).toBe(current)
    expect(nextGridCell(current, 'ArrowDown', { rowCount: 2.5, colCount: 3 })).toBe(current)
    expect(nextGridCell(current, 'ArrowDown', { rowCount: 3, colCount: Number.NaN })).toBe(current)
    expect(
      nextGridCell(current, 'ArrowDown', { rowCount: 3, colCount: Number.POSITIVE_INFINITY }),
    ).toBe(current)
    expect(nextGridCell({ row: Number.NaN, col: 1 }, 'Home', { rowCount: 3, colCount: 3 })).toEqual(
      {
        row: Number.NaN,
        col: 1,
      },
    )
    expect(nextGridCell({ row: -1, col: 1 }, 'End', { rowCount: 3, colCount: 3 })).toEqual({
      row: -1,
      col: 1,
    })
    expect(nextGridCell({ row: 1, col: 1.5 }, 'End', { rowCount: 3, colCount: 3 })).toEqual({
      row: 1,
      col: 1.5,
    })
    expect(nextGridCell({ row: 1.5, col: 1 }, 'End', { rowCount: 3, colCount: 3 })).toEqual({
      row: 1.5,
      col: 1,
    })
  })

  it('falls back to one row for an invalid page size', () => {
    const current = { row: 1, col: 1 }
    for (const pageSize of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
      expect(nextGridCell(current, 'PageDown', { rowCount: 3, colCount: 3, pageSize })).toEqual({
        row: 2,
        col: 1,
      })
    }
  })

  describe('matchTypeahead', () => {
    const items = ['Apple', 'Banana', 'Blueberry', 'Cherry']
    it('jumps to the first item starting with the query (case-insensitive)', () => {
      expect(matchTypeahead(items, 'b', -1)).toBe(1) // Banana
      expect(matchTypeahead(items, 'CHE', 0)).toBe(3) // Cherry
    })
    it('cycles through same-initial items from after fromIndex', () => {
      expect(matchTypeahead(items, 'b', 1)).toBe(2) // from Banana → Blueberry
      expect(matchTypeahead(items, 'b', 2)).toBe(1) // from Blueberry → wraps to Banana
    })
    it('skips disabled items and returns -1 when nothing matches', () => {
      expect(matchTypeahead(items, 'b', -1, (i) => i === 1)).toBe(2) // skip Banana → Blueberry
      expect(matchTypeahead(items, 'z', -1)).toBe(-1)
      expect(matchTypeahead(items, '  ', 0)).toBe(-1)
    })
    it('trims labels and queries, wraps, and treats invalid fromIndex as before the list', () => {
      const labels = Object.freeze(['  Apple  ', 'BANANA'])
      expect(matchTypeahead(labels, ' b ', 1)).toBe(1)
      expect(matchTypeahead(labels, 'a', 1)).toBe(0)
      expect(matchTypeahead(labels, 'a', Number.NaN)).toBe(0)
      expect(matchTypeahead(labels, 'a', 0.5)).toBe(0)
      expect(matchTypeahead(labels, 'b', Number.POSITIVE_INFINITY)).toBe(1)
    })
  })
})
