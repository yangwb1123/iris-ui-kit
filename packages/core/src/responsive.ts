/**
 * Framework-agnostic narrow-width responsive fit for tables (batch CY, iris
 * 独有 — vxe has no responsive column behavior): a pure greedy tail-hide that
 * decides which TOP-LEVEL display columns a narrow container keeps. The
 * adapter measures its container via ResizeObserver and passes the baked
 * budget here; this module only does fit math — no DOM, no framework.
 */

/** Narrow threshold in px — strictly BELOW the responsive collapse engages;
 * exactly 480 (or more) is full width and the table renders byte-identical
 * to the non-responsive path. 0 / negative container widths (not measured
 * yet) are fail-closed too. */
export const RESPONSIVE_NARROW_WIDTH = 480

/** Minimal top-level column shape the responsive fit needs: a stable `key`
 * plus optional `children` (grouped header). Real column types extend it. */
export interface ResponsiveColumn {
  key: string
  children?: readonly ResponsiveColumn[]
}

/** Options for {@link computeResponsiveColumns}. */
export interface ComputeResponsiveColumnsOptions {
  /** Width of a LEAF column in px — the adapter's resolved chain (explicit
   * override → declared number → default). Grouped columns derive their
   * natural width as the sum of their leaf descendants. */
  widthOf: (col: ResponsiveColumn) => number
  /** Column that must survive collapse (e.g. pinned to an edge); its width
   * ALWAYS counts toward the natural width. Default: nothing is protected. */
  isPinned?: (col: ResponsiveColumn) => boolean
  /** Minimum number of unprotected top-level columns that must remain
   * visible. Default 1 — a narrowing table never blanks itself. */
  floor?: number
  /** Narrow threshold in px — strictly below is narrow. Defaults to
   * {@link RESPONSIVE_NARROW_WIDTH}. */
  narrowWidth?: number
}

/** Natural width of a (possibly grouped) top-level column: the resolved leaf
 * width for a leaf; the sum of its descendants for a group. */
function naturalWidthOf(
  col: ResponsiveColumn,
  widthOf: (col: ResponsiveColumn) => number,
): number | null {
  if (col.children && col.children.length > 0) {
    let total = 0
    for (const child of col.children) {
      const width = naturalWidthOf(child, widthOf)
      if (width === null) return null
      total += width
    }
    return total
  }
  const width = widthOf(col)
  // A broken measurement must never turn the fit budget into NaN/Infinity or
  // make the algorithm hide arbitrary columns.  Returning null lets the
  // caller preserve the original column list (fail-closed).
  return Number.isFinite(width) && width >= 0 ? width : null
}

interface ResponsiveMeasurement {
  total: number
  freeCount: number
  naturalWidths: number[]
}

function measureResponsiveColumns(
  columns: readonly ResponsiveColumn[],
  widthOf: (col: ResponsiveColumn) => number,
  isPinned: (col: ResponsiveColumn) => boolean,
): ResponsiveMeasurement | null {
  let total = 0
  let freeCount = 0
  const naturalWidths: number[] = []
  for (const col of columns) {
    const width = naturalWidthOf(col, widthOf)
    if (width === null) return null
    naturalWidths.push(width)
    total += width
    if (!isPinned(col)) freeCount += 1
  }
  return { total, freeCount, naturalWidths }
}

function hideResponsiveTail(
  columns: readonly ResponsiveColumn[],
  containerWidth: number,
  floor: number,
  isPinned: (col: ResponsiveColumn) => boolean,
  measurement: ResponsiveMeasurement,
): boolean[] {
  const kept = new Array<boolean>(columns.length).fill(true)
  let { total, freeCount } = measurement
  for (let i = columns.length - 1; i >= 0 && total > containerWidth; i -= 1) {
    const col = columns[i]!
    if (isPinned(col) || freeCount <= floor) continue
    kept[i] = false
    freeCount -= 1
    total -= measurement.naturalWidths[i]!
  }
  return kept
}

function hasResponsiveHiddenColumns(kept: readonly boolean[]): boolean {
  return kept.some((value) => !value)
}

/**
 * Greedy tail-hide of top-level display columns until the natural width fits
 * the container budget:
 *
 * - Only engages when `0 < containerWidth < narrowWidth` (480 by default) —
 *   at/above the threshold, or before the adapter has a measure, the input
 *   array is returned UNCHANGED (same reference, so downstream memos stay
 *   byte-identical). A completely fitting table also returns the input.
 * - Candidates are removed from the TAIL in display order — display order is
 *   the lowest priority (`columnOrder` is already honored upstream by the
 *   adapter), so the minimum-number-of-removals policy hides the least
 *   important columns first.
 * - Pinned columns survive collapse and always count toward the natural
 *   width; at least `floor` (default 1) unprotected columns remain, so a
 *   very narrow container still shows a column instead of blanking.
 *
 * Returns the kept columns — the SAME array reference when nothing is
 * hidden, a filtered copy otherwise.
 */
export function computeResponsiveColumns<C extends ResponsiveColumn>(
  columns: readonly C[],
  containerWidth: number,
  options: ComputeResponsiveColumnsOptions,
): readonly C[] {
  const {
    widthOf,
    isPinned = () => false,
    floor = 1,
    narrowWidth = RESPONSIVE_NARROW_WIDTH,
  } = options
  if (containerWidth <= 0 || containerWidth >= narrowWidth) return columns
  if (columns.length === 0) return columns
  const measurement = measureResponsiveColumns(columns, widthOf, isPinned)
  if (measurement === null || measurement.total <= containerWidth) return columns
  const kept = hideResponsiveTail(columns, containerWidth, floor, isPinned, measurement)
  if (!hasResponsiveHiddenColumns(kept)) return columns
  return columns.filter((_, i) => kept[i]!)
}
