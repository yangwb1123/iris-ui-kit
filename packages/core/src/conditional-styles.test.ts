import { describe, expect, it } from 'vitest'
import { matchConditionalStyles } from './conditional-styles'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  score: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', score: 10 },
  { id: 2, name: 'Alice', status: 'paused', score: 25 },
  { id: 3, name: 'Bob', status: 'active', score: 40 },
]

describe('@iris-ui-kit/core matchConditionalStyles (batch AX, iris 独有)', () => {
  it('applies a matching rule to the cell style', () => {
    const style = matchConditionalStyles(
      [
        {
          when: (row, value) => row.status === 'active' && (value as number) >= 30,
          style: { fontWeight: 'bold' },
        },
      ],
      rows[2],
      'score',
      rows[2].score,
    )
    expect(style).toEqual({ fontWeight: 'bold' })
  })

  it('column filter: a rule with `column` only applies to that column key', () => {
    const rules = [
      {
        column: 'score',
        when: (row: Row, value: unknown) => (value as number) >= 25,
        style: { color: 'red' },
      },
    ]
    // Same predicate, different column key → the rule is skipped.
    expect(matchConditionalStyles(rules, rows[1], 'status', rows[1].score)).toEqual({})
    expect(matchConditionalStyles(rules, rows[1], 'score', rows[1].score)).toEqual({ color: 'red' })
    // The predicate is NOT evaluated for a filtered-out column.
    let called = false
    const spy: typeof rules = [
      {
        column: 'score',
        when: () => ((called = true), true),
        style: { color: 'red' },
      },
    ]
    matchConditionalStyles(spy, rows[0], 'name', 'x')
    expect(called).toBe(false)
  })

  it('multiple rules merge in array order — later matches win on conflicts', () => {
    const rules = [
      { when: () => true, style: { background: 'yellow', color: 'black' } },
      {
        column: 'score',
        when: (row: Row, value: unknown) => (value as number) > 20,
        style: { background: 'green' },
      },
    ]
    // Later rule only overrides the conflicting key; the rest survive.
    expect(matchConditionalStyles(rules, rows[0], 'score', 10)).toEqual({
      background: 'yellow',
      color: 'black',
    })
    expect(matchConditionalStyles(rules, rows[2], 'score', 40)).toEqual({
      background: 'green',
      color: 'black',
    })
  })

  it('no matching rule → empty object (cell unchanged)', () => {
    const rules = [{ when: () => false, style: { background: 'red' } }]
    expect(matchConditionalStyles(rules, rows[0], 'name', 'Charlie')).toEqual({})
    expect(matchConditionalStyles([], rows[0], 'name', 'Charlie')).toEqual({})
  })

  it('column-less rules apply to every column', () => {
    const rules = [{ when: (row: Row) => row.status === 'active', style: { background: 'blue' } }]
    expect(matchConditionalStyles(rules, rows[0], 'name', 'Charlie')).toEqual({
      background: 'blue',
    })
    expect(matchConditionalStyles(rules, rows[0], 'score', 10)).toEqual({ background: 'blue' })
    expect(matchConditionalStyles(rules, rows[1], 'score', 25)).toEqual({})
  })

  it('input transparency: never mutates rules, row or rule styles', () => {
    const rule = { when: () => true, style: { background: 'red' } }
    const rules = [rule]
    const row = { ...rows[0] }
    const before = JSON.stringify({ rules, row })
    matchConditionalStyles(rules, row, 'name', 'Charlie')
    expect(JSON.stringify({ rules, row })).toBe(before)
    // Repeated calls return fresh objects, not shared references.
    const a = matchConditionalStyles(rules, row, 'name', 'Charlie')
    const b = matchConditionalStyles(rules, row, 'name', 'Charlie')
    expect(a).not.toBe(b)
  })
})
