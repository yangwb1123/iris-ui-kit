import { describe, expect, it } from 'vitest'
import { filterTableRows, mergeFilterValues, type TableFilterColumn } from './table-filter'

interface Row {
  name: string
  role: string
  age: number
  active: boolean
}

const rows: Row[] = [
  { name: 'Alice', role: 'admin', age: 34, active: true },
  { name: 'Bob', role: 'editor', age: 28, active: false },
  { name: 'Charlie', role: 'admin', age: 41, active: true },
]

const columns: TableFilterColumn<Row>[] = [
  { key: 'name' },
  { key: 'role' },
  { key: 'age' },
  { key: 'active' },
]

const getValue = (row: Row, column: TableFilterColumn<Row>): unknown => row[column.key as keyof Row]

describe('mergeFilterValues', () => {
  it('joins active sets without mutating inputs and preserves empty entries', () => {
    const filters = { role: 'admin', name: 'a' }
    const values = { role: ['admin', 'editor'], name: [] as string[] }
    const merged = mergeFilterValues(filters, values)
    expect(merged).toEqual({ role: 'admin,editor', name: 'a' })
    expect(filters).toEqual({ role: 'admin', name: 'a' })
    expect(values).toEqual({ role: ['admin', 'editor'], name: [] })
  })
})

describe('filterTableRows', () => {
  it('supports substring matching, custom methods, and unknown keys', () => {
    expect(
      filterTableRows(rows, columns, { getValue, filters: { name: 'AL' } }).map((row) => row.name),
    ).toEqual(['Alice'])

    const custom: TableFilterColumn<Row>[] = [
      ...columns.slice(0, 3),
      { key: 'active', filterMethod: (value, _row, expected) => String(value) === expected },
    ]
    expect(
      filterTableRows(rows, custom, { getValue, filters: { active: 'true', missing: 'x' } }).map(
        (row) => row.name,
      ),
    ).toEqual(['Alice', 'Charlie'])
  })

  it('filters grouped-table rows with the leaf column projection', () => {
    const grouped = {
      key: 'identity',
      children: [{ key: 'name' }, { key: 'role' }],
    } as unknown as TableFilterColumn<Row> & { children: TableFilterColumn<Row>[] }
    expect(
      filterTableRows(rows, grouped.children, {
        getValue,
        filters: { role: 'editor' },
      }).map((row) => row.name),
    ).toEqual(['Bob'])
  })

  it('ANDs checked maps while ORing values in each map', () => {
    const result = filterTableRows(rows, columns, {
      getValue,
      filterValues: { role: ['admin', 'editor'] },
      additionalFilterValues: [{ active: ['true'] }],
    })
    expect(result.map((row) => row.name)).toEqual(['Alice', 'Charlie'])
  })

  it('fails closed when a custom filter method throws', () => {
    const throwing: TableFilterColumn<Row>[] = [
      {
        key: 'name',
        filterMethod: () => {
          throw new Error('bad filter')
        },
      },
    ]
    expect(filterTableRows(rows, throwing, { getValue, filters: { name: 'a' } })).toEqual([])
  })

  it('ignores malformed runtime filter channels and empty values', () => {
    const noOp = filterTableRows(rows, columns, {
      getValue,
      filters: { name: 42 } as unknown as Record<string, string>,
      filterValues: { role: null } as unknown as Record<string, readonly string[]>,
      additionalFilterValues: [null] as unknown as TableFilterValues[],
      filterRules: [null] as unknown as never[],
    })
    expect(noOp).toBe(rows)
  })

  it('combines text and typed rules and preserves identity for a no-op', () => {
    const noOp = filterTableRows(rows, columns, { getValue })
    expect(noOp).toBe(rows)
    const result = filterTableRows(rows, columns, {
      getValue,
      filters: { name: 'a' },
      filterRules: [{ key: 'age', operator: 'gte', value: 40 }],
    })
    expect(result.map((row) => row.name)).toEqual(['Charlie'])
  })
})
