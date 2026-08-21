/**
 * Framework-agnostic cell-range statistics (batch AJ, iris 独有 — vxe has no
 * equivalent; its closest analog is the Excel-style status bar that shows
 * count/sum/avg/min/max while a cell range is selected).
 *
 * Given the rectangle a range spans (rows × columns, inclusive on both axes),
 * compute per-column `count`/`sum`/`avg`/`min`/`max` over the RAW cell values.
 * Value semantics reuse `aggregate` exactly: `count` counts non-null cells;
 * the numeric ops coerce to `Number` and keep only finite values (non-numeric
 * cells are ignored, not coerced). ONE deliberate divergence: an empty numeric
 * subset yields `null` (the `number | null` shape's marker) instead of
 * `aggregate`'s `0`/`NaN` — a range stat's null reads as "no data", never as
 * an arithmetic zero. An empty (out-of-bounds) range → `{}`.
 *
 * The adapter maps its value indirection into `key` BEFORE calling this (the
 * react bridge uses `dataIndex ?? key`, the same indirection `getCellValue`
 * uses), so the core stays pure over `{ key, getValue }` columns — exactly the
 * `DataViewColumn` contract `summarize`/`aggregate` already consume.
 */

import type { CellAddress } from './cell-range'
import type { DataViewColumn } from './data-view'

/** One column's aggregate stats over a selected range. Numeric ops are
 * `null` (never `0`/`NaN`) when the range contains no numeric cells for this
 * column — a "no data" marker, mirroring `aggregate`'s semantics otherwise. */
export interface RangeColumnStats {
  /** Non-null cells in the range for this column. */
  count: number
  /** Sum of the numeric cells; `null` when none are numeric. */
  sum: number | null
  /** Mean of the numeric cells; `null` when none are numeric. */
  avg: number | null
  /** Minimum numeric value; `null` when none are numeric. */
  min: number | null
  /** Maximum numeric value; `null` when none are numeric. */
  max: number | null
}

/** The rectangle a cell range spans, normalized top-left → bottom-right. */
export interface RangeStatsRange {
  /** Zero-based top-left cell (inclusive). */
  start: CellAddress
  /** Zero-based bottom-right cell (inclusive). */
  end: CellAddress
}

/**
 * Compute per-column range statistics over the rows × columns rectangle of
 * `range`. `columns` is the FULL leaf column list — its index IS the grid
 * column index (the same mapping the adapter's cell rendering uses), so the
 * column span is sliced from `range` here; row indexes slice `rows` the same
 * way. Out-of-bounds rows/columns are clamped (a range larger than the data
 * still computes over what exists); a range outside the data entirely → `{}`.
 */
export function rangeStats<Row>(
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  range: RangeStatsRange,
): Record<string, RangeColumnStats> {
  const out: Record<string, RangeColumnStats> = {}
  const rowStart = Math.max(0, range.start.row)
  const rowEnd = Math.min(rows.length - 1, range.end.row)
  const colStart = Math.max(0, range.start.col)
  const colEnd = Math.min(columns.length - 1, range.end.col)
  if (rowStart > rowEnd || colStart > colEnd) return out

  for (let c = colStart; c <= colEnd; c += 1) {
    const column = columns[c]
    if (!column) continue
    let count = 0
    let numericCount = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity
    for (let r = rowStart; r <= rowEnd; r += 1) {
      const row = rows[r]
      if (row === undefined) continue
      const raw = column.getValue(row)
      if (raw == null) continue // null/undefined are not data points
      count += 1
      const v = Number(raw)
      if (Number.isFinite(v)) {
        numericCount += 1
        sum += v
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    const hasNumeric = numericCount > 0
    out[column.key] = {
      count,
      sum: hasNumeric ? sum : null,
      avg: hasNumeric ? sum / numericCount : null,
      min: hasNumeric ? min : null,
      max: hasNumeric ? max : null,
    }
  }
  return out
}
