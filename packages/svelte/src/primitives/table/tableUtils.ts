import { compareValues, computeVirtualRange, createCellRange } from '@iris-ui-kit/core'
import type {
  IrisTableColumn,
  IrisTableSortState,
  IrisTableColumnWidths,
  IrisTableVirtualOptions,
  IrisTableCellEditEvent,
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
  DEFAULT_COL_WIDTH: 140,
  DEFAULT_MIN_WIDTH: 60,
  RESIZE_STEP: 16,
} as const

export function resolveInitialWidth(col: IrisTableColumn): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return TABLE_CONST.DEFAULT_COL_WIDTH
}

export function getCellValue(row: Record<string, unknown>, column: IrisTableColumn): unknown {
  const key = (column.dataIndex ?? column.key) as string
  return row[key]
}

export function clampWidth(col: IrisTableColumn, w: number): number {
  const minW = col.minWidth ?? TABLE_CONST.DEFAULT_MIN_WIDTH
  const maxW = col.maxWidth ?? Infinity
  return Math.max(minW, Math.min(maxW, Math.round(w)))
}

export function summaryCellStyle(col: IrisTableColumn): string {
  const align =
    col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'
  return `display: flex; align-items: center; justify-content: ${align}; padding: 8px var(--iris-padding-md, 12px); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
}

export function buildGridTemplate(
  hasDetail: boolean,
  showSelection: boolean,
  leafColumns: IrisTableColumn[],
  effectiveWidths: IrisTableColumnWidths,
): string {
  const parts: string[] = []
  if (hasDetail) parts.push('40px')
  if (showSelection) parts.push('40px')
  for (const col of leafColumns) {
    parts.push(`${effectiveWidths[col.key] ?? resolveInitialWidth(col)}px`)
  }
  return parts.join(' ')
}

export function isSelectedInRange(
  cellRangeState: ReturnType<ReturnType<typeof createCellRange>['getState']>,
  row: number,
  col: number,
): boolean {
  const { anchor, active } = cellRangeState
  if (!anchor || !active) return false
  return (
    row >= Math.min(anchor.row, active.row) &&
    row <= Math.max(anchor.row, active.row) &&
    col >= Math.min(anchor.col, active.col) &&
    col <= Math.max(anchor.col, active.col)
  )
}

export function createSortComparator(
  effectiveSort: IrisTableSortState | null,
  leafColumns: IrisTableColumn[],
  getValue: (row: Record<string, unknown>, col: IrisTableColumn) => unknown,
): ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null {
  if (!effectiveSort) return null
  const column = leafColumns.find((c) => c.key === effectiveSort.key)
  if (!column) return null
  const dir = effectiveSort.direction === 'asc' ? 1 : -1
  const sorter =
    column.sorter ?? ((a, b) => compareValues(getValue(a, column), getValue(b, column)))
  return (a, b) => sorter(a, b) * dir
}

export function computeVisibleColSet(
  columnVirtualization: boolean,
  leafColumns: IrisTableColumn[],
  scrollLeft: number,
  viewportWidth: number,
  effectiveWidths: IrisTableColumnWidths,
): Set<number> | null {
  if (!columnVirtualization) return null
  const w = computeVirtualRange({
    itemCount: leafColumns.length,
    scrollTop: scrollLeft,
    viewportSize: viewportWidth,
    itemSize: (i) => effectiveWidths[leafColumns[i].key] ?? resolveInitialWidth(leafColumns[i]),
    buffer: 2,
  })
  const set = new Set<number>()
  for (let i = w.startIndex; i <= w.endIndex; i++) set.add(i)
  leafColumns.forEach((col, i) => {
    if (col.pinned) set.add(i)
  })
  return set
}

export function cellId(rowIdent: string | number, colKey: string): string {
  return `${rowIdent}::${colKey}`
}
