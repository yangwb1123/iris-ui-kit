/**
 * Aggregation and grouping utilities for data grids.
 *
 * Pure C-layer material: sum/avg/min/max/count aggregation per column,
 * summary rows, and row grouping by key function.
 */

import type { DataViewColumn, AggregateOp, AggregateSpec } from './types'

function isAggregateOp(value: unknown): value is AggregateOp {
  return (
    value === 'sum' || value === 'avg' || value === 'min' || value === 'max' || value === 'count'
  )
}

function emptyAggregate(op: unknown): number {
  return op === 'min' || op === 'max' ? NaN : 0
}

function readFiniteNumbers<Row>(rows: readonly Row[], getValue: (row: Row) => unknown): number[] {
  const nums: number[] = []
  for (const row of rows) {
    const raw = getValue(row)
    if (raw == null) continue
    let value: number
    try {
      value = Number(raw)
    } catch {
      continue
    }
    if (Number.isFinite(value)) nums.push(value)
  }
  return nums
}

function average(nums: readonly number[]): number {
  const sum = nums.reduce((a, b) => a + b, 0)
  if (Number.isFinite(sum)) return sum / nums.length
  // Avoid a transient sum overflow when the mean itself is representable.
  let mean = 0
  for (let i = 0; i < nums.length; i += 1) {
    mean = mean * (i / (i + 1)) + nums[i]! / (i + 1)
  }
  return mean
}

function extreme(nums: readonly number[], op: 'min' | 'max'): number {
  let result = nums[0]!
  for (let i = 1; i < nums.length; i += 1) {
    result = op === 'min' ? Math.min(result, nums[i]!) : Math.max(result, nums[i]!)
  }
  return result
}

/**
 * Aggregate the values read by `getValue` across `rows`.
 * Empty input → 0 for sum/avg/count, NaN for min/max.
 */
export function aggregate<Row>(
  rows: readonly Row[],
  getValue: (row: Row) => unknown,
  op: AggregateOp,
): number {
  if (!isAggregateOp(op)) return 0
  if (!Array.isArray(rows) || typeof getValue !== 'function') return emptyAggregate(op)
  if (op === 'count') return rows.reduce((n, r) => (getValue(r) != null ? n + 1 : n), 0)
  const nums = readFiniteNumbers(rows, getValue)
  if (nums.length === 0) return emptyAggregate(op)
  switch (op) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return average(nums)
    case 'min':
    case 'max':
      return extreme(nums, op)
  }
}

/**
 * Compute a summary record for a set of column specs.
 * The material behind a table's summary/footer row.
 */
function isDataViewColumn<Row>(value: unknown): value is DataViewColumn<Row> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string' &&
    typeof (value as { getValue?: unknown }).getValue === 'function'
  )
}

function isAggregateSpec(value: unknown): value is AggregateSpec {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string' &&
    isAggregateOp((value as { op?: unknown }).op)
  )
}

export function summarize<Row>(
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  specs: readonly AggregateSpec[],
): Record<string, number> {
  const colMap = new Map<string, DataViewColumn<Row>>()
  if (Array.isArray(columns)) {
    for (const column of columns) {
      if (isDataViewColumn(column)) colMap.set(column.key, column)
    }
  }
  const out: Record<string, number> = {}
  if (!Array.isArray(specs)) return out
  for (const spec of specs) {
    if (!isAggregateSpec(spec)) continue
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
