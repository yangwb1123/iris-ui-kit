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
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}
