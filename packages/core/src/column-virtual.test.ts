import { describe, expect, it } from 'vitest'
import { computeVisibleColumnIndices } from './column-virtual'

const columns = ['a', 'b', 'c', 'd', 'e', 'f']

describe('@iris-ui-kit/core column virtualization projection', () => {
  it('returns null when disabled', () => {
    expect(
      computeVisibleColumnIndices(false, {
        columns,
        scrollOffset: 0,
        viewportSize: 100,
        itemSize: () => 50,
      }),
    ).toBeNull()
  })

  it('returns the virtual window with overscan', () => {
    const visible = computeVisibleColumnIndices(true, {
      columns,
      scrollOffset: 100,
      viewportSize: 100,
      itemSize: () => 50,
      buffer: 1,
    })
    expect([...visible!]).toEqual([1, 2, 3, 4])
  })

  it('unions pinned or transitional columns with the virtual window', () => {
    const visible = computeVisibleColumnIndices(true, {
      columns,
      scrollOffset: 200,
      viewportSize: 50,
      itemSize: () => 50,
      buffer: 0,
      isAlwaysVisible: (column) => column === 'a' || column === 'f',
    })
    expect([...visible!].sort((left, right) => left - right)).toEqual([0, 4, 5])
  })

  it('fails closed for invalid size estimates', () => {
    const visible = computeVisibleColumnIndices(true, {
      columns: ['a', 'b'],
      scrollOffset: 0,
      viewportSize: 20,
      itemSize: (column) => (column === 'a' ? Number.NaN : Number.POSITIVE_INFINITY),
    })
    expect([...visible!]).toEqual([0, 1])
  })
})
