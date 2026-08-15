/**
 * Framework-agnostic value distribution (batch AM, iris 独有 — vxe has no
 * equivalent; its closest analog is hand-building a filter-option list, which
 * never tells you HOW lopsided the data is). Counts each distinct value of one
 * column over a row list — the material behind the table's right-click "Value
 * distribution" panel and a cheap way to spot skewed columns.
 *
 * Semantics: `null`/`undefined`/`''` are NOT data points (excluded entirely);
 * every other value is coerced with `String` (a column holding `1` and `"1"`
 * counts ONE bucket). Entries sort by count DESCENDING, ties broken by first
 * appearance in `rows` (the same stable tie order `groupRows` uses). An empty
 * row list — or one where every value is excluded — → `[]`.
 *
 * The adapter maps its value indirection into `key` BEFORE calling this (the
 * react bridge passes `dataIndex ?? key`, the same indirection `getCellValue`
 * uses), so the core stays a pure `{ rows, key }` reader — mirroring the
 * rangeStats contract where the adapter does the column mapping.
 */

/** One distinct value's count over the row list. */
export interface ValueDistributionEntry {
  /** The `String`-coerced distinct value. */
  value: string
  /** How many rows carry it (rows with null/undefined/'' excluded). */
  count: number
}

/**
 * Count the distinct values of a flat value list. Entries sort by count
 * descending; equal counts keep first-appearance order. `null`/`undefined`/
 * `''` are excluded; everything else is compared and reported as its `String`
 * form. Extracted from `valueDistribution` (batch AW) so the counting loop is
 * shared with `summarizeColumn`'s categorical branch — the same exclusion /
 * coercion / tie semantics are exactly the top-3 ranking that summary needs.
 */
export function countDistinctValues(values: readonly unknown[]): ValueDistributionEntry[] {
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const raw of values) {
    if (raw == null) continue
    const s = String(raw)
    if (s === '') continue
    if (!counts.has(s)) {
      counts.set(s, 0)
      order.push(s)
    }
    counts.set(s, counts.get(s)! + 1)
  }
  return order
    .map((value) => ({ value, count: counts.get(value)! }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Count the distinct values of one column (`key`) over `rows`. Entries sort
 * by count descending; equal counts keep first-appearance order. Rows whose
 * value is `null`/`undefined`/`''` are excluded; everything else is compared
 * and reported as its `String` form.
 */
export function valueDistribution<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  key: string,
): ValueDistributionEntry[] {
  return countDistinctValues(rows.map((row) => (row as Record<string, unknown>)[key]))
}
