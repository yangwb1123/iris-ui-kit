import {
  isTableColumnEditable,
  materializeTableFormulaValues,
  resolveColumnWidth,
  resolveColumnWidths,
  resolveTableColumnValue,
} from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnWidths, IrisTableFormulaTables } from './types'

/** Helper to guess a column's current pixel width. */
export function resolveColWidth(
  col: IrisTableColumn<Record<string, unknown>>,
  overrides: IrisTableColumnWidths,
): number {
  return resolveColumnWidth(col, overrides)
}

/** Resolve column widths to an array of pixel widths. */
export function resolveAllColWidths(
  leafColumns: IrisTableColumn<Record<string, unknown>>[],
  overrides: IrisTableColumnWidths,
): number[] {
  return resolveColumnWidths(leafColumns, overrides)
}

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
  formulaTables?: IrisTableFormulaTables<Row>,
): unknown {
  return resolveTableColumnValue(row, column, formulaTables)
}

/** Compatibility name for the Core edit-capability predicate. */
export const isEditableColumn = isTableColumnEditable

/** CSV/range-copy shadow rows: core `toCsv`/`serializeTableRange` read
 * `row[dataIndex]` directly, so formula columns materialize their computed
 * value onto a shallow copy (original rows untouched — immutable row
 * contract). No formula columns → the input array is returned as-is
 * (reference-preserving). */
export function withComputedFormulaCells<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
  formulaTables?: IrisTableFormulaTables<Row>,
): Row[] {
  return materializeTableFormulaValues(rows, columns, formulaTables)
}
