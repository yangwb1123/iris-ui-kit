import {
  applyTableMask,
  clampColumnWidth,
  COLUMN_RESIZE_STEP,
  computeVisibleColumnIndices,
  DEFAULT_COLUMN_MIN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
  filterTableRows,
  mergeFilterValues,
  isValidColumnWidth,
  isTableColumnEditable,
  materializeTableFormulaValues,
  resolveColumnWidth,
  resolveTableColumnValue,
  resolveGridTemplateColumns,
  resolveInitialWidth,
  type FormulaTables,
} from '@iris-ui-kit/core'
import type {
  IrisTableColumn,
  IrisTableSortState,
  IrisTableColumnWidths,
  IrisTableVirtualOptions,
  IrisTableCellEditEvent,
  IrisTableFilterValues,
} from './types'

export interface IrisTableProps {
  columns: IrisTableColumn[]
  data: Array<Record<string, unknown>>
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  sort?: IrisTableSortState | null
  striped?: boolean
  bordered?: boolean
  autoDetectTypes?: boolean
  loading?: boolean
  error?: boolean
  virtualScroll?: IrisTableVirtualOptions
  columnVirtualization?: boolean
  resizableColumns?: boolean
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  renderDetail?: (row: Record<string, unknown>, rowIndex: number) => unknown
  rowExpandable?: (row: Record<string, unknown>, rowIndex: number) => boolean
  defaultExpandedRowKeys?: Array<string | number>
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  getSubRows?: (row: Record<string, unknown>) => Array<Record<string, unknown>> | undefined
  keyboardNavigation?: boolean
  cellRange?: boolean
  onUpdateSelection?: (value: Array<string | number>) => void
  onUpdateSort?: (value: IrisTableSortState | null) => void
  onRowClick?: (row: Record<string, unknown>, index: number) => void
  onCellEdit?: (event: IrisTableCellEditEvent) => void
  style?: string
  [key: string]: unknown
}

/**
 * Pure helper functions used by IrisTable.svelte.
 * These are framework-agnostic and do NOT use Svelte runes ($state/$derived).
 */
export const TABLE_CONST = {
  DEFAULT_COL_WIDTH: DEFAULT_COLUMN_WIDTH,
  DEFAULT_MIN_WIDTH: DEFAULT_COLUMN_MIN_WIDTH,
  RESIZE_STEP: COLUMN_RESIZE_STEP,
} as const

export { resolveInitialWidth }

export function resolveResponsiveWidth(
  column: IrisTableColumn,
  columnWidths: IrisTableColumnWidths | undefined,
  defaultColumnWidths: IrisTableColumnWidths | undefined,
): number {
  const configured = columnWidths?.[column.key] ?? defaultColumnWidths?.[column.key]
  if (isValidColumnWidth(configured)) return configured
  return resolveInitialWidth(column)
}

export function editPreviewText(
  row: Record<string, unknown>,
  column: IrisTableColumn,
  draft: string,
  formulaTables?: FormulaTables,
): string {
  const raw =
    column.editor === 'number'
      ? draft === '' || isNaN(Number(draft))
        ? getCellValue(row, column, formulaTables)
        : Number(draft)
      : draft
  return String(column.formatter?.(applyTableMask(raw, column), row) ?? '')
}

export function getCellValue(
  row: Record<string, unknown>,
  column: IrisTableColumn,
  formulaTables?: FormulaTables,
): unknown {
  return resolveTableColumnValue(row, column, formulaTables)
}

/** Compatibility name for the Core edit-capability predicate. */
export const isEditableColumn = isTableColumnEditable

/** CSV/range-copy shadow rows (batch EM): core `toCsv`/`serializeTableRange`
 * read `row[dataIndex]` directly, so formula columns materialize their
 * computed value onto a shallow copy (original rows untouched — immutable
 * row contract). No formula columns → the input array is returned as-is
 * (reference-preserving). */
export function withComputedFormulaCells(
  rows: readonly Record<string, unknown>[],
  columns: readonly IrisTableColumn[],
  formulaTables?: FormulaTables,
): Record<string, unknown>[] {
  return materializeTableFormulaValues(rows, columns, formulaTables)
}

/** Serialize checked filter sets for a remote query (vxe comma parity). */
export { mergeFilterValues }

/** Apply text filters and checked OR sets to a sorted row list. */
export function applyTableFilters(
  rows: Array<Record<string, unknown>>,
  columns: IrisTableColumn[],
  textFilters: Record<string, string>,
  filterValues: IrisTableFilterValues,
  formulaTables?: FormulaTables,
): Array<Record<string, unknown>> {
  return filterTableRows(rows, columns, {
    getValue: (row, column) => getCellValue(row, column, formulaTables),
    filters: textFilters,
    filterValues,
  })
}

export function clampWidth(col: IrisTableColumn, w: number): number {
  const minW = col.minWidth ?? TABLE_CONST.DEFAULT_MIN_WIDTH
  const maxW = col.maxWidth ?? Infinity
  return clampColumnWidth(w, minW, maxW)
}

export function summaryCellStyle(col: IrisTableColumn): string {
  const align =
    col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'
  return `display: flex; align-items: center; justify-content: ${align}; padding: 8px var(--iris-padding-md, 12px); font-size: var(--iris-font-size-md, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
}

export function buildGridTemplate(
  hasDetail: boolean,
  showSelection: boolean,
  leafColumns: IrisTableColumn[],
  effectiveWidths: IrisTableColumnWidths,
): string {
  return resolveGridTemplateColumns(leafColumns, effectiveWidths, {
    leadingTracks: [...(hasDetail ? [40] : []), ...(showSelection ? [40] : [])],
  })
}

export function computeVisibleColSet(
  columnVirtualization: boolean,
  leafColumns: IrisTableColumn[],
  scrollLeft: number,
  viewportWidth: number,
  effectiveWidths: IrisTableColumnWidths,
  pinOf: (column: IrisTableColumn) => 'left' | 'right' | null,
): Set<number> | null {
  return computeVisibleColumnIndices(columnVirtualization, {
    columns: leafColumns,
    scrollOffset: scrollLeft,
    viewportSize: viewportWidth,
    itemSize: (column) => resolveColumnWidth(column, effectiveWidths),
    isAlwaysVisible: (column) => pinOf(column) !== null,
  })
}

export function cellId(rowIdent: string | number, colKey: string): string {
  return `${rowIdent}::${colKey}`
}
