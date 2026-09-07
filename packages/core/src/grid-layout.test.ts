import { describe, expect, it } from 'vitest'
import {
  columnGridTrack,
  countLeadingGridTracks,
  leadingGridTrack,
  resolveGridTemplateColumns,
} from './grid-layout'

describe('@iris-ui-kit/core grid track placement', () => {
  it('counts only enabled leading utility tracks', () => {
    expect(countLeadingGridTracks()).toBe(0)
    expect(countLeadingGridTracks({ rowDrag: true, sequence: true })).toBe(2)
    expect(
      countLeadingGridTracks({ rowDrag: true, sequence: true, detail: true, selection: true }),
    ).toBe(4)
  })

  it('maps zero-based leaf indices to one-based CSS tracks', () => {
    expect(columnGridTrack(0, 0)).toBe(1)
    expect(columnGridTrack(0, 4)).toBe(5)
    expect(columnGridTrack(3, 2)).toBe(6)
  })

  it('locates enabled utility tracks in the same order as leaf placement', () => {
    const options = { rowDrag: true, sequence: true, detail: true, selection: true }
    expect(leadingGridTrack('rowDrag', options)).toBe(1)
    expect(leadingGridTrack('sequence', options)).toBe(2)
    expect(leadingGridTrack('detail', options)).toBe(3)
    expect(leadingGridTrack('selection', options)).toBe(4)
    expect(leadingGridTrack('selection', { rowDrag: true, detail: true, selection: true })).toBe(3)
  })

  it('returns null for a disabled utility without changing the count', () => {
    const options = { rowDrag: true, selection: false }
    expect(leadingGridTrack('selection', options)).toBeNull()
    expect(countLeadingGridTracks(options)).toBe(1)
  })

  it('resolves leading tracks and authored column widths in order', () => {
    const columns = [
      { key: 'name', width: 120 },
      { key: 'notes', width: 'minmax(0, 1fr)' },
    ]
    expect(resolveGridTemplateColumns(columns, undefined, { leadingTracks: [40, '60px'] })).toBe(
      '40px 60px 120px minmax(0, 1fr)',
    )
  })

  it('collapses selected columns without changing the source declarations', () => {
    const columns = [
      { key: 'a', width: 80 },
      { key: 'b', width: 90 },
    ]
    expect(
      resolveGridTemplateColumns(columns, undefined, {
        isCollapsed: (column) => column.key === 'b',
      }),
    ).toBe('80px 0px')
    expect(columns[1]?.width).toBe(90)
  })

  it('supports an adapter-specific track projection', () => {
    const columns = [
      { key: 'a', width: 'auto' },
      { key: 'b', width: 80 },
    ]
    expect(
      resolveGridTemplateColumns(columns, undefined, {
        trackOf: (column) => `${column.width === 'auto' ? 140 : column.width}px`,
      }),
    ).toBe('140px 80px')
  })
})
