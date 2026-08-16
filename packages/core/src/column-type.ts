/**
 * Column type auto-detection (batch CX, iris 独有 — vxe relies on the
 * developer declaring `type` / `sortType` per column and never infers):
 * a FRAMEWORK-NEUTRAL pure helper that infers a column's value kind from
 * its first rows, so adapters can fill default alignment + `sortType`
 * without the caller declaring them.
 *
 * Detection is deliberately CONSERVATIVE — only an all-samples-agree signal
 * produces a typed answer; any ambiguity falls back to `'string'` (safe):
 *
 *  - samples = the first {@link DETECT_MAX_SAMPLES} NON-NULLISH values
 *    (nullish cells — `null`/`undefined` — never vote);
 *  - `number`/`boolean` TYPED values vote their kind (non-finite numbers
 *    like NaN/Infinity still vote number — `typeof` parity with the
 *    adapters' per-cell numeric fallback);
 *  - a `Date` instance or an ISO-8601 date string votes `'date'`;
 *  - NUMERIC / BOOLEAN STRINGS stay `'string'` (a CSV import yields all
 *    strings — coercing "123" to number would misalign heterogeneous
 *    rows; string is the fail-safe);
 *  - any two samples disagreeing → `'string'` (mixed-column fail-safe).
 */

/** A detected column value kind. `'string'` is the universal fail-safe. */
export type DetectedColumnType = 'string' | 'number' | 'date' | 'boolean'

/** Maximum samples considered — the first N non-nullish values. */
const DETECT_MAX_SAMPLES = 50

/** ISO-8601 date string: `yyyy-mm-dd` or a full timestamp (T/space
 * separator, optional time + zone). Deliberately regex-based (baseline
 * fiat) — no calendar validation (an invalid month still matches). */
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

/** The kind a single sample votes for. */
function kindOf(value: unknown): DetectedColumnType {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (value instanceof Date) return 'date'
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) return 'date'
  return 'string'
}

/**
 * Infer a column's value kind from its cell samples. Returns `'string'`
 * for an empty / all-nullish sample set (no signal — fail-safe) and for
 * any mixed sample set. See the module doc for the voting rules.
 *
 * @example
 * detectColumnType([1, 2, 3])        // 'number'
 * detectColumnType(['1', '2'])       // 'string' — numeric strings stay string
 * detectColumnType([new Date(0)])    // 'date'
 * detectColumnType(['2024-01-15'])   // 'date'
 * detectColumnType([1, 'two'])       // 'string' — mixed fail-safe
 */
export function detectColumnType(values: readonly unknown[]): DetectedColumnType {
  let kind: DetectedColumnType | null = null
  let sampled = 0
  for (const value of values) {
    if (value == null) continue
    if (sampled >= DETECT_MAX_SAMPLES) break
    sampled += 1
    const next = kindOf(value)
    if (kind === null) kind = next
    else if (kind !== next) return 'string'
  }
  return kind ?? 'string'
}
