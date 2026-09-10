import type { GridClipboardChange, GridClipboardPasteChange } from './grid-clipboard'
import type { TableClipboardColumn, TableClipboardRange } from './table-clipboard'

function integer(value: number): number | null {
  return Number.isFinite(value) ? Math.trunc(value) : null
}

export function clampRange(
  range: TableClipboardRange | null,
  rowCount: number,
  columnCount: number,
  allowEmptyRows = false,
): TableClipboardRange | null {
  if (
    !range ||
    typeof range !== 'object' ||
    !range.start ||
    !range.end ||
    columnCount <= 0 ||
    (rowCount <= 0 && !allowEmptyRows)
  )
    return null
  const raw = [
    integer(range.start.row),
    integer(range.start.col),
    integer(range.end.row),
    integer(range.end.col),
  ]
  if (raw.some((value) => value === null)) return null
  const [startRow, startColumn, endRow, endColumn] = raw as [number, number, number, number]
  // Overflow insertion is defined only for a single-cell anchor. Do not let a
  // multi-cell range through when there is no row for pasteRow to address.
  if (rowCount <= 0 && allowEmptyRows && (startRow !== endRow || startColumn !== endColumn))
    return null
  // A factory-backed single-cell paste may legitimately start with no source
  // rows. Keep the range at row zero so every clipboard line is treated as an
  // overflow line; serialization and the default (factory-less) path still
  // reject an empty body above.
  const lastRow = Math.max(0, rowCount - 1)
  return {
    start: {
      row: Math.max(0, Math.min(startRow, endRow, lastRow)),
      col: Math.max(0, Math.min(startColumn, endColumn, columnCount - 1)),
    },
    end: {
      row: Math.max(0, Math.min(Math.max(startRow, endRow), lastRow)),
      col: Math.max(0, Math.min(Math.max(startColumn, endColumn), columnCount - 1)),
    },
  }
}

export function copiedSize(range: TableClipboardRange): { rowCount: number; columnCount: number } {
  return {
    rowCount: range.end.row - range.start.row + 1,
    columnCount: range.end.col - range.start.col + 1,
  }
}

export function sameRows<Row extends Record<string, unknown>>(
  left: readonly Row[],
  right: readonly Row[],
): boolean {
  if (left.length !== right.length) return false
  return left.every((row, index) => Object.is(row, right[index]))
}

function copyRange(range: TableClipboardRange): TableClipboardRange {
  return { start: { ...range.start }, end: { ...range.end } }
}

export function copyClipboardPasteChange<Row extends Record<string, unknown>>(
  change: GridClipboardPasteChange<Row>,
): GridClipboardPasteChange<Row> {
  return {
    ...change,
    range: copyRange(change.range),
    // Row objects are shallow-copied as well as their lists. The callback and
    // event payloads are observational snapshots and must not alias rows that
    // were handed to a custom setRows binding.
    previousRows: change.previousRows.map((row) => ({ ...row })),
    rows: change.rows.map((row) => ({ ...row })),
  }
}

export function copyClipboardChange<Row extends Record<string, unknown>>(
  change: GridClipboardChange<Row>,
): GridClipboardChange<Row> {
  if (change.type === 'copy') return { ...change, range: copyRange(change.range) }
  return copyClipboardPasteChange(change)
}

export function isRow<Row extends Record<string, unknown>>(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function defaultSetValue<Row extends Record<string, unknown>>(
  row: Row,
  column: TableClipboardColumn<Row>,
  value: unknown,
): Row {
  const key = column.dataIndex ?? column.key
  return { ...row, [key]: value }
}

export function countOverflowCells<Row extends Record<string, unknown>>(
  row: Row,
  range: TableClipboardRange,
  columns: readonly TableClipboardColumn<Row>[],
): number {
  let count = 0
  for (let columnIndex = range.start.col; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex]!
    const key = column.dataIndex ?? column.key
    if (Object.prototype.hasOwnProperty.call(row, key)) count += 1
  }
  return count
}
