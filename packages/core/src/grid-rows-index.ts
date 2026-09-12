/**
 * A lazy, flat-row key index used by the rows controller.
 *
 * This is intentionally narrower than a tree row model: computed/index-based
 * keys and nested rows depend on traversal position, so those paths continue
 * to use the guarded walkers. The default `rowKeyField` path has stable keys,
 * which makes TanStack-style `rowsById` lookups safe and reusable between
 * mutations until the immutable root array changes.
 */

export interface FlatRowIndexEntry<Row> {
  readonly index: number
  readonly row: Row
}

export interface FlatRowIndex<Row> {
  readonly rows: readonly Row[]
  /** False when a fallback scan is required to preserve duplicate/missing-key semantics. */
  readonly usable: boolean
  get(key: string | number): FlatRowIndexEntry<Row> | undefined
}

export interface FlatRowRemovalResolution {
  readonly removedIndexes: ReadonlySet<number>
  readonly removedKeys: readonly (string | number)[]
}

function sameRowKey(left: string | number | undefined, right: string | number): boolean {
  return (
    left === right ||
    (typeof left === 'number' &&
      Number.isNaN(left) &&
      typeof right === 'number' &&
      Number.isNaN(right))
  )
}

export function resolveFlatRowRemovals<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  keys: readonly (string | number)[],
  keyOf: (row: Row, index: number) => string | number | undefined,
  index?: FlatRowIndex<Row>,
): FlatRowRemovalResolution {
  const removedIndexes = new Set<number>()
  const removedKeys: (string | number)[] = []
  if (index?.usable) {
    for (const key of keys) {
      const entry = index.get(key)
      if (!entry || removedIndexes.has(entry.index)) continue
      removedIndexes.add(entry.index)
      removedKeys.push(key)
    }
    return { removedIndexes, removedKeys }
  }
  // Resolve every key against one source snapshot. This preserves the
  // index-derived-key contract and removes duplicate keys one row at a time.
  for (const key of keys) {
    const rowIndex = rows.findIndex(
      (row, index) => !removedIndexes.has(index) && sameRowKey(keyOf(row, index), key),
    )
    if (rowIndex < 0) continue
    removedIndexes.add(rowIndex)
    removedKeys.push(key)
  }
  return { removedIndexes, removedKeys }
}

export function createFlatRowIndex<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
): FlatRowIndex<Row> {
  const entries = new Map<string | number, FlatRowIndexEntry<Row>>()
  let usable = true

  for (const [index, row] of rows.entries()) {
    const value = row[rowKeyField]
    if (typeof value !== 'string' && typeof value !== 'number') {
      usable = false
      continue
    }
    // Map uses SameValueZero, matching the rows feature's string/number key
    // comparison (`NaN` matches itself and `0` matches `-0`).
    if (entries.has(value)) {
      usable = false
      continue
    }
    entries.set(value, { index, row })
  }

  return {
    rows,
    usable,
    get: (key) => (usable ? entries.get(key) : undefined),
  }
}
