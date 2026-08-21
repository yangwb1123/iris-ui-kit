import { computeVirtualRange } from '@iris-ui-kit/core'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSpan,
  IrisTableSpanMethodParams,
} from './types'

export const SELECTION_COL_WIDTH = 40
export const EXPAND_COL_WIDTH = 40
export const SEQ_COL_WIDTH = 40
export const DRAG_COL_WIDTH = 40
export const DEFAULT_COL_WIDTH = 140
export const DEFAULT_MIN_WIDTH = 60
export const RESIZE_STEP = 16

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/** Resolve one span and update the pass-local occupied-cell set. */
export function resolveSpan(
  occupied: Set<string>,
  rowIndex: number,
  columnIndex: number,
  method: ((params: IrisTableSpanMethodParams) => IrisTableSpan | null) | undefined,
): { rowspan: number; colspan: number } | null {
  if (!method) return { rowspan: 1, colspan: 1 }
  const key = `${rowIndex}:${columnIndex}`
  if (occupied.has(key)) return null
  const span = method({ rowIndex, columnIndex })
  const rowspan = span?.rowspan ?? 1
  const colspan = span?.colspan ?? 1
  if (rowspan > 1) {
    for (let row = 1; row < rowspan; row += 1) occupied.add(`${rowIndex + row}:${columnIndex}`)
  }
  if (colspan > 1) {
    for (let column = 1; column < colspan; column += 1) {
      occupied.add(`${rowIndex}:${columnIndex + column}`)
    }
  }
  return { rowspan, colspan }
}

export function resolveInitialWidth(col: IrisTableColumn): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const match = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (match) return Number(match[1])
  }
  return DEFAULT_COL_WIDTH
}

export function computeVisibleColSet(
  enabled: boolean,
  columns: IrisTableColumn[],
  scrollLeft: number,
  viewportWidth: number,
  widths: IrisTableColumnWidths,
): Set<number> | null {
  if (!enabled) return null
  const range = computeVirtualRange({
    itemCount: columns.length,
    scrollTop: scrollLeft,
    viewportSize: viewportWidth,
    itemSize: (index) => widths[columns[index].key] ?? resolveInitialWidth(columns[index]),
    buffer: 2,
  })
  const visible = new Set<number>()
  for (let index = range.startIndex; index <= range.endIndex; index += 1) visible.add(index)
  columns.forEach((column, index) => {
    if (column.pinned) visible.add(index)
  })
  return visible
}

export function cellId(rowIdent: string | number, columnKey: string): string {
  return `${rowIdent}::${columnKey}`
}
