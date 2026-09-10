import {
  computeVisibleColumnIndices,
  DEFAULT_COLUMN_MIN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
  COLUMN_RESIZE_STEP,
  isTableColumnEditable,
  materializeTableFormulaValues,
  resolveTableColumnValue,
  resolveColumnWidth,
  type FormulaTables,
} from '@iris-ui-kit/core'
export { resolveInitialWidth } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

export const SELECTION_COL_WIDTH = 40
export const EXPAND_COL_WIDTH = 40
export const SEQ_COL_WIDTH = 40
export const DRAG_COL_WIDTH = 40
export const DEFAULT_COL_WIDTH = DEFAULT_COLUMN_WIDTH
export const DEFAULT_MIN_WIDTH = DEFAULT_COLUMN_MIN_WIDTH
export const RESIZE_STEP = COLUMN_RESIZE_STEP

/** Compatibility name for the Core edit-capability predicate. */
export const isEditableColumn = isTableColumnEditable

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
  formulaTables?: FormulaTables,
): unknown {
  return resolveTableColumnValue(row, column, formulaTables)
}

/** CSV/range-copy shadow rows (batch EK): core `toCsv`/`serializeTableRange`
 * read `row[dataIndex]` directly, so formula columns materialize their
 * computed value onto a shallow copy (original rows untouched — immutable
 * row contract). No formula columns → the input array is returned as-is
 * (reference-preserving). */
export function withComputedFormulaCells<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
  formulaTables?: FormulaTables,
): Row[] {
  return materializeTableFormulaValues(rows, columns, formulaTables)
}

export function computeVisibleColSet(
  enabled: boolean,
  columns: IrisTableColumn[],
  scrollLeft: number,
  viewportWidth: number,
  widths: IrisTableColumnWidths,
  pinOf: (column: IrisTableColumn) => 'left' | 'right' | null,
): Set<number> | null {
  return computeVisibleColumnIndices(enabled, {
    columns,
    scrollOffset: scrollLeft,
    viewportSize: viewportWidth,
    itemSize: (column) => resolveColumnWidth(column, widths),
    isAlwaysVisible: (column) => pinOf(column) !== null,
  })
}

export function cellId(rowIdent: string | number, columnKey: string): string {
  return `${rowIdent}::${columnKey}`
}
