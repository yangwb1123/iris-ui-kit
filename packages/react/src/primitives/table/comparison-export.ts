import { toCsv, type FormulaTables, type RowDiff } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'
import { applyCellMask } from './exportCsv'
import { withComputedFormulaCells } from './table-value-helpers'

/** Reserved key of the marker column prefixed to every exported diff row. */
const COMPARISON_DIFF_KEY = '__iris_diff'

/** Build the compare-diff CSV used by the table's compare export action. */
export function buildComparisonCsv<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  snapshot: readonly Row[],
  rowKeyField: string,
  diff: RowDiff,
  columns: readonly IrisTableColumn<Row>[],
  formulaTables: FormulaTables | undefined,
  markerTitle: string,
): string {
  const out: Row[] = []
  for (const row of rows) {
    const key = row[rowKeyField] as string | number | null | undefined
    if (key == null) continue
    const kind = diff.status.get(key)
    if (kind !== 'removed' && kind !== 'changed') continue
    out.push({ ...row, [COMPARISON_DIFF_KEY]: kind } as Row)
  }

  const snapshotByKey = new Map<string | number, Row>()
  for (const row of snapshot) {
    const key = row[rowKeyField] as string | number | null | undefined
    if (key != null) snapshotByKey.set(key, row)
  }
  for (const key of diff.added) {
    const row = snapshotByKey.get(key)
    if (row) out.push({ ...row, [COMPARISON_DIFF_KEY]: 'added' } as Row)
  }

  let materialized = withComputedFormulaCells(out, columns, formulaTables)
  const maskedCols = columns.filter((column) => column.mask && !column.exportRaw)
  if (maskedCols.length > 0) {
    materialized = materialized.map((row) => {
      let shadow: Row | null = null
      for (const column of maskedCols) {
        const key = (
          typeof column.dataIndex === 'string' ? column.dataIndex : column.key
        ) as keyof Row
        const next: Row = shadow ?? { ...row }
        ;(next as Record<string, unknown>)[key as string] = applyCellMask(
          (row as Record<string, unknown>)[key as string],
          column,
        )
        shadow = next
      }
      return shadow as Row
    })
  }

  const withComposite = materialized.map((row) => {
    const kind = (row as Record<string, unknown>)[COMPARISON_DIFF_KEY]
    if (kind !== 'changed') return row
    const key = (row as Record<string, unknown>)[rowKeyField] as string | number | null | undefined
    const changes = key == null ? undefined : diff.cellChanges.get(key)
    if (!changes) return row

    let shadow: Row | null = null
    for (const column of columns) {
      if (column.formula) continue
      const cellKey = (column.dataIndex ?? column.key) as keyof Row
      const change = changes.get(cellKey as string)
      if (!change) continue
      const oldSide = column.exportRaw ? change.oldValue : applyCellMask(change.oldValue, column)
      const newSide = column.exportRaw ? change.newValue : applyCellMask(change.newValue, column)
      const next: Row = shadow ?? { ...row }
      ;(next as Record<string, unknown>)[cellKey as string] = `${String(oldSide ?? '')} → ${String(
        newSide ?? '',
      )}`
      shadow = next
    }
    return (shadow ?? row) as Row
  })

  return toCsv(withComposite as readonly Record<string, unknown>[], [
    { key: COMPARISON_DIFF_KEY, title: markerTitle, dataIndex: COMPARISON_DIFF_KEY },
    ...columns.map((column) => ({
      key: column.key,
      title: column.title,
      dataIndex: typeof column.dataIndex === 'string' ? column.dataIndex : undefined,
    })),
  ])
}
