/**
 * Framework-agnostic summary/footer value projection.
 *
 * Adapters own summary row markup, placement, and custom render callbacks. Core
 * owns only the shared math: operation selection, aggregate null/zero/string
 * semantics, and the optional aggregateAccuracy rounding point.
 */

import { aggregate } from './data-view/aggregate'
import type { AggregateOp } from './data-view/types'

/** Minimal column shape needed by the summary projection. */
export interface TableSummaryColumn {
  readonly key: string
  readonly summary?: AggregateOp
}

/** One framework-neutral summary cell result. */
export interface TableSummaryCellProjection {
  readonly key: string
  readonly operation?: AggregateOp
  readonly value: number | null
}

/** The pure projection consumed by framework-specific summary renderers. */
export interface TableSummaryProjection {
  /** The legacy row gate: non-empty rows and at least one summary operation. */
  readonly shouldRender: boolean
  readonly cells: TableSummaryCellProjection[]
}

function validAccuracy(accuracy: number | undefined): number | undefined {
  return accuracy !== undefined && Number.isInteger(accuracy) && accuracy >= 0 && accuracy <= 100
    ? accuracy
    : undefined
}

function isAggregateOp(value: unknown): value is AggregateOp {
  return (
    value === 'sum' || value === 'avg' || value === 'min' || value === 'max' || value === 'count'
  )
}

function isTableSummaryColumn(value: unknown): value is TableSummaryColumn {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string'
  )
}

/**
 * Project one summary cell without invoking any adapter render callback.
 * `getValue` remains an adapter bridge so formula, dataIndex, and remote-row
 * semantics stay owned by the caller.
 */
export function projectTableSummaryCell<Row, Column extends TableSummaryColumn>(
  rows: readonly Row[],
  column: Column,
  getValue: (row: Row, column: Column) => unknown,
  aggregateAccuracy?: number,
): TableSummaryCellProjection {
  if (!isTableSummaryColumn(column)) return { key: '', value: null }
  const operation = isAggregateOp(column.summary) ? column.summary : undefined
  if (!operation || typeof getValue !== 'function') {
    return operation
      ? { key: column.key, operation, value: null }
      : { key: column.key, value: null }
  }

  const rawValue = aggregate(rows, (row) => getValue(row, column), operation)
  const accuracy = validAccuracy(aggregateAccuracy)
  const value =
    accuracy !== undefined && Number.isFinite(rawValue)
      ? Number(rawValue.toFixed(accuracy))
      : rawValue

  return { key: column.key, operation, value }
}

/**
 * Project all leaf columns in their authored order. The projection computes
 * values for empty rows too (matching `aggregate`); adapters use
 * `shouldRender` to preserve the historical empty/no-summary DOM gate.
 */
export function projectTableSummary<Row, Column extends TableSummaryColumn>(
  rows: readonly Row[],
  columns: readonly Column[],
  getValue: (row: Row, column: Column) => unknown,
  aggregateAccuracy?: number,
): TableSummaryProjection {
  const cells = Array.isArray(columns)
    ? columns.map((column) => projectTableSummaryCell(rows, column, getValue, aggregateAccuracy))
    : []
  return {
    shouldRender:
      rows.length > 0 &&
      typeof getValue === 'function' &&
      cells.some((cell) => Boolean(cell.operation)),
    cells,
  }
}
