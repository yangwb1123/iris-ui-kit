import type { Store } from './store'

/** One item to render: its index, stable key, pixel start, and current size. */
export interface VirtualItem {
  index: number
  key: string | number
  /** Pixel offset of the item's top edge from the start of the list. */
  start: number
  /** Current size in px (measured if known, else estimated). */
  size: number
}

export interface VirtualizerState {
  /** Items in the visible window (+ buffer) to render. */
  items: VirtualItem[]
  /** Pixel offset of the first rendered item (apply as translateY / padding). */
  offsetBefore: number
  /** Total scrollable pixel size of all items. */
  totalSize: number
  /** First rendered index (inclusive). */
  startIndex: number
  /** Last rendered index (inclusive); `-1` when empty. */
  endIndex: number
}

export type VirtualizerEstimate = number | ((index: number) => number)

export interface VirtualizerConfig {
  /** Number of items. */
  count: number
  /**
   * Estimated px size for an item not yet measured — a constant (fixed-ish rows)
   * or a per-index function. A {@link Virtualizer.measure} call overrides it.
   */
  estimateSize: VirtualizerEstimate
  /** Visible viewport size in px. Default `0` (set later via setViewportSize). */
  viewportSize?: number
  /** Initial scroll offset in px. Default `0`. */
  scrollOffset?: number
  /** Extra items rendered above and below the viewport. Default `0`. */
  buffer?: number
  /**
   * Fixed item size for the closed-form range path. `null` keeps the variable
   * offset-tree range. Adapters pass this when their public size is numeric.
   */
  fixedSize?: number | null
  /**
   * Stable key for the item at `index`, so measured sizes survive reorder /
   * filtering (the cache is keyed by this, not by position). Default: the index.
   *
   * **Warning**: When using the default (index-as-key), inserting or removing
   * items will cause measured sizes to map to wrong items. Always provide a
   * stable `getItemKey` for dynamic data lists.
   */
  getItemKey?: (index: number) => string | number
}

export interface Virtualizer {
  store: Store<VirtualizerState>
  getState(): VirtualizerState
  subscribe(listener: (state: VirtualizerState) => void): () => void
  /** Update the scroll offset (from the host scroll handler). Clamped. */
  setScroll(offset: number): void
  /** Update the viewport size (px). */
  setViewportSize(size: number): void
  /** Update the number of overscan items rendered on either side. */
  setBuffer(buffer: number): void
  /**
   * Update the estimate for unmeasured items without dropping measurements.
   * A real measurement remains authoritative until `remeasure()` is called.
   * When `fixedSize` is supplied, both sizing modes commit atomically.
   */
  setEstimateSize(estimate: VirtualizerEstimate, fixedSize?: number | null): void
  /** Switch between the fixed closed-form and variable offset-tree range paths. */
  setFixedSize(size: number | null): void
  /**
   * Change the item count (e.g. paged/infinite growth or a reorder). Rebuilds the
   * size tree from the current keys + measured cache — call after the data set
   * changes order with the SAME count to re-seat measured sizes onto new
   * positions.
   *
   * Use when items are inserted or deleted but keys remain stable. For a full
   * data replacement, use {@link remeasure} or {@link replaceData}.
   */
  setCount(count: number): void
  /**
   * Replace the entire dataset — clears all measured sizes and rebuilds the
   * Fenwick tree from estimates. Unlike `setCount`, which preserves existing
   * measurements by key, `replaceData` starts fresh so old data sizes don't
   * pollute the new dataset.
   *
   * Use when the data identity has fully changed (e.g. new search query).
   */
  replaceData(count: number): void
  /** Record the real measured size of the item at `index` (keyed). O(log n). */
  measure(index: number, size: number): void
  /** Drop all measured sizes (data fully replaced) and rebuild from estimates. */
  remeasure(): void
  /**
   * Offset (px) that brings item `index` into view per `align`. Also applies it
   * internally (the window updates); the host applies the returned value to the
   * scroll element.
   */
  scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): number
  /** Clamp + apply a target scroll offset; returns the clamped value. */
  scrollToOffset(offset: number): number
  /** Total scrollable size in px. */
  totalSize(): number
  /**
   * Development-mode diagnostic: detects cache skew when `getItemKey` is not
   * provided (uses index-as-key) by checking whether consecutive `isSelected` /
   * `measure` calls show signs of misalignment. Returns a human-readable
   * warning or `null` if no skew detected.
   *
   * Only available in development builds.
   */
  detectCacheSkew?(): string | null
}
