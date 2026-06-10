import { describe, expect, it } from 'vitest'
import { flattenLeafColumns, buildHeaderMatrix, type ColumnTreeNode } from './columns'

interface Col extends ColumnTreeNode {
  key: string
  title?: string
  children?: Col[]
}

const flat: Col[] = [{ key: 'a' }, { key: 'b' }]

// name + (age, city) group + score
const grouped: Col[] = [
  { key: 'name' },
  { key: 'info', children: [{ key: 'age' }, { key: 'city' }] },
  { key: 'score' },
]

describe('flattenLeafColumns', () => {
  it('returns the input for a flat forest', () => {
    expect(flattenLeafColumns(flat).map((c) => c.key)).toEqual(['a', 'b'])
  })
  it('returns leaves left-to-right for a grouped forest', () => {
    expect(flattenLeafColumns(grouped).map((c) => c.key)).toEqual(['name', 'age', 'city', 'score'])
  })
})

describe('buildHeaderMatrix', () => {
  it('flat forest → one row of rowSpan-1 cells', () => {
    const matrix = buildHeaderMatrix(flat)
    expect(matrix).toHaveLength(1)
    expect(matrix[0].map((c) => [c.column.key, c.colSpan, c.rowSpan])).toEqual([
      ['a', 1, 1],
      ['b', 1, 1],
    ])
  })

  it('grouped forest → two rows with correct col/row spans', () => {
    const matrix = buildHeaderMatrix(grouped)
    expect(matrix).toHaveLength(2)
    // Row 0: name (leaf, spans both rows), info group (spans its 2 leaves), score (leaf)
    expect(matrix[0].map((c) => [c.column.key, c.colSpan, c.rowSpan])).toEqual([
      ['name', 1, 2],
      ['info', 2, 1],
      ['score', 1, 2],
    ])
    // Row 1: the group's children
    expect(matrix[1].map((c) => [c.column.key, c.colSpan, c.rowSpan])).toEqual([
      ['age', 1, 1],
      ['city', 1, 1],
    ])
  })

  it('records level + 1-based colStart for grid placement', () => {
    const matrix = buildHeaderMatrix(grouped)
    expect(matrix[0].map((c) => [c.column.key, c.level, c.colStart])).toEqual([
      ['name', 0, 1],
      ['info', 0, 2], // group begins at leaf column 2 (age)
      ['score', 0, 4], // after name + age + city
    ])
    expect(matrix[1].map((c) => [c.column.key, c.level, c.colStart])).toEqual([
      ['age', 1, 2],
      ['city', 1, 3],
    ])
  })

  it('the total colSpan of the top row equals the leaf count', () => {
    const top = buildHeaderMatrix(grouped)[0]
    const totalSpan = top.reduce((s, c) => s + c.colSpan, 0)
    expect(totalSpan).toBe(flattenLeafColumns(grouped).length) // 4
  })

  it('handles three levels of nesting', () => {
    const deep: Col[] = [{ key: 'g1', children: [{ key: 'g2', children: [{ key: 'leaf' }] }] }]
    const matrix = buildHeaderMatrix(deep)
    expect(matrix).toHaveLength(3)
    expect(matrix[2][0].column.key).toBe('leaf')
    expect(matrix[0][0]).toMatchObject({ colSpan: 1, rowSpan: 1 }) // group, one leaf under it
  })

  it('empty forest → empty matrix', () => {
    expect(buildHeaderMatrix([])).toEqual([])
  })
})
