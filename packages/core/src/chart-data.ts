/**
 * Framework-agnostic mini-chart data (batch AR, iris 独有 — vxe has no
 * equivalent; its closest analog is a hand-built sparkline, which never
 * integrates with the table's own filtered view). Turns one column's values
 * over a row list into the raw material a mini bar/line chart needs: the
 * value points in source order (with gaps) plus a safe numeric domain.
 *
 * Semantics mirror the two precedents it sits between:
 * - `null`/`undefined` source values → a GAP (`null` point — the adapter
 *   draws no bar and breaks the line there).
 * - Non-finite values (NaN/±Infinity) are DROPPED — `aggregate` parity —
 *   they become gaps too and never participate in the domain.
 * - The domain (`min`/`max`) spans only the FINITE points; an empty or
 *   all-gap series → `{ 0, 1 }`, and a FLAT series (min === max) is padded
 *   by `Math.abs(min) || 1` on both sides — the exact `dataDomain` padding
 *   of plugin-charts — so the adapter's `(v − min) / (max − min)` pixel
 *   mapping can never divide by zero.
 *
 * The adapter maps its value indirection into `key` BEFORE calling this (the
 * react bridge passes `dataIndex ?? key`, the same indirection `getCellValue`
 * uses), so the core stays a pure `{ rows, key }` reader — mirroring the
 * `rangeStats`/`valueDistribution` contracts where the adapter does the
 * column mapping. The adapter also owns all pixel geometry (viewBox, rect /
 * polyline / circle JSX) — this material never emits SVG strings.
 */

/** One column's chart material over a row list. */
export interface ChartData {
  /** Values in source order — `null` marks a gap (no bar / line break). */
  points: Array<number | null>
  /** Numeric min of the finite values (flat/empty series padded so min < max). */
  min: number
  /** Numeric max of the finite values. */
  max: number
}

/**
 * Compute the numeric domain of a chart series (batch BI, iris 独有 — the
 * domain half of `buildChartData` extracted so adapters can chart per-prefix
 * series like the column sparkline with the exact same semantics): min/max
 * over the FINITE points only; an empty or all-gap series → `{ 0, 1 }`, and
 * a FLAT series (min === max) is padded by `Math.abs(min) || 1` on both
 * sides — the exact `dataDomain` padding of plugin-charts — so the
 * adapter's `(v − min) / (max − min)` pixel mapping can never divide by
 * zero.
 */
export function chartDomain(points: ReadonlyArray<number | null>): { min: number; max: number } {
  let min: number | null = null
  let max: number | null = null
  for (const value of points) {
    // Finite-only, as documented: `null` is not finite, and neither are
    // NaN/Infinity — a poisoned value must not leak into the domain.
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    if (min === null || value < min) min = value
    if (max === null || value > max) max = value
  }
  if (min === null || max === null) return { min: 0, max: 1 }
  if (min === max) {
    // Flat series: `dataDomain` parity padding so (max − min) is never 0.
    const padding = Math.abs(min) || 1
    return { min: min - padding, max: max + padding }
  }
  return { min, max }
}

/**
 * Extract one column's chart material over `rows`. Values are coerced with
 * `Number` (numeric strings chart as numbers); rows whose value is
 * `null`/`undefined`/non-finite become gap points. The domain covers only
 * the finite points, padded when flat or empty (never `min === max`).
 */
export function buildChartData<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  key: string,
): ChartData {
  const points: Array<number | null> = []
  for (const row of rows) {
    const raw = (row as Record<string, unknown>)[key]
    const value = raw == null ? Number.NaN : Number(raw)
    points.push(Number.isFinite(value) ? value : null)
  }
  const { min, max } = chartDomain(points)
  return { points, min, max }
}
