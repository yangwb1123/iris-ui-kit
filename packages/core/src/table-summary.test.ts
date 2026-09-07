import { describe, expect, it } from 'vitest'
import { buildTableGroupPlan } from './table-group'
import { resolveTableColumnValue } from './table-values'
import { projectTableSummary, projectTableSummaryCell } from './table-summary'

type Row = Record<string, unknown> & {
  id: number
  amount: unknown
  price?: number
  qty?: number
  dept?: string
}

type Column = {
  key: string
  summary?: 'sum' | 'avg' | 'min' | 'max' | 'count'
  formula?: string
}

const columns: Column[] = [
  { key: 'amount', summary: 'sum' },
  { key: 'counted', summary: 'count' },
  { key: 'label' },
]

const read = (row: Row, column: Column): unknown =>
  column.formula ? resolveTableColumnValue(row, column) : row[column.key as keyof Row]

describe('table summary projection', () => {
  it('keeps the legacy empty and no-summary gates while preserving aggregate empty values', () => {
    const empty = projectTableSummary([], columns, read)
    expect(empty.shouldRender).toBe(false)
    expect(empty.cells.map((cell) => cell.value)).toEqual([0, 0, null])

    const noSummary = projectTableSummary([{ id: 1, amount: 2 }], [{ key: 'label' }], read)
    expect(noSummary.shouldRender).toBe(false)
    expect(noSummary.cells).toEqual([{ key: 'label', value: null }])
  })

  it('delegates null, zero, numeric-string, and operation semantics to Core aggregate', () => {
    const rows: Row[] = [
      { id: 1, amount: null },
      { id: 2, amount: 0 },
      { id: 3, amount: '2' },
      { id: 4, amount: 'not numeric' },
    ]
    const projection = projectTableSummary(
      rows,
      [
        { key: 'amount', summary: 'sum' },
        { key: 'amount', summary: 'avg' },
        { key: 'amount', summary: 'min' },
        { key: 'amount', summary: 'max' },
        { key: 'amount', summary: 'count' },
      ],
      read,
    )
    expect(projection.cells.map((cell) => cell.value)).toEqual([2, 1, 0, 2, 3])
  })

  it('rounds only at the shared accuracy point and leaves invalid accuracy untouched', () => {
    const column = { key: 'amount', summary: 'sum' as const }
    const rows: Row[] = [
      { id: 1, amount: 1.234 },
      { id: 2, amount: 2.345 },
    ]
    expect(projectTableSummaryCell(rows, column, read, 2).value).toBe(3.58)
    expect(projectTableSummaryCell(rows, column, read, Number.NaN).value).toBe(3.579)
    expect(projectTableSummaryCell(rows, column, read, Number.POSITIVE_INFINITY).value).toBe(3.579)
    expect(projectTableSummaryCell(rows, column, read, 2.5).value).toBe(3.579)
    expect(projectTableSummaryCell(rows, column, read, -1).value).toBe(3.579)
    expect(projectTableSummaryCell(rows, column, read, 101).value).toBe(3.579)
  })

  it('uses the adapter value bridge for formula columns while leaving rendering to adapters', () => {
    const formulaColumn = { key: 'total', formula: 'price * qty', summary: 'sum' as const }
    const rows: Row[] = [
      { id: 1, amount: null, price: 10, qty: 3 },
      { id: 2, amount: null, price: 5, qty: 4 },
    ]
    const projection = projectTableSummary(rows, [formulaColumn], (row, column) =>
      resolveTableColumnValue(row, column),
    )
    expect(projection.cells[0]?.value).toBe(50)
  })

  it('fails closed for malformed columns and operations without disturbing authored order', () => {
    const malformed = [
      null,
      { key: 'amount', summary: 'bogus' },
      { key: 'amount', summary: 'sum' },
    ] as unknown as Column[]
    const projection = projectTableSummary([{ id: 1, amount: 2 }], malformed, read)
    expect(projection.cells).toEqual([
      { key: '', value: null },
      { key: 'amount', value: null },
      { key: 'amount', operation: 'sum', value: 2 },
    ])
    expect(projection.shouldRender).toBe(true)
  })

  it('does not render or invoke a malformed value bridge, but preserves callback exceptions', () => {
    const column = { key: 'amount', summary: 'sum' as const }
    const malformed = projectTableSummary([{ id: 1, amount: 2 }], [column], undefined as never)
    expect(malformed).toEqual({
      shouldRender: false,
      cells: [{ key: 'amount', operation: 'sum', value: null }],
    })

    const error = new Error('value bridge failed')
    expect(() =>
      projectTableSummary([{ id: 1, amount: 2 }], [column], () => {
        throw error
      }),
    ).toThrow(error)
  })

  it('preserves duplicate columns, input identity, and unknown-column defaults', () => {
    const rows: Row[] = [{ id: 1, amount: 2 }]
    const duplicateColumns: Column[] = [
      { key: 'missing', summary: 'sum' },
      { key: 'amount', summary: 'sum' },
      { key: 'amount', summary: 'count' },
    ]
    const snapshot = duplicateColumns.slice()
    const projection = projectTableSummary(rows, duplicateColumns, read)
    expect(projection.cells.map((cell) => cell.value)).toEqual([0, 2, 1])
    expect(projection.cells.map((cell) => cell.key)).toEqual(['missing', 'amount', 'amount'])
    expect(duplicateColumns).toEqual(snapshot)
    expect(rows).toEqual([{ id: 1, amount: 2 }])
  })

  it('projects overflow without turning valid finite input into an exception', () => {
    const rows: Row[] = [
      { id: 1, amount: Number.MAX_VALUE },
      { id: 2, amount: Number.MAX_VALUE },
    ]
    expect(projectTableSummaryCell(rows, { key: 'amount', summary: 'sum' }, read).value).toBe(
      Infinity,
    )
    expect(projectTableSummaryCell(rows, { key: 'amount', summary: 'avg' }, read).value).toBe(
      Number.MAX_VALUE,
    )
  })

  it('projects the rows supplied by a remote page and preserves group summary placement data', () => {
    const remotePage: Row[] = [{ id: 2, amount: 20, dept: 'Ops' }]
    expect(
      projectTableSummary(remotePage, [{ key: 'amount', summary: 'sum' }], read).cells[0]?.value,
    ).toBe(20)

    const grouped = buildTableGroupPlan(
      [
        { id: 1, amount: 10, dept: 'Eng' },
        { id: 2, amount: 20, dept: 'Eng' },
        { id: 3, amount: 5, dept: 'Ops' },
      ],
      [{ key: 'dept' }],
      { getValue: (row) => row.dept, hasSummary: true },
    )!
    const group = grouped.find(
      (entry) => entry.kind === 'group-summary' && entry.groupKey === 'Eng',
    )
    expect(group?.kind).toBe('group-summary')
    if (group?.kind === 'group-summary') {
      expect(
        projectTableSummary(group.rows, [{ key: 'amount', summary: 'sum' }], read).cells[0]?.value,
      ).toBe(30)
    }
  })
})
