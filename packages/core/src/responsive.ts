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
  ancestors = new Set<object>(),
): number | null {
  if (
    col === null ||
    typeof col !== 'object' ||
    typeof col.key !== 'string' ||
    ancestors.has(col)
  ) {
    return null
  }
  const children = (col as { children?: unknown }).children
  if (children !== undefined && !Array.isArray(children)) return null
  if (children && children.length > 0) {
    ancestors.add(col)
    let total = 0
    for (const child of children) {
      const width = naturalWidthOf(child, widthOf, ancestors)
      if (width === null) {
        ancestors.delete(col)
        return null
      }
      total += width
      if (!Number.isFinite(total)) {
        ancestors.delete(col)
        return null
      }
    }
    ancestors.delete(col)
    return total
  }
  let width: number
  try {
    width = widthOf(col)
  } catch {
    return null
  }
  // A broken measurement must never turn the fit budget into NaN/Infinity or
  // make the algorithm hide arbitrary columns.  Returning null lets the
  // caller preserve the original column list (fail-closed).
  return Number.isFinite(width) && width >= 0 ? width : null
}

interface ResponsiveMeasurement {
  total: number
  freeCount: number
  naturalWidths: number[]
  pinned: boolean[]
}

function measureResponsiveColumns(
  columns: readonly ResponsiveColumn[],
  widthOf: (col: ResponsiveColumn) => number,
  isPinned: (col: ResponsiveColumn) => boolean,
): ResponsiveMeasurement | null {
  let total = 0
  let freeCount = 0
  const naturalWidths: number[] = []
  const pinned: boolean[] = []
  for (const col of columns) {
    const width = naturalWidthOf(col, widthOf)
    if (width === null) return null
    naturalWidths.push(width)
    total += width
    if (!Number.isFinite(total)) return null
    let isColumnPinned: boolean
    try {
      isColumnPinned = isPinned(col)
    } catch {
      return null
    }
    if (typeof isColumnPinned !== 'boolean') return null
    pinned.push(isColumnPinned)
    if (!isColumnPinned) freeCount += 1
  }
  return { total, freeCount, naturalWidths, pinned }
}

function hideResponsiveTail(
  columns: readonly ResponsiveColumn[],
  containerWidth: number,
  floor: number,
  measurement: ResponsiveMeasurement,
): boolean[] {
  const kept = new Array<boolean>(columns.length).fill(true)
  let { total, freeCount } = measurement
  for (let i = columns.length - 1; i >= 0 && total > containerWidth; i -= 1) {
    if (measurement.pinned[i] || freeCount <= floor) continue
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
  if (
    !Number.isFinite(containerWidth) ||
    containerWidth <= 0 ||
    !Number.isFinite(narrowWidth) ||
    narrowWidth <= 0 ||
    containerWidth >= narrowWidth ||
    !Number.isFinite(floor) ||
    !Number.isInteger(floor) ||
    floor < 1
  ) {
    return columns
  }
  if (columns.length === 0) return columns
  const measurement = measureResponsiveColumns(columns, widthOf, isPinned)
  if (measurement === null || measurement.total <= containerWidth) return columns
  const kept = hideResponsiveTail(columns, containerWidth, floor, measurement)
  if (!hasResponsiveHiddenColumns(kept)) return columns
  return columns.filter((_, i) => kept[i]!)
}

/** Options for the table-level responsive projection, including leading tracks. */
export interface ComputeResponsiveColumnLayoutOptions<C extends ResponsiveColumn> {
  /** Width of a leaf column in pixels. */
  widthOf: (column: C) => number
  /** Pin resolver for leaves; grouped columns inherit protection from descendants. */
  isPinnedLeaf?: (column: C) => boolean
  /** Width consumed by non-data leading tracks (drag/seq/detail/selection). */
  leadingWidth?: number
  /** Minimum number of unprotected top-level columns to retain. */
  floor?: number
  /** Narrow threshold; defaults to {@link RESPONSIVE_NARROW_WIDTH}. */
  narrowWidth?: number
}

/** Result of the table-level responsive projection. */
export interface ResponsiveColumnLayout<C extends ResponsiveColumn> {
  /** Fitted top-level columns; identity is preserved when no columns hide. */
  readonly columns: readonly C[]
  /** Whether the fitted table still exceeds the measured container width. */
  readonly overflow: boolean
}

/**
 * Apply the complete narrow-table projection used by adapters: subtract
 * leading tracks, protect grouped descendants, fit top-level columns, and
 * report overflow from the fitted natural width. Keeping this in Core avoids
 * three subtly different adapter copies of the same budget math.
 */
export function computeResponsiveColumnLayout<C extends ResponsiveColumn>(
  columns: readonly C[],
  containerWidth: number,
  options: ComputeResponsiveColumnLayoutOptions<C>,
): ResponsiveColumnLayout<C> {
  const leadingWidth = options.leadingWidth ?? 0
  const narrowWidth = options.narrowWidth ?? RESPONSIVE_NARROW_WIDTH
  if (
    !Number.isFinite(containerWidth) ||
    containerWidth <= 0 ||
    !Number.isFinite(narrowWidth) ||
    narrowWidth <= 0 ||
    containerWidth >= narrowWidth ||
    !Number.isFinite(leadingWidth) ||
    leadingWidth < 0
  ) {
    return { columns, overflow: false }
  }

  const isPinned = (column: ResponsiveColumn, ancestors = new Set<object>()): boolean | null => {
    if (
      column === null ||
      typeof column !== 'object' ||
      typeof column.key !== 'string' ||
      ancestors.has(column)
    ) {
      return null
    }
    const children = (column as { children?: unknown }).children
    if (children !== undefined && !Array.isArray(children)) return null
    if (children && children.length > 0) {
      ancestors.add(column)
      let pinned = false
      for (const child of children) {
        const childPinned = isPinned(child, ancestors)
        if (childPinned === null) {
          ancestors.delete(column)
          return null
        }
        pinned ||= childPinned
      }
      ancestors.delete(column)
      return pinned
    }
    try {
      return options.isPinnedLeaf?.(column as C) ?? false
    } catch {
      return null
    }
  }
  const fitted = computeResponsiveColumns(columns, Math.max(1, containerWidth - leadingWidth), {
    widthOf: (column) => options.widthOf(column as C),
    isPinned: (column) => isPinned(column) ?? true,
    floor: options.floor,
    narrowWidth: narrowWidth - leadingWidth,
  })
  let natural = leadingWidth
  for (const column of fitted) {
    const width = naturalWidthOf(column, (leaf) => options.widthOf(leaf as C))
    if (width === null) return { columns: fitted, overflow: false }
    natural += width
    if (!Number.isFinite(natural)) return { columns: fitted, overflow: false }
  }
  return { columns: fitted, overflow: natural > containerWidth }
}
