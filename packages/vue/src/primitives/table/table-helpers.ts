import { computeVirtualRange, memoizedFormulaValue } from '@iris-ui-kit/core'
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

/** Batch EK: a formula column is DISPLAY-ONLY even when `editable` — every
 * editing entry point (inline, row mode, click trigger, data-editable attr,
 * cursor) reads this same condition. */
export function isEditableColumn<Row extends Record<string, unknown>>(
  column: IrisTableColumn<Row>,
): boolean {
  return !!column.editable && !column.formula
}

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  // Batch EK: a formula column reads the COMPUTED value (2-arg
  // memoizedFormulaValue — no tables slot, react AO byte semantics). This
  // choke point feeds sorting, filtering, summary, the cell slot/render,
  // edit drafts and pattern hints, so the computed value flows everywhere.
  if (column.formula) return memoizedFormulaValue(column.formula, row)
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/** CSV/range-copy shadow rows (batch EK): core `toCsv`/`serializeTableRange`
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
