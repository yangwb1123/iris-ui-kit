/**
 * Pure row-list operations for the vxe-grid insert/remove/setRow parity row
 * ops (batch E). Framework-free: adapters bridge these into their imperative
 * handles / write-back paths, so all four frameworks share one behavior.
 *
 * Semantics follow vxe-grid row ops simplified to key addressing (iris
 * `rowKey`): every function is immutable (inputs never mutated), keys rows by
 * `rowKeyField`, and returns the ORIGINAL array reference when nothing
 * changed so callers can skip downstream work cheaply.
 */

/**
 * Resolve a table row key from a configured field, falling back to the row's
 * current index when the field is not a string or number. Values such as NaN
 * and the empty string are preserved because their runtime types are number
 * and string respectively. The row is read only and never mutated.
 */
export function resolveTableRowKey(
  row: Record<string, unknown>,
  rowKeyField: string,
  index: number,
): string | number {
  const value = row[rowKeyField]
  return typeof value === 'string' || typeof value === 'number' ? value : index
}

/** Auto id for a key-less row: max numeric key + 1, avoiding overflow collisions. */
function nextAutoId<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
): number {
  let max = 0
  const used = new Set<number>()
  for (const row of rows) {
    const value = (row as Record<string, unknown>)[rowKeyField]
    if (typeof value !== 'number') continue
    used.add(value)
    if (Number.isFinite(value) && value > max) max = value
  }

  const next = max + 1
  if (Number.isFinite(next) && !used.has(next)) return next

  // Number.MAX_VALUE + 1 is Infinity. If that would collide, choose the
  // first available positive integer instead of returning a duplicate key.
  let fallback = 1
  while (used.has(fallback)) fallback += 1
  return fallback
}

function sameRowKey(left: string | number, right: string | number): boolean {
  // SameValueZero keeps the usual 0/-0 key equivalence while making NaN
  // addressable instead of silently turning it into an unfindable row.
  return left === right || (Number.isNaN(left) && Number.isNaN(right))
}

function insertionIndex(index: number | undefined, length: number): number | undefined {
  if (index === undefined) return length
  if (typeof index !== 'number' || Number.isNaN(index)) return undefined
  if (index === Number.POSITIVE_INFINITY) return length
  if (index === Number.NEGATIVE_INFINITY) return 0
  return Math.max(0, Math.min(Math.trunc(index), length))
}

/**
 * Insert a row into a list (vxe-grid insert/insertAt parity). `index` defaults
 * to the END and is clamped into `[0, rows.length]`. A row without a
 * `rowKeyField` value (undefined/null) gets an auto id (max numeric key + 1)
 * written to a shallow COPY — the input row is never mutated.
 */
export function insertRowInList<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
  row: Row,
  index?: number,
): Row[] {
  const existing = (row as Record<string, unknown>)[rowKeyField]
  const entry: Row =
    existing === undefined || existing === null
      ? ({ ...row, [rowKeyField]: nextAutoId(rows, rowKeyField) } as Row)
      : row
  const at = insertionIndex(index, rows.length)
  if (at === undefined) return rows as Row[]
  const next = rows.slice()
  next.splice(at, 0, entry)
  return next
}

/**
 * Clone the row with `key` and insert the copy (iris 独有 — vxe-grid has no
 * clone-row API). All field values are shallow-copied onto a NEW row object;
 * the clone always gets a FRESH auto id (max numeric key + 1, 1 when none) so
 * key addressing / selection / dirty-point tracking stay sound (string keys
 * never participate in the numeric max). Default insert position is right
 * AFTER the source row; an explicit `index` is clamped into `[0, rows.length]`
 * like insertRowInList. Returns the ORIGINAL array reference when no row
 * matches; never mutates inputs.
 */
export function cloneRowInList<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
  key: string | number,
  index?: number,
): Row[] {
  const sourceIndex = rows.findIndex((row) =>
    sameRowKey((row as Record<string, unknown>)[rowKeyField] as string | number, key),
  )
  if (sourceIndex < 0) return rows as Row[]
  const source = rows[sourceIndex]!
  const clone = { ...source, [rowKeyField]: nextAutoId(rows, rowKeyField) } as Row
  const at = index === undefined ? sourceIndex + 1 : insertionIndex(index, rows.length)
  if (at === undefined) return rows as Row[]
  const next = rows.slice()
  next.splice(at, 0, clone)
  return next
}

/**
 * Remove the row with `key` from a list (vxe-grid remove parity). Returns the
 * ORIGINAL array reference when no row matches; never mutates the input.
 */
export function removeRowFromList<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
  key: string | number,
): Row[] {
  const index = rows.findIndex((row) =>
    sameRowKey((row as Record<string, unknown>)[rowKeyField] as string | number, key),
  )
  if (index < 0) return rows as Row[]
  return rows.filter((_, i) => i !== index)
}

