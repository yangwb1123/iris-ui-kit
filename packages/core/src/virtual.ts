/**
 * Framework-agnostic virtualization math. Given a scroll position and item
 * sizing, it returns the slice of items to render plus the spacer offset — the
 * pure core both the React and Vue `VirtualScroll` adapters build on. Supports
 * a fixed row height (the common case) and **variable** heights via a per-index
 * size function, which is what lets a virtualized Table/List carry wrapped text
 * or expandable detail rows.
 */

export interface VirtualWindow {
  /** First item index to render (inclusive), buffer applied. */
  startIndex: number
  /** Last item index to render (inclusive), buffer applied. `-1` when empty. */
  endIndex: number
  /** Pixel offset of `startIndex` from the top (use as translateY / padding). */
  offsetBefore: number
  /** Total scrollable pixel size of all items. */
  totalSize: number
}

export interface VirtualRangeOptions {
  itemCount: number
  scrollTop: number
  viewportSize: number
  /** Fixed pixel size for every row, or a per-index measure function. */
  itemSize: number | ((index: number) => number)
  /** Extra rows rendered above and below the viewport. Default `0`. */
  buffer?: number
  /**
   * Precomputed cumulative offsets (from {@link buildOffsets}, length
   * `itemCount + 1`). When supplied, variable-height ranging reuses this array
   * and binary-searches it instead of rebuilding offsets O(n) on every scroll —
   * pass a memoized array you rebuild only when item sizes change. Takes
   * precedence over `itemSize`.
   */
  offsets?: number[]
}

const EMPTY: VirtualWindow = { startIndex: 0, endIndex: -1, offsetBefore: 0, totalSize: 0 }

function fixedRange(
  itemCount: number,
  scrollTop: number,
  viewportSize: number,
  size: number,
  buffer: number,
): VirtualWindow {
  const totalSize = itemCount * size
  if (size <= 0) return { startIndex: 0, endIndex: itemCount - 1, offsetBefore: 0, totalSize }
  const clampedTop = Math.max(0, Math.min(scrollTop, Math.max(0, totalSize - viewportSize)))
  const first = Math.floor(clampedTop / size)
  const visible = Math.ceil(viewportSize / size)
  const startIndex = Math.max(0, first - buffer)
  const endIndex = Math.min(itemCount - 1, first + visible + buffer)
  return { startIndex, endIndex, offsetBefore: startIndex * size, totalSize }
}

/**
 * Build cumulative pixel offsets: `offsets[i]` is the top of item `i`, and
 * `offsets[itemCount]` is the total size. O(n); a caller rendering huge lists
 * can cache this between scrolls since it only changes when sizes change.
 */
export function buildOffsets(itemCount: number, sizeAt: (index: number) => number): number[] {
  const offsets = new Array<number>(itemCount + 1)
  offsets[0] = 0
  for (let i = 0; i < itemCount; i += 1) {
    offsets[i + 1] = offsets[i] + Math.max(0, sizeAt(i))
  }
  return offsets
}

/** Largest index whose offset is <= target (binary search over sorted offsets). */
function findIndexAtOffset(offsets: number[], target: number): number {
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid] <= target) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Compute the window from already-built cumulative `offsets` (no O(n) rebuild). */
function rangeFromOffsets(
  offsets: number[],
  itemCount: number,
  scrollTop: number,
  viewportSize: number,
  buffer: number,
): VirtualWindow {
  const totalSize = offsets[itemCount]
  const clampedTop = Math.max(0, Math.min(scrollTop, Math.max(0, totalSize - viewportSize)))
  const first = Math.min(findIndexAtOffset(offsets, clampedTop), itemCount - 1)
  // Walk forward until the viewport's bottom edge is covered.
  let last = first
  const bottom = clampedTop + viewportSize
  while (last < itemCount - 1 && offsets[last + 1] < bottom) last += 1
  const startIndex = Math.max(0, first - buffer)
  const endIndex = Math.min(itemCount - 1, last + buffer)
  return { startIndex, endIndex, offsetBefore: offsets[startIndex], totalSize }
}

function variableRange(
  itemCount: number,
  scrollTop: number,
  viewportSize: number,
  sizeAt: (index: number) => number,
  buffer: number,
): VirtualWindow {
  return rangeFromOffsets(
    buildOffsets(itemCount, sizeAt),
    itemCount,
    scrollTop,
    viewportSize,
    buffer,
  )
}

