/**
 * `diffRows` — a pure, framework-agnostic row-list differ for the iris table
 * compare view (batch AU, iris 独有 — vxe has no compare capability).
 *
 * Compares two row lists by a `rowKeyField` and classifies every key present
 * in EITHER list:
 *   - `added`   — keys present in `after` but not `before`
 *   - `removed` — keys present in `before` but not `after`
 *   - `changed` — keys present in both with ≥1 column differing (`Object.is`)
 *
 * Cell-level comparison deliberately uses `Object.is` (NaN ≠ NaN, +0 ≠ -0,
 * value identity) rather than batch-AT's audit `!==` (truthiness) — a compare
 * view is about VALUE identity, not coercion. Changed columns are reported in
 * the `after` row's own key order (then any `before`-only keys), so the order
 * matches the data being compared against. Rows whose key field is
 * null/undefined are skipped (no key → no diff identity); the table's own
 * `rowKey` guard treats the feature the same way.
 *
 * Pure function of its inputs — no side effects, no timers, no framework
 * imports — so any adapter (react/vue/solid/svelte) can bridge it. The maps
 * give O(1) row-status / per-cell lookups at render time.
 */

/** Per-row comparison outcome. */
export type RowDiffKind = 'added' | 'removed' | 'changed'

/** One changed column of a `changed` row (old value → new value). */
export interface RowDiffCellChange {
  /** Object key of the changed column. In the react table this matches the
   * `dataIndex ?? key` lookup for non-formula columns; formula columns are
   * computed display values (documented simplification — their own cell
   * diffs are not reported; the referenced field cells are). */
  key: string
  /** Value in `before` — the `old` side of the tooltip (`old → new`). */
  oldValue: unknown
  /** Value in `after` — the `new` side of the tooltip. */
  newValue: unknown
}

/** Result of a row-list comparison. */
export interface RowDiff {
  /** O(1) per-row status lookup — only keys present in EITHER list appear. */
  status: ReadonlyMap<string | number, RowDiffKind>
  /** O(1) per-row, per-column changed-cell lookup (`changed` rows only). */
  cellChanges: ReadonlyMap<string | number, ReadonlyMap<string, RowDiffCellChange>>
  /** Keys in `after` but not `before` (after order). */
  added: readonly (string | number)[]
  /** Keys in `before` but not `after` (before order). */
  removed: readonly (string | number)[]
  /** Keys in both with ≥1 differing column (after order). */
  changed: readonly (string | number)[]
}

/** Compare one `changed` row pair — after's own key order, then before-only keys. */
function diffRowCells<Row extends Record<string, unknown>>(
  before: Row,
  after: Row,
): ReadonlyMap<string, RowDiffCellChange> {
  const changes = new Map<string, RowDiffCellChange>()
  const keys = Object.keys(after)
  for (const key of Object.keys(before)) {
    if (!(key in after)) keys.push(key)
  }
  for (const key of keys) {
    const oldValue = before[key]
    const newValue = after[key]
    if (!Object.is(oldValue, newValue)) {
      changes.set(key, { key, oldValue, newValue })
    }
  }
  return changes
}

export function diffRows<Row extends Record<string, unknown>>(
  before: readonly Row[],
  after: readonly Row[],
  rowKeyField: string,
): RowDiff {
  const beforeMap = new Map<string | number, Row>()
  const afterMap = new Map<string | number, Row>()
  for (const row of before) {
    const k = row[rowKeyField] as string | number | null | undefined
    if (k == null) continue
    beforeMap.set(k, row)
  }
  for (const row of after) {
    const k = row[rowKeyField] as string | number | null | undefined
    if (k == null) continue
    afterMap.set(k, row)
  }

  const status = new Map<string | number, RowDiffKind>()
  const cellChanges = new Map<string | number, ReadonlyMap<string, RowDiffCellChange>>()
  const removed: (string | number)[] = []
  const added: (string | number)[] = []
  const changed: (string | number)[] = []

  // Keys only in `before` → removed (before order).
  for (const [k] of beforeMap) {
    if (afterMap.has(k)) continue
    removed.push(k)
    status.set(k, 'removed')
  }
  // Keys in `after` → added (absent from before) or changed (cell diff).
  for (const [k, aRow] of afterMap) {
    const bRow = beforeMap.get(k)
    if (!bRow) {
      added.push(k)
      status.set(k, 'added')
      continue
    }
    const cells = diffRowCells(bRow, aRow)
    if (cells.size > 0) {
      changed.push(k)
      status.set(k, 'changed')
      cellChanges.set(k, cells)
    }
  }

  return { status, cellChanges, added, removed, changed }
}
