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

/** Auto id for a key-less row: max numeric key in the list + 1 (1 when none). */
function nextAutoId<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  rowKeyField: string,
): number {
  let max = 0
  for (const row of rows) {
    const value = (row as Record<string, unknown>)[rowKeyField]
    if (typeof value === 'number' && Number.isFinite(value) && value > max) max = value
  }
  return max + 1
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
  const at = index === undefined ? rows.length : Math.max(0, Math.min(index, rows.length))
  const next = rows.slice()
  next.splice(at, 0, entry)
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
  const index = rows.findIndex((row) => (row as Record<string, unknown>)[rowKeyField] === key)
  if (index < 0) return rows as Row[]
  return rows.filter((_, i) => i !== index)
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
  const index = rows.findIndex((row) => (row as Record<string, unknown>)[rowKeyField] === key)
  if (index < 0) return rows as Row[]
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
}
