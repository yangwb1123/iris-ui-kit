/**
 * Pure table body grouping projection.
 *
 * Adapters own group selection, collapse state, and rendering. Core owns the
 * ordered body plan so single- and multi-column grouping share the same
 * first-seen keys, row indexes, and subtree semantics.
 */

import { groupRows } from './data-view/aggregate'

/** Minimal column shape needed by the table grouping projection. */
export interface TableGroupColumn {
  readonly key: string
}

/** One framework-neutral entry in a grouped table body plan. */
export type TableGroupPlanEntry<Row> =
  | { kind: 'group-header'; groupKey: string; count: number; depth?: number; value?: string }
  | { kind: 'row'; row: Row; rowIndex: number }
  | { kind: 'group-summary'; groupKey: string; rows: Row[] }

export interface TableGroupPlanOptions<Row, Column extends TableGroupColumn = TableGroupColumn> {
  /** Read the raw value used to form each group key. */
  readonly getValue: (row: Row, column: Column) => unknown
  /** Group keys whose complete subtree should be omitted after its header. */
  readonly collapsedKeys?: ReadonlySet<string>
  /** Add innermost summary entries carrying each group's exact row array. */
  readonly hasSummary?: boolean
  /** Include `depth` and `value` on group headers; defaults to `true`. */
  readonly includeHeaderMetadata?: boolean
}

/**
 * Build the grouped body plan for already-resolved group columns.
 *
 * A single column produces bare `String(value)` keys. Additional columns nest
 * beneath the preceding key with `::`-joined composite identities. Groups and
 * rows remain in first-seen order; row indexes are looked up from the original
 * input by row identity. A collapsed header remains in the plan while its
 * rows, descendants, and summary are omitted. No resolved column is an
 * explicit no-op and returns `null`.
 */
export function buildTableGroupPlan<Row, Column extends TableGroupColumn = TableGroupColumn>(
  rows: readonly Row[],
  groupColumns: readonly Column[] | null | undefined,
  options: TableGroupPlanOptions<Row, Column>,
): TableGroupPlanEntry<Row>[] | null {
  if (!groupColumns || groupColumns.length === 0) return null

  // Keep every source slot for a repeated row identity. A Map<Row, number>
  // would overwrite duplicate references and make every rendered occurrence
  // report the last index (affecting seq/callback coordinates).
  const rowIndexesByIdentity = new Map<Row, number[]>()
  rows.forEach((row, index) => {
    const indexes = rowIndexesByIdentity.get(row)
    if (indexes) indexes.push(index)
    else rowIndexesByIdentity.set(row, [index])
  })
  const nextRowIndexByIdentity = new Map<Row, number>()

  const collapsedKeys = options.collapsedKeys
  const hasSummary = options.hasSummary === true
  const includeHeaderMetadata = options.includeHeaderMetadata !== false
  const plan: TableGroupPlanEntry<Row>[] = []

  const build = (currentRows: readonly Row[], level: number, prefix: readonly string[]): void => {
    const column = groupColumns[level]!
    const groups = groupRows(currentRows, (row) => String(options.getValue(row, column)))

    for (const group of groups) {
      const groupKey = level === 0 ? group.key : [...prefix, group.key].join('::')
      if (includeHeaderMetadata) {
        plan.push({
          kind: 'group-header',
          groupKey,
          count: group.rows.length,
          depth: level,
          value: group.key,
        })
      } else {
        plan.push({ kind: 'group-header', groupKey, count: group.rows.length })
      }

      if (collapsedKeys?.has(groupKey)) continue

      if (level === groupColumns.length - 1) {
        for (const row of group.rows) {
          const indexes = rowIndexesByIdentity.get(row)
          const occurrence = nextRowIndexByIdentity.get(row) ?? 0
          const rowIndex = indexes?.[occurrence] ?? 0
          if (indexes && occurrence < indexes.length) {
            nextRowIndexByIdentity.set(row, occurrence + 1)
          }
          plan.push({ kind: 'row', row, rowIndex })
        }
        if (hasSummary) plan.push({ kind: 'group-summary', groupKey, rows: group.rows })
      } else {
        build(group.rows, level + 1, [...prefix, group.key])
      }
    }
  }

  build(rows, 0, [])
  return plan
}
