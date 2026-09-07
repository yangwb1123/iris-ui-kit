import { describe, expect, it } from 'vitest'
import {
  COLUMN_RESIZE_STEP,
  DEFAULT_COLUMN_MIN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
  clampColumnWidth,
  isValidColumnWidth,
  resolveColumnWidth,
  resolveColumnTrack,
  resolveColumnTracks,
  resolveColumnWidths,
  resolveInitialWidth,
} from './column-width'

interface Column {
  key: string
  width?: number | string
}

describe('@iris-ui-kit/core column width projection', () => {
  it('resolves numeric and px declarations with a shared fallback', () => {
    const numeric: Column = { key: 'numeric', width: 96 }
    const px: Column = { key: 'px', width: '80.5px' }
    const css: Column = { key: 'css', width: '1fr' }
    const invalid: Column = { key: 'invalid', width: -10 }

    expect(resolveInitialWidth(numeric)).toBe(96)
    expect(resolveInitialWidth(px)).toBe(80.5)
    expect(resolveInitialWidth(css)).toBe(DEFAULT_COLUMN_WIDTH)
    expect(resolveInitialWidth(css, 120)).toBe(120)
    expect(resolveInitialWidth(invalid)).toBe(DEFAULT_COLUMN_WIDTH)
    expect(resolveInitialWidth(invalid, Number.NaN)).toBe(DEFAULT_COLUMN_WIDTH)
    expect(resolveInitialWidth({ key: 'overflow', width: `${'9'.repeat(400)}px` })).toBe(
      DEFAULT_COLUMN_WIDTH,
    )
  })

  it('clamps resize results with the shared bounds and step contract', () => {
    expect(DEFAULT_COLUMN_MIN_WIDTH).toBe(60)
    expect(COLUMN_RESIZE_STEP).toBe(16)
    expect(clampColumnWidth(83.6)).toBe(84)
    expect(clampColumnWidth(40)).toBe(60)
    expect(clampColumnWidth(180, 60, 160)).toBe(160)
    expect(clampColumnWidth(83.6, 60, Infinity, false)).toBe(83.6)
    expect(clampColumnWidth(Number.NaN)).toBe(DEFAULT_COLUMN_WIDTH)
    expect(clampColumnWidth(Number.POSITIVE_INFINITY)).toBe(DEFAULT_COLUMN_WIDTH)
    expect(clampColumnWidth(-10)).toBe(DEFAULT_COLUMN_WIDTH)
    expect(clampColumnWidth(Number.MAX_VALUE, 0, Infinity, false)).toBe(Number.MAX_VALUE)
    expect(clampColumnWidth(100, Number.NaN, Number.NaN)).toBe(100)
  })

  it('uses only finite non-negative numeric overrides for layout math', () => {
    const column: Column = { key: 'name', width: 96 }

    expect(isValidColumnWidth(0)).toBe(true)
    expect(isValidColumnWidth(96.5)).toBe(true)
    expect(isValidColumnWidth(-1)).toBe(false)
    expect(isValidColumnWidth(Number.NaN)).toBe(false)
    expect(isValidColumnWidth(Number.POSITIVE_INFINITY)).toBe(false)
    expect(resolveColumnWidth(column, { name: 150 })).toBe(150)
    expect(resolveColumnWidth(column, { name: -1 })).toBe(96)
    expect(resolveColumnWidth({ key: 'px', width: '80px' }, {})).toBe(80)
    expect(resolveColumnWidth({ key: 'auto', width: 'auto' }, {})).toBe(DEFAULT_COLUMN_WIDTH)

    const inherited = Object.create({ name: 150 }) as Record<string, number>
    expect(resolveColumnWidth(column, inherited)).toBe(96)
    expect(resolveColumnTrack(column, inherited)).toBe('96px')
  })

  it('projects a flat sequence without changing its order', () => {
    const columns: Column[] = [{ key: 'a', width: 100 }, { key: 'b', width: '80px' }, { key: 'c' }]
    expect(resolveColumnWidths(columns, { c: 120 })).toEqual([100, 80, 120])
  })

  it('preserves authored CSS tracks while rejecting invalid numeric overrides', () => {
    const columns: Column[] = [
      { key: 'number', width: 100 },
      { key: 'auto', width: 'auto' },
      { key: 'length', width: 'minmax(80px, 1fr)' },
      { key: 'unset' },
    ]
    expect(resolveColumnTrack(columns[0]!, { number: 120 })).toBe('120px')
    expect(resolveColumnTrack(columns[0]!, { number: Number.NaN })).toBe('100px')
    expect(resolveColumnTrack(columns[1]!, {})).toBe('minmax(max-content, max-content)')
    expect(resolveColumnTrack(columns[2]!, {})).toBe('minmax(80px, 1fr)')
    expect(resolveColumnTrack(columns[3]!, {})).toBe('minmax(0, 1fr)')
    expect(resolveColumnTracks(columns, { number: 120 })).toEqual([
      '120px',
      'minmax(max-content, max-content)',
      'minmax(80px, 1fr)',
      'minmax(0, 1fr)',
    ])
  })
})