export function computeVirtualRange(options: VirtualRangeOptions): VirtualWindow {
  const { itemCount, scrollTop, viewportSize, itemSize, buffer = 0, offsets } = options
  if (itemCount <= 0) return { ...EMPTY }
  const safeBuffer = Math.max(0, Math.floor(buffer))
  // A cached offsets array skips the per-scroll O(n) rebuild (binary search only).
  if (offsets) return rangeFromOffsets(offsets, itemCount, scrollTop, viewportSize, safeBuffer)
  return typeof itemSize === 'function'
    ? variableRange(itemCount, scrollTop, viewportSize, itemSize, safeBuffer)
    : fixedRange(itemCount, scrollTop, viewportSize, itemSize, safeBuffer)
}

export interface GridFrozenConfig {
  /** Number of fixed rows pinned to the top. */
  rows?: number
  /** Number of fixed columns pinned to the left. */
  columns?: number
}

export interface GridVirtualRangeOptions {
  /** Vertical axis: which rows to render. `scrollTop` is the vertical scroll. */
  rows: VirtualRangeOptions
  /** Horizontal axis: which columns to render. Use `scrollTop` for `scrollLeft`. */
  columns: VirtualRangeOptions
  /**
   * Frozen rows/columns pinned in the viewport. Frozen rows are rendered as a
   * separate segment at the top (not part of the virtual scrollable area);
   * frozen columns at the left. The scrollable range excludes the frozen count.
   */
  frozen?: GridFrozenConfig
}

export interface GridVirtualWindow {
  rows: VirtualWindow
  columns: VirtualWindow
  /** Frozen rows segment (indices 0..frozen.rows-1, or empty if none). */
  frozenRows?: VirtualWindow
  /** Frozen columns segment (indices 0..frozen.columns-1, or empty if none). */
  frozenColumns?: VirtualWindow
}

/**
 * 2D virtualization: the visible row window AND column window in one call. The
 * two axes are independent 1D ranges (the math is axis-agnostic), so this is the
 * primitive behind a grid that virtualizes BOTH directions — a very wide *and*
 * very tall data table — rather than rows-only. Each axis independently supports
 * fixed/variable sizing and cached {@link VirtualRangeOptions.offsets}.
 *
 * When `frozen` is specified, the frozen rows/columns are extracted from the
 * scrollable range and returned as separate {@link VirtualWindow} segments.
 * The scrollable window in `rows`/`columns` excludes the frozen count, and the
 * frozen segments cover indices 0..frozen.rows-1 / 0..frozen.columns-1.
 */
export function computeGridVirtualRange(options: GridVirtualRangeOptions): GridVirtualWindow {
  const { frozen } = options

  // Compute frozen windows if configured.
  const frozenRows = frozen?.rows ? computeFrozenWindow(frozen.rows, options.rows) : undefined
  const frozenColumns = frozen?.columns
    ? computeFrozenWindow(frozen.columns, options.columns)
    : undefined

  // Compute scrollable windows minus frozen count.
  // When frozen count >= item count, the scrollable range is empty.
  const frozenRowCount = frozen?.rows ?? 0
  const frozenColCount = frozen?.columns ?? 0
  const scrollableRows: VirtualRangeOptions =
    frozenRows && options.rows.itemCount > frozenRowCount
      ? { ...options.rows, itemCount: options.rows.itemCount - frozenRowCount }
      : frozenRows
        ? { ...options.rows, itemCount: 0 }
        : options.rows
  const scrollableColumns: VirtualRangeOptions =
    frozenColumns && options.columns.itemCount > frozenColCount
      ? { ...options.columns, itemCount: options.columns.itemCount - frozenColCount }
      : frozenColumns
        ? { ...options.columns, itemCount: 0 }
        : options.columns

  return {
    rows: computeVirtualRange(scrollableRows),
    columns: computeVirtualRange(scrollableColumns),
    frozenRows,
    frozenColumns,
  }
}

/**
 * Compute a frozen window at the start of the range.
 * Frozen items always appear at indices 0..count-1 with zero offset.
 */
function computeFrozenWindow(count: number, options: VirtualRangeOptions): VirtualWindow {
  const safeCount = Math.min(count, options.itemCount)
  if (safeCount <= 0) return { startIndex: 0, endIndex: -1, offsetBefore: 0, totalSize: 0 }

  // Compute total size of frozen items.
  let totalSize = 0
  if (options.offsets) {
    totalSize = options.offsets[safeCount]
  } else if (typeof options.itemSize === 'function') {
    for (let i = 0; i < safeCount; i++) {
      totalSize += options.itemSize(i)
    }
  } else {
    totalSize = safeCount * options.itemSize
  }

  return {
    startIndex: 0,
    endIndex: safeCount - 1,
    offsetBefore: 0,
    totalSize,
  }
}