/** Remove every matching key in one immutable pass; missing keys are no-ops. */
export function removeRowsFromList<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
  keys: readonly (string | number)[],
): { rows: Row[]; removedKeys: Set<string | number> } {
  let next = rows as Row[]
  const removedKeys = new Set<string | number>()
  for (const key of keys) {
    const candidate = removeRowFromList(next, rowKeyField, key)
    if (candidate !== next) {
      removedKeys.add(key)
      next = candidate
    }
  }
  return { rows: next, removedKeys }
}

/**
 * Resolve the active and over rows from a visible drag projection. The
 * returned row references are preserved so adapters can decide whether a
 * visible row is also the canonical source row (important for sorted,
 * filtered, and flattened tree views). Keys are resolved against the original
 * visible indexes, which keeps index-derived row ids stable during the drop.
 */
export interface RowDragProjection<Row> {
  readonly fromIndex: number
  readonly toIndex: number
  readonly fromRow: Row | undefined
  readonly toRow: Row | undefined
  readonly fromKey: string | number | undefined
  readonly toKey: string | number | undefined
}

export function resolveRowDragProjection<Row>(
  visibleRows: readonly Row[],
  activeId: string,
  overId: string,
  getRowKey: (row: Row, index: number) => string | number | undefined,
): RowDragProjection<Row> {
  const findIndex = (id: string): number =>
    visibleRows.findIndex((row, index) => String(getRowKey(row, index)) === id)
  const fromIndex = findIndex(activeId)
  const toIndex = findIndex(overId)
  const fromRow = fromIndex < 0 ? undefined : visibleRows[fromIndex]
  const toRow = toIndex < 0 ? undefined : visibleRows[toIndex]
  return {
    fromIndex,
    toIndex,
    fromRow,
    toRow,
    fromKey: fromRow === undefined ? undefined : getRowKey(fromRow, fromIndex),
    toKey: toRow === undefined ? undefined : getRowKey(toRow, toIndex),
  }
}

/**
 * Reorder two keyed rows in one sibling list (vxe row-drag parity).
 *
 * `position: 'auto'` preserves the historical remove-then-insert behavior:
 * the source row is inserted at the target's original index. `before` and
 * `after` describe the target position after the source has been removed.
 * The key resolver receives the original sibling index, so computed keys keep
 * the same addressing contract as the rows feature. Inputs are never mutated;
 * an unknown key, same key, or identity-only result returns the ORIGINAL list
 * reference so callers can avoid a synthetic transaction.
 */
export function reorderRowsInList<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  getRowKey: (row: Row, index: number) => string | number | undefined,
  fromKey: string | number,
  toKey: string | number,
  position: 'auto' | 'before' | 'after' = 'auto',
): Row[] {
  const fromIndex = rows.findIndex((row, rowIndex) =>
    sameRowKey(getRowKey(row, rowIndex) as string | number, fromKey),
  )
  const toIndex = rows.findIndex((row, rowIndex) =>
    sameRowKey(getRowKey(row, rowIndex) as string | number, toKey),
  )
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return rows as Row[]

  const next = [...rows]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return rows as Row[]
  const targetIndex = toIndex - (fromIndex < toIndex ? 1 : 0)
  const insertionIndex =
    position === 'after' ? targetIndex + 1 : position === 'before' ? targetIndex : toIndex
  next.splice(insertionIndex, 0, moved)
  if (next.every((row, index) => Object.is(row, rows[index]))) return rows as Row[]
  return next
}

/**
 * Reorder a keyed row to an insertion index expressed in the ORIGINAL list.
 * This is the projection used by insertion-line drag UIs: the target index is
 * computed before removing the source row, then `splice(from, 1)` and
 * `splice(insertIndex, 0, moved)` preserve the legacy placement contract.
 * Inputs are never mutated and identity-only moves return the original list.
 */
export function reorderRowsInListAt<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  getRowKey: (row: Row, index: number) => string | number | undefined,
  fromKey: string | number,
  insertIndex: number,
): Row[] {
  const fromIndex = rows.findIndex((row, rowIndex) =>
    sameRowKey(getRowKey(row, rowIndex) as string | number, fromKey),
  )
  if (fromIndex < 0 || !Number.isFinite(insertIndex) || fromIndex === insertIndex) {
    return rows as Row[]
  }

  const next = [...rows]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return rows as Row[]
  next.splice(Math.trunc(insertIndex), 0, moved)
  if (next.every((row, index) => Object.is(row, rows[index]))) return rows as Row[]
  return next
}

/**
 * Replace the row with `key` by a shallow merge of `patch` (vxe-grid setRow
 * parity): `{ ...row, ...patch }`. Other rows keep object identity; returns
 * the ORIGINAL array reference when no row matches; never mutates inputs.
 */
export function updateRowInList<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
  key: string | number,
  patch: Partial<Row>,
): Row[] {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return rows as Row[]
  const index = rows.findIndex((row) =>
    sameRowKey((row as Record<string, unknown>)[rowKeyField] as string | number, key),
  )
  if (index < 0) return rows as Row[]
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
}
