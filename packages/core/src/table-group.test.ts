import { describe, expect, it } from 'vitest'
import { buildTableGroupPlan, type TableGroupColumn, type TableGroupPlanEntry } from './table-group'

type Row = {
  id: number
  dept: string | number | null
  status: string
  score: number
}

const rows: Row[] = [
  { id: 1, dept: 'Eng', status: 'Active', score: 100 },
  { id: 2, dept: 'Eng', status: 'Active', score: 150 },
  { id: 3, dept: 'Eng', status: 'Leave', score: 80 },
  { id: 4, dept: 'Ops', status: 'Active', score: 120 },
]

const columns: TableGroupColumn[] = [{ key: 'dept' }, { key: 'status' }]

const getValue = (row: Row, column: TableGroupColumn): unknown => row[column.key as keyof Row]

function headers<Row>(plan: TableGroupPlanEntry<Row>[]): Array<Record<string, unknown>> {
  return plan.filter(
    (entry): entry is Extract<TableGroupPlanEntry<Row>, { kind: 'group-header' }> =>
      entry.kind === 'group-header',
  )
}

describe('buildTableGroupPlan', () => {
  it('builds a single-column plan with first-seen String keys and original indexes', () => {
    const data: Row[] = [
      { id: 1, dept: 2, status: 'A', score: 1 },
      { id: 2, dept: '1', status: 'A', score: 2 },
      { id: 3, dept: 2, status: 'B', score: 3 },
      { id: 4, dept: 1, status: 'B', score: 4 },
    ]
    const plan = buildTableGroupPlan(data, [columns[0]!], { getValue })!

    expect(headers(plan)).toEqual([
      { kind: 'group-header', groupKey: '2', count: 2, depth: 0, value: '2' },
      { kind: 'group-header', groupKey: '1', count: 2, depth: 0, value: '1' },
    ])
    const rowEntries = plan.filter(
      (entry): entry is Extract<TableGroupPlanEntry<Row>, { kind: 'row' }> => entry.kind === 'row',
    )
    expect(rowEntries.map((entry) => entry.rowIndex)).toEqual([0, 2, 1, 3])
    expect(rowEntries[0]!.row).toBe(data[0])
    expect(rowEntries[1]!.row).toBe(data[2])
  })

  it('preserves each source index when the same row object occurs repeatedly', () => {
    const shared: Row = { id: 5, dept: 'Eng', status: 'Active', score: 10 }
    const plan = buildTableGroupPlan([shared, shared], [columns[0]!], { getValue })!
    const rowEntries = plan!.filter(
      (entry): entry is Extract<TableGroupPlanEntry<Row>, { kind: 'row' }> => entry.kind === 'row',
    )

    expect(rowEntries.map((entry) => entry.rowIndex)).toEqual([0, 1])
    expect(rowEntries.map((entry) => entry.row)).toEqual([shared, shared])
  })

  it('builds nested composite keys with level values and subtree counts', () => {
    const plan = buildTableGroupPlan(rows, columns, { getValue })!

    expect(headers(plan)).toEqual([
      { kind: 'group-header', groupKey: 'Eng', count: 3, depth: 0, value: 'Eng' },
      { kind: 'group-header', groupKey: 'Eng::Active', count: 2, depth: 1, value: 'Active' },
      { kind: 'group-header', groupKey: 'Eng::Leave', count: 1, depth: 1, value: 'Leave' },
      { kind: 'group-header', groupKey: 'Ops', count: 1, depth: 0, value: 'Ops' },
      { kind: 'group-header', groupKey: 'Ops::Active', count: 1, depth: 1, value: 'Active' },
    ])
    expect(plan.map((entry) => entry.kind)).toEqual([
      'group-header',
      'group-header',
      'row',
      'row',
      'group-header',
      'row',
      'group-header',
      'group-header',
      'row',
    ])
  })

  it('omits a collapsed subtree while keeping its header and full count', () => {
    const plan = buildTableGroupPlan(rows, columns, {
      getValue,
      collapsedKeys: new Set(['Eng']),
    })!

    expect(
      plan.map((entry) => (entry.kind === 'group-header' ? entry.groupKey : entry.kind)),
    ).toEqual(['Eng', 'Ops', 'Ops::Active', 'row'])
    expect(headers(plan)[0]).toMatchObject({ groupKey: 'Eng', count: 3, depth: 0 })

    const leafCollapsed = buildTableGroupPlan(rows, columns, {
      getValue,
      collapsedKeys: new Set(['Eng::Active']),
      hasSummary: true,
    })!
    expect(
      leafCollapsed.map((entry) =>
        entry.kind === 'group-header'
          ? `header:${entry.groupKey}`
          : entry.kind === 'group-summary'
            ? `summary:${entry.groupKey}`
            : `row:${entry.row.id}`,
      ),
    ).toEqual([
      'header:Eng',
      'header:Eng::Active',
      'header:Eng::Leave',
      'row:3',
      'summary:Eng::Leave',
      'header:Ops',
      'header:Ops::Active',
      'row:4',
      'summary:Ops::Active',
    ])
  })

  it('adds summaries only at the innermost level and preserves exact group rows', () => {
    const plan = buildTableGroupPlan(rows, columns, { getValue, hasSummary: true })!
    const summaries = plan.filter(
      (entry): entry is Extract<TableGroupPlanEntry<Row>, { kind: 'group-summary' }> =>
        entry.kind === 'group-summary',
    )

    expect(summaries.map((entry) => entry.groupKey)).toEqual([
      'Eng::Active',
      'Eng::Leave',
      'Ops::Active',
    ])
    expect(summaries[0]!.rows.map((row) => row.id)).toEqual([1, 2])
    expect(summaries[0]!.rows[0]).toBe(rows[0])
    expect(summaries[0]!.rows[1]).toBe(rows[1])
  })

  it('leaves unknown and duplicate requested keys to resolution, then plans the resolved order', () => {
    const requested = ['dept', 'missing', 'dept', 'status', 'missing']
    const resolved: TableGroupColumn[] = []
    for (const key of requested) {
      const column = columns.find((candidate) => candidate.key === key)
      if (column && !resolved.some((candidate) => candidate.key === column.key)) {
        resolved.push(column)
      }
    }

    const plan = buildTableGroupPlan(rows, resolved, { getValue })!
    expect(headers(plan).map((entry) => entry.groupKey)).toEqual([
      'Eng',
      'Eng::Active',
      'Eng::Leave',
      'Ops',
      'Ops::Active',
    ])
  })

  it('returns null without a resolved group column and an empty plan for empty rows', () => {
    expect(buildTableGroupPlan(rows, null, { getValue })).toBeNull()
    expect(buildTableGroupPlan(rows, [], { getValue })).toBeNull()
    expect(buildTableGroupPlan([], columns, { getValue })).toEqual([])
  })

  it('can omit header metadata for the legacy single-column entry shape', () => {
    const plan = buildTableGroupPlan(rows, [columns[0]!], {
      getValue,
      includeHeaderMetadata: false,
    })!
    expect(plan[0]).toEqual({ kind: 'group-header', groupKey: 'Eng', count: 3 })
  })
})
