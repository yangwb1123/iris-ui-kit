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

export interface GridVirtualRangeOptions {
  /** Vertical axis: which rows to render. `scrollTop` is the vertical scroll. */
  rows: VirtualRangeOptions
  /** Horizontal axis: which columns to render. Use `scrollTop` for `scrollLeft`. */
  columns: VirtualRangeOptions
}

export interface GridVirtualWindow {
  rows: VirtualWindow
  columns: VirtualWindow
}

/**
 * 2D virtualization: the visible row window AND column window in one call. The
 * two axes are independent 1D ranges (the math is axis-agnostic), so this is the
 * primitive behind a grid that virtualizes BOTH directions — a very wide *and*
 * very tall data table — rather than rows-only. Each axis independently supports
 * fixed/variable sizing and cached {@link VirtualRangeOptions.offsets}.
 */
export function computeGridVirtualRange(options: GridVirtualRangeOptions): GridVirtualWindow {
  return {
    rows: computeVirtualRange(options.rows),
    columns: computeVirtualRange(options.columns),
  }
}
