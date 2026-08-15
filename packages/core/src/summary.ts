import { countDistinctValues } from './value-distribution'

/**
 * Framework-agnostic natural-language column summary (batch AW, iris 独有 —
 * vxe has no equivalent; its closest analog is a hand-built aggregate footer,
 * which never tells you in one line what a column IS). Renders a column's
 * values as a single human sentence, choosing a branch by the data's shape:
 *
 * - ≥60% (INCLUSIVE) of the non-empty values are numeric → the numeric
 *   sentence `label：共 N 个值，范围 min–max，平均 avg，M 个缺失`, where N is
 *   the non-empty count, min/max/avg are computed over the NUMERIC values
 *   only (non-numeric survivors don't poison the range), and M is the
 *   missing count (`null`/`undefined`/`''`). min/max/avg each go through one
 *   `.toFixed(1)` — the single rounding point for the whole sentence.
 * - otherwise → the categorical sentence: the top-3 distinct values by count
 *   with integer `Math.round` percentages of the non-empty total, then
 *   `，其余 R 个` appended ONLY when more distinct values exist (R = number of
 *   distinct values beyond the top 3).
 * - no non-empty values at all → `label：无数据`.
 *
 * The categorical branch reuses the distribution counting loop via
 * `countDistinctValues` — same semantics as the "Value distribution" panel
 * (null/undefined/`''` excluded, `String` coercion, count desc, first-
 * appearance ties), so the top-3 ranking agrees with the panel's list. The
 * label is the caller's display title (the table passes the clicked column's
 * `title ?? key`); the body is produced in the zh-style sentence form used by
 * the rest of the iris zh docs, with the label prefix separated by `：`.
 */

/** True when a value counts as numeric for the summary branch decision. */
function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'boolean') return false
  if (typeof v === 'string') {
    const s = v.trim()
    return s !== '' && !Number.isNaN(Number(s))
  }
  return false
}

/** Non-empty values — the data points a summary is computed over. */
function nonEmptyValues(values: readonly unknown[]): unknown[] {
  return values.filter((v) => v != null && String(v) !== '')
}

/**
 * Summarize one column's values as a single sentence (see module doc for the
 * branch rules). The return value is already fully formatted — the caller
 * only renders it (the table shows it in a floating panel under the clicked
 * column's title header).
 */
export function summarizeColumn(values: readonly unknown[], label: string): string {
  const nonEmpty = nonEmptyValues(values)
  if (nonEmpty.length === 0) return `${label}：无数据`
  const numeric = nonEmpty.filter(isNumericValue)
  if (numeric.length / nonEmpty.length >= 0.6) {
    const nums = numeric.map((v) => Number(v))
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length
    const missing = values.length - nonEmpty.length
    return (
      `${label}：共 ${nonEmpty.length} 个值，` +
      `范围 ${min.toFixed(1)}–${max.toFixed(1)}，平均 ${avg.toFixed(1)}，${missing} 个缺失`
    )
  }
  const entries = countDistinctValues(values)
  const total = nonEmpty.length
  const parts = entries.slice(0, 3).map((e) => `${Math.round((e.count / total) * 100)}% ${e.value}`)
  const rest = entries.length - Math.min(entries.length, 3)
  if (rest > 0) parts.push(`其余 ${rest} 个`)
  return `${label}：${parts.join('，')}`
}
