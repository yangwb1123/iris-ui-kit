import { describe, expect, it } from 'vitest'
import { valueDistribution } from './value-distribution'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string | null
  level: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', level: 1 },
  { id: 2, name: 'Alice', status: 'paused', level: 2 },
  { id: 3, name: 'Bob', status: 'active', level: 3 },
  { id: 4, name: 'Dana', status: 'active', level: 1 },
  { id: 5, name: 'Erin', status: 'offline', level: 4 },
  { id: 6, name: 'Frank', status: null, level: 2 },
]

describe('@iris-ui-kit/core valueDistribution (batch AM, iris 独有)', () => {
  it('counts distinct values of a column', () => {
    const dist = valueDistribution(rows, 'status')
    expect(dist).toEqual([
      { value: 'active', count: 3 },
      { value: 'paused', count: 1 },
      { value: 'offline', count: 1 },
    ])
  })

  it('sorts by count DESCENDING (not by first appearance)', () => {
    const dist = valueDistribution(rows, 'name')
    // Every name appears once → the sort is stable, so first-appearance order.
    expect(dist.map((e) => e.value)).toEqual(['Charlie', 'Alice', 'Bob', 'Dana', 'Erin', 'Frank'])
    // lopsided column: 'active' (3) first, then the singles in first-appearance order.
    const dist2 = valueDistribution(rows, 'status')
    expect(dist2[0]).toEqual({ value: 'active', count: 3 })
    expect(dist2.slice(1).map((e) => e.value)).toEqual(['paused', 'offline'])
  })

  it('ties keep first-appearance order (stable across the descending sort)', () => {
    const tied = [{ k: 'b' }, { k: 'a' }, { k: 'b' }, { k: 'a' }]
    const dist = valueDistribution(tied, 'k')
    // Both count 2; first appearances are b(0) then a(1) — the tie keeps that
    // order instead of an alphabetical or insertion-sort flip.
    expect(dist).toEqual([
      { value: 'b', count: 2 },
      { value: 'a', count: 2 },
    ])
  })

  it('null / undefined / empty-string values are excluded (not counted)', () => {
    const dist = valueDistribution(rows, 'status')
    expect(dist.some((e) => e.value === '')).toBe(false)
    // Frank's null status contributes nothing: total counts = 5 rows with values.
    expect(dist.reduce((sum, e) => sum + e.count, 0)).toBe(5)
  })

  it('coerces values with String (number and string forms share one bucket)', () => {
    const mixed = [{ k: 1 }, { k: '1' }, { k: 2 }, { k: true }, { k: 'true' }, { k: false }]
    const dist = valueDistribution(mixed, 'k')
    // '1' and 'true' each appear twice → first, in first-appearance order;
    // the singles ('2', 'false') follow in first-appearance order.
    expect(dist).toEqual([
      { value: '1', count: 2 },
      { value: 'true', count: 2 },
      { value: '2', count: 1 },
      { value: 'false', count: 1 },
    ])
  })

  it('empty row list → []', () => {
    expect(valueDistribution([], 'status')).toEqual([])
  })

  it('all values excluded (null/empty) → []', () => {
    const allEmpty = [{ status: null }, { status: '' }, { status: undefined }]
    expect(valueDistribution(allEmpty, 'status')).toEqual([])
  })

  it('reads the key the caller passes (dataIndex indirection is adapter-side)', () => {
    // The react bridge passes `dataIndex ?? key` — a column keyed `status`
    // whose dataIndex is `state` reads `row.state`.
    const aliased = rows.map((r) => ({ id: r.id, state: r.status }))
    const dist = valueDistribution(aliased, 'state')
    expect(dist[0]).toEqual({ value: 'active', count: 3 })
  })

  it('unknown key → [] (no values match)', () => {
    expect(valueDistribution(rows, 'missing')).toEqual([])
  })
})
