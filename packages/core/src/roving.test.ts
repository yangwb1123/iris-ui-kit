import { describe, it, expect } from 'vitest'
import { nextEnabledIndex, firstEnabledIndex, lastEnabledIndex } from './roving'

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
