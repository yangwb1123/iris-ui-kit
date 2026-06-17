/**
 * Aggregation and grouping utilities for data grids.
 *
 * Pure C-layer material: sum/avg/min/max/count aggregation per column,
 * summary rows, and row grouping by key function.
 */

import type { DataViewColumn, AggregateOp, AggregateSpec } from './types'

/**
 * Aggregate the values read by `getValue` across `rows`.
 * Empty input → 0 for sum/avg/count, NaN for min/max.
 */
export function aggregate<Row>(
  rows: readonly Row[],
  getValue: (row: Row) => unknown,
  op: AggregateOp,
): number {
  if (op === 'count') return rows.reduce((n, r) => (getValue(r) != null ? n + 1 : n), 0)
  const nums: number[] = []
  for (const r of rows) {
    const raw = getValue(r)
    if (raw == null) continue
    const v = Number(raw)
    if (Number.isFinite(v)) nums.push(v)
  }
  if (nums.length === 0) return op === 'min' || op === 'max' ? NaN : 0
  switch (op) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
  }
}

/**
 * Compute a summary record for a set of column specs.
 * The material behind a table's summary/footer row.
 */
export function summarize<Row>(
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  specs: readonly AggregateSpec[],
): Record<string, number> {
  const colMap = new Map(columns.map((c) => [c.key, c]))
  const out: Record<string, number> = {}
  for (const spec of specs) {
    const col = colMap.get(spec.key)
    if (col) out[spec.key] = aggregate(rows, col.getValue, spec.op)
  }
  return out
}

/**
 * Group rows by a key function (first-seen key order preserved).
 */
export function groupRows<Row, K>(
  rows: readonly Row[],
  keyOf: (row: Row) => K,
): Array<{ key: K; rows: Row[] }> {
  const groups = new Map<K, Row[]>()
  for (const row of rows) {
    const k = keyOf(row)
    const bucket = groups.get(k)
    if (bucket) bucket.push(row)
    else groups.set(k, [row])
  }
  return Array.from(groups, ([key, rs]) => ({ key, rows: rs }))
}
