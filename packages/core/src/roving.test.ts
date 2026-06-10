import { describe, it, expect } from 'vitest'
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
})

describe('firstEnabledIndex / lastEnabledIndex', () => {
  it('finds the first and last enabled', () => {
    const enabled = (i: number) => i === 1 || i === 2
    expect(firstEnabledIndex(4, enabled)).toBe(1)
    expect(lastEnabledIndex(4, enabled)).toBe(2)
  })
  it('returns -1 when none enabled', () => {
    expect(firstEnabledIndex(3, () => false)).toBe(-1)
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
  })

  it('returns the current cell for an empty grid', () => {
    expect(nextGridCell({ row: 0, col: 0 }, 'ArrowDown', { rowCount: 0, colCount: 0 })).toEqual({
      row: 0,
      col: 0,
    })
  })
})
