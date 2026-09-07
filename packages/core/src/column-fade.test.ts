import { describe, expect, it } from 'vitest'
import {
  advanceColumnFade,
  commitColumnFade,
  expandColumnFadeToLeaves,
  isColumnFadeCollapsed,
  mergeColumnFadeVisibility,
  startColumnFade,
  type ColumnFadeOverlay,
} from './column-fade'

describe('column fade projection', () => {
  it('creates pending entries for sparse visibility changes', () => {
    expect(startColumnFade({}, { hidden: false })).toEqual({
      hidden: { dir: 'out', phase: 'pending' },
    })
    expect(startColumnFade({ hidden: false }, {})).toEqual({
      hidden: { dir: 'in', phase: 'pending' },
    })
  })

  it('restarts an in-flight entry and can ignore stale keys', () => {
    const current: ColumnFadeOverlay = { a: { dir: 'out', phase: 'run' } }
    expect(startColumnFade({ a: false }, { a: true }, current, (key) => key === 'a')).toEqual({
      a: { dir: 'in', phase: 'pending' },
    })
    expect(startColumnFade({}, { stale: false }, {}, () => false)).toBeUndefined()
  })

  it('advances pending entries without changing settled entries', () => {
    const current: ColumnFadeOverlay = {
      a: { dir: 'in', phase: 'pending' },
      b: { dir: 'out', phase: 'run' },
    }
    expect(advanceColumnFade(current)).toEqual({
      a: { dir: 'in', phase: 'run' },
      b: { dir: 'out', phase: 'run' },
    })
    expect(advanceColumnFade({ b: { dir: 'out', phase: 'run' } })).toBeUndefined()
  })

  it('commits only entries whose latest visibility reached the target', () => {
    const current: ColumnFadeOverlay = {
      hidden: { dir: 'out', phase: 'run' },
      shown: { dir: 'in', phase: 'run' },
      interrupted: { dir: 'out', phase: 'run' },
    }
    expect(commitColumnFade(current, { hidden: false, shown: true, interrupted: true })).toEqual({
      interrupted: { dir: 'out', phase: 'run' },
    })
  })

  it('keeps identity when no overlay is active and merges active keys', () => {
    const visibility = { a: false }
    expect(mergeColumnFadeVisibility(visibility, {})).toBe(visibility)
    expect(mergeColumnFadeVisibility(visibility, { b: { dir: 'in', phase: 'pending' } })).toEqual({
      a: false,
      b: true,
    })
  })

  it('maps a grouped entry to all leaf columns', () => {
    const columns = [{ key: 'group', children: [{ key: 'a' }, { key: 'b' }] }, { key: 'c' }]
    expect(expandColumnFadeToLeaves({ group: { dir: 'out', phase: 'run' } }, columns)).toEqual({
      a: { dir: 'out', phase: 'run' },
      b: { dir: 'out', phase: 'run' },
    })
  })

  it('uses the same collapsed phase predicate for both directions', () => {
    expect(isColumnFadeCollapsed({ dir: 'in', phase: 'pending' })).toBe(true)
    expect(isColumnFadeCollapsed({ dir: 'in', phase: 'run' })).toBe(false)
    expect(isColumnFadeCollapsed({ dir: 'out', phase: 'run' })).toBe(true)
    expect(isColumnFadeCollapsed({ dir: 'out', phase: 'pending' })).toBe(false)
  })
})
