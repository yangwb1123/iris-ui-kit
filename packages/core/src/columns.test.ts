import { describe, expect, it } from 'vitest'
import {
  applyColumnOrder,
  applyColumnVisibility,
  computePinnedColumnOffsets,
  reorderColumnsInList,
  reorderColumnsInListAt,
  flattenLeafColumns,
  buildHeaderMatrix,
  dataIndexOf,
  readCell,
  type ColumnTreeNode,
} from './columns'

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

describe('applyColumnOrder', () => {
  it('orders known keys, preserves omitted source order, and ignores unknown/repeated keys', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
    expect(
      applyColumnOrder(columns, ['c', 'missing', 'c', 'a']).map((column) => column.key),
    ).toEqual(['c', 'a', 'b'])
    expect(columns.map((column) => column.key)).toEqual(['a', 'b', 'c'])
  })

  it('preserves the source reference when order is unset or empty', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }]
    expect(applyColumnOrder(columns, undefined)).toBe(columns)
    expect(applyColumnOrder(columns, [])).toBe(columns)
  })
})

describe('reorderColumnsInList', () => {
  it('supports auto and explicit placement without mutating columns', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
    expect(reorderColumnsInList(columns, 'a', 'c').map((column) => column.key)).toEqual([
      'b',
      'c',
      'a',
    ])
    expect(reorderColumnsInList(columns, 'a', 'c', 'before').map((column) => column.key)).toEqual([
      'b',
      'a',
      'c',
    ])
    expect(reorderColumnsInList(columns, 'c', 'a', 'after').map((column) => column.key)).toEqual([
      'a',
      'c',
      'b',
    ])
    expect(columns.map((column) => column.key)).toEqual(['a', 'b', 'c'])
  })

  it('preserves identity for missing or same keys', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }]
    expect(reorderColumnsInList(columns, 'missing', 'b')).toBe(columns)
    expect(reorderColumnsInList(columns, 'a', 'a')).toBe(columns)
  })
})

describe('reorderColumnsInListAt', () => {
  it('keeps insertion indexes in original-list space', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
    expect(reorderColumnsInListAt(columns, 'a', 1).map((column) => column.key)).toEqual([
      'b',
      'a',
      'c',
    ])
    expect(reorderColumnsInListAt(columns, 'a', 3).map((column) => column.key)).toEqual([
      'b',
      'c',
      'a',
    ])
    expect(reorderColumnsInListAt(columns, 'b', 1)).toBe(columns)
  })
})

describe('readCell', () => {
  it('reads own fields only, including an own prototype-sensitive key', () => {
    const inherited = Object.create({ name: 'inherited' }) as Record<string, unknown>
    expect(readCell(inherited, { key: 'name' })).toBeUndefined()

    const row = Object.create(null) as Record<string, unknown>
    Object.defineProperty(row, '__proto__', { value: 'own', enumerable: true })
    expect(dataIndexOf({ key: 'fallback', dataIndex: '__proto__' })).toBe('__proto__')
    expect(readCell(row, { key: 'fallback', dataIndex: '__proto__' })).toBe('own')
  })
})

describe('applyColumnVisibility', () => {
  it('filters only top-level columns and leaves grouped declarations intact', () => {
    const columns: Col[] = [
      { key: 'name' },
      { key: 'group', children: [{ key: 'age' }, { key: 'city' }] },
      { key: 'status' },
    ]
    const visible = applyColumnVisibility(columns, { age: false, status: false })
    expect(visible.map((column) => column.key)).toEqual(['name', 'group'])
    expect(visible[1]?.children?.map((column) => column.key)).toEqual(['age', 'city'])
  })

  it('preserves the source reference for an absent or empty map', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }]
    expect(applyColumnVisibility(columns, undefined)).toBe(columns)
    expect(applyColumnVisibility(columns, {})).toBe(columns)
  })

  it('ignores inherited visibility entries', () => {
    const columns: Col[] = [{ key: 'a' }]
    const visibility = Object.create({ a: false }) as Record<string, boolean>
    expect(applyColumnVisibility(columns, visibility)).toEqual(columns)
  })
})

describe('computePinnedColumnOffsets', () => {
  it('accumulates left offsets from leading tracks and right offsets from the far edge', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }]
    const widths = { a: 80, b: 120, c: 90, d: 70 }
    const pins: Record<string, 'left' | 'right' | null> = {
      a: 'left',
      b: 'left',
      c: null,
      d: 'right',
    }

    expect(
      computePinnedColumnOffsets(
        columns,
        (column) => widths[column.key as keyof typeof widths],
        (column) => pins[column.key] ?? null,
        40,
      ),
    ).toEqual({
      a: { side: 'left', offset: 40 },
      b: { side: 'left', offset: 120 },
      d: { side: 'right', offset: 0 },
    })
  })

  it('does not mutate or add entries for unpinned leaves', () => {
    const columns: Col[] = [{ key: 'a' }, { key: 'b' }]
    const result = computePinnedColumnOffsets(
      columns,
      () => 100,
      (column) => (column.key === 'a' ? 'left' : null),
    )
    expect(result).toEqual({ a: { side: 'left', offset: 0 } })
    expect(columns).toEqual([{ key: 'a' }, { key: 'b' }])
  })

  it('fails closed for malformed widths and duplicate/prototype-sensitive keys', () => {
    const columns: Col[] = [{ key: '__proto__' }, { key: 'dup' }, { key: 'dup' }]
    const result = computePinnedColumnOffsets(
      columns,
      (column) => (column.key === '__proto__' ? Number.NaN : Infinity),
      () => 'left',
      -5,
    )

    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true)
    expect(Object.keys(result)).toEqual(['__proto__', 'dup'])
    expect(result['__proto__']).toEqual({ side: 'left', offset: 0 })
    expect(result.dup).toEqual({ side: 'left', offset: 0 })
    expect(Object.values(result).every(({ offset }) => Number.isFinite(offset))).toBe(true)

    const overflow = computePinnedColumnOffsets(
      [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }],
      () => Number.MAX_VALUE,
      () => 'left',
    )
    expect(Object.values(overflow).every(({ offset }) => Number.isFinite(offset))).toBe(true)
  })
})

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

  it('terminates on cyclic and malformed child trees', () => {
    const cyclic = { key: 'cycle' } as Col
    cyclic.children = [cyclic]
    const malformed = { key: 'malformed', children: {} as Col[] } as Col

    expect(flattenLeafColumns([cyclic, malformed]).map((column) => column.key)).toEqual([
      'cycle',
      'malformed',
    ])
    expect(
      buildHeaderMatrix([cyclic, malformed])
        .flat()
        .map((cell) => cell.colSpan),
    ).toEqual([1, 1, 1])
  })
})
