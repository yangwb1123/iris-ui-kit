import { memoizedFormulaValue } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'
import { DEFAULT_COL_WIDTH } from './styles'

/** Helper to guess a column's current pixel width. */
export function resolveColWidth(
  col: IrisTableColumn<Record<string, unknown>>,
  overrides: IrisTableColumnWidths,
): number {
  const o = overrides[col.key]
  if (o != null) return o
  if (typeof col.width === 'number') return col.width
  // parse "80px" → 80
  if (typeof col.width === 'string') {
    const m = /^(\d+)px$/.exec(col.width)
    if (m) return Number(m[1])
  }
  return DEFAULT_COL_WIDTH
}

/** Resolve column widths to an array of pixel widths. */
export function resolveAllColWidths(
  leafColumns: IrisTableColumn<Record<string, unknown>>[],
  overrides: IrisTableColumnWidths,
): number[] {
  return leafColumns.map((col) => resolveColWidth(col, overrides))
}

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  // Batch EL: a formula column reads the COMPUTED value (2-arg
  // memoizedFormulaValue — no tables slot, react AO byte semantics). This
  // choke point feeds sorting, filtering, summary, the cell render, edit
  // drafts, pattern hints and range copy, so the computed value flows
  // everywhere.
  if (column.formula) return memoizedFormulaValue(column.formula, row)
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/** Batch EL: a formula column is DISPLAY-ONLY even when `editable` — every
 * editing entry point (inline, row mode, click trigger, data-editable attr,
 * cursor) reads this same condition. */
export function isEditableColumn<Row extends Record<string, unknown>>(
  column: IrisTableColumn<Row>,
): boolean {
  return !!column.editable && !column.formula
}

/** CSV/range-copy shadow rows (batch EL): core `toCsv`/`serializeTableRange`
 * read `row[dataIndex]` directly, so formula columns materialize their
 * computed value onto a shallow copy (original rows untouched — immutable
 * row contract). No formula columns → the input array is returned as-is
 * (reference-preserving). */
export function withComputedFormulaCells<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
): Row[] {
  const formulaCols = columns.filter((c) => c.formula)
  if (formulaCols.length === 0) return rows as Row[]
  return rows.map((row) => {
    let shadow: Row | null = null
    for (const col of formulaCols) {
      const key = (col.dataIndex ?? col.key) as keyof Row
      const next: Row = shadow ?? { ...row }
      ;(next as Record<string, unknown>)[key as string] = memoizedFormulaValue(col.formula!, row)
      shadow = next
    }
    return shadow as Row
  })
}
