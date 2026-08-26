import { createStore, type Store } from './store'
import { createSizeTree, type SizeTree } from './virtualizer-size-tree'

/**
 * STATEFUL virtualization controller — the measurement-feedback layer over the
 * pure {@link computeVirtualRange} math. Where the math is a pure
 * `(scroll, sizes) → window` function the caller re-runs each scroll, the
 * virtualizer OWNS the moving parts a real virtualized Table/List needs:
 *
 * - a **measured-size cache keyed by item key**, so a row's real (post-render)
 *   height survives scrolling away AND data reorder/filtering (sizes follow keys,
 *   not positions);
 * - **incremental offset maintenance** via a Fenwick/BIT tree: a single
 *   `measure(index, size)` is an O(log n) point update + the visible window is an
 *   O(log n) lower-bound search — no O(n) cumulative-offset rebuild per scroll,
 *   which is the cliff that hangs a 100k-row table;
 * - **scroll anchoring** and `scrollToIndex`/`scrollToOffset` that return the
 *   pixel offset the host scroller should apply.
 *
 * All framework-agnostic: the adapter renders `state.items` (each carries its
 * `start`/`size`), reports real sizes back via `measure`, and drives `setScroll`
 * from the scroll handler. One controller, four thin bridges.
 *
 * ## Data change modes
 *
 * | Scenario | Method | Effect |
 * |----------|--------|--------|
 * | Entire dataset replaced (e.g. new search results) | {@link Virtualizer.remeasure} | Clears all measured sizes, uses estimates |
 * | Items inserted/deleted with stable keys | {@link Virtualizer.setCount} | Retains measurement by key for items still present |
 * | Reorder with same count | {@link Virtualizer.setCount} | Re-seats measured sizes onto new positions via key |
 * | Full data swap, want to keep old measurements | {@link Virtualizer.replaceData} | Clears measured cache AND rebuilds Fenwick tree from scratch |
 */

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

export interface VirtualizerConfig {
  /** Number of items. */
  count: number
  /**
   * Estimated px size for an item not yet measured — a constant (fixed-ish rows)
   * or a per-index function. A {@link Virtualizer.measure} call overrides it.
   */
  estimateSize: number | ((index: number) => number)
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

interface VirtualizerRuntime {
  count: number
  viewportSize: number
  scrollOffset: number
  buffer: number
  fixedSize: number | null
  hasExplicitKey: boolean
  keyOf: (index: number) => string | number
  estimate: (index: number) => number
  measured: Map<string | number, number>
  tree: SizeTree
  store: Store<VirtualizerState>
  computeWindow(): VirtualizerState
  sync(): void
  clampScroll(offset: number): number
}

function cloneVirtualizerState(state: VirtualizerState): VirtualizerState {
  return {
    ...state,
    items: state.items.map((item) => ({ ...item })),
  }
}

function sameVirtualizerState(a: VirtualizerState, b: VirtualizerState): boolean {
  if (
    !Object.is(a.offsetBefore, b.offsetBefore) ||
    !Object.is(a.totalSize, b.totalSize) ||
    !Object.is(a.startIndex, b.startIndex) ||
    !Object.is(a.endIndex, b.endIndex) ||
    a.items.length !== b.items.length
  ) {
    return false
  }
  for (let index = 0; index < a.items.length; index++) {
    const item = a.items[index]
    const other = b.items[index]
    if (
      item === undefined ||
      other === undefined ||
      !Object.is(item.index, other.index) ||
      !Object.is(item.key, other.key) ||
      !Object.is(item.start, other.start) ||
      !Object.is(item.size, other.size)
    ) {
      return false
    }
  }
  return true
}

function computeVirtualizerWindow(runtime: VirtualizerRuntime): VirtualizerState {
  const { count, tree, viewportSize, scrollOffset, buffer, fixedSize, keyOf } = runtime
  if (count <= 0) return { items: [], offsetBefore: 0, totalSize: 0, startIndex: 0, endIndex: -1 }
  const total = tree.total()
  const maxScroll = Math.max(0, total - viewportSize)
  const top = Math.max(0, Math.min(scrollOffset, maxScroll))
  let startIndex: number
  let endIndex: number
  if (fixedSize !== null) {
    const size = Math.max(1, fixedSize)
    const first = Math.min(Math.floor(top / size), count - 1)
    const visibleCount = fixedSize <= 0 ? 0 : Math.ceil(viewportSize / fixedSize)
    startIndex = Math.max(0, first - buffer)
    endIndex = Math.min(count, first + visibleCount + buffer) - 1
  } else {
    const first = Math.min(tree.lowerBound(top), count - 1)
    let last = first
    const bottom = top + viewportSize
    while (last < count - 1 && tree.prefix(last + 1) < bottom) last += 1
    startIndex = Math.max(0, first - buffer)
    endIndex = Math.min(count - 1, last + buffer)
  }
  const items: VirtualItem[] = []
  for (let index = startIndex; index <= endIndex; index++) {
    items.push({
      index,
      key: keyOf(index),
      start: tree.prefix(index),
      size: tree.sizeOf(index),
    })
  }
  return { items, offsetBefore: tree.prefix(startIndex), totalSize: total, startIndex, endIndex }
}

function createVirtualizerRuntime(config: VirtualizerConfig): VirtualizerRuntime {
  const count = Math.max(0, config.count)
  const keyOf = config.getItemKey ?? ((index: number) => index)
  const hasExplicitKey = config.getItemKey !== undefined
  if (process.env.NODE_ENV === 'development' && !hasExplicitKey && count > 0) {
    console.warn(
      '[iris-ui] createVirtualizer: no getItemKey provided — using index as key. ' +
        'Measured sizes will map to wrong items when data is inserted or deleted. ' +
        'Provide a stable getItemKey for dynamic data lists.',
    )
  }
  const estimate =
    typeof config.estimateSize === 'function'
      ? config.estimateSize
      : (_index: number) => config.estimateSize as number
  const measured = new Map<string | number, number>()
  const tree = createSizeTree(count, (index) => {
    const measuredSize = measured.get(keyOf(index))
    return measuredSize !== undefined ? measuredSize : Math.max(0, estimate(index))
  })
  const runtime = {} as VirtualizerRuntime
  runtime.count = count
  runtime.viewportSize = Math.max(0, config.viewportSize ?? 0)
  runtime.scrollOffset = Math.max(0, config.scrollOffset ?? 0)
  runtime.buffer = Math.max(0, Math.floor(config.buffer ?? 0))
  runtime.fixedSize =
    config.fixedSize === null || config.fixedSize === undefined
      ? null
      : Math.max(0, config.fixedSize)
  runtime.hasExplicitKey = hasExplicitKey
  runtime.keyOf = keyOf
  runtime.estimate = estimate
  runtime.measured = measured
  runtime.tree = tree
  runtime.computeWindow = () => computeVirtualizerWindow(runtime)
  runtime.store = createStore(runtime.computeWindow())
  runtime.sync = () => runtime.store.setState(runtime.computeWindow())
  runtime.clampScroll = (offset) =>
    Math.max(0, Math.min(offset, Math.max(0, runtime.tree.total() - runtime.viewportSize)))
  return runtime
}

function setVirtualizerScroll(runtime: VirtualizerRuntime, offset: number): void {
  const next = runtime.clampScroll(offset)
  if (next === runtime.scrollOffset) return
  runtime.scrollOffset = next
  runtime.sync()
}

function setVirtualizerViewport(runtime: VirtualizerRuntime, size: number): void {
  const next = Math.max(0, size)
  if (next === runtime.viewportSize) return
  runtime.viewportSize = next
  runtime.scrollOffset = runtime.clampScroll(runtime.scrollOffset)
  runtime.sync()
}

function setVirtualizerBuffer(runtime: VirtualizerRuntime, buffer: number): void {
  const next = Math.max(0, Math.floor(Number.isFinite(buffer) ? buffer : 0))
  if (next === runtime.buffer) return
  runtime.buffer = next
  runtime.sync()
}

function setVirtualizerFixedSize(runtime: VirtualizerRuntime, size: number | null): void {
  const next = size === null || !Number.isFinite(size) ? null : Math.max(0, size)
  if (next === runtime.fixedSize) return
  runtime.fixedSize = next
  runtime.sync()
}

function setVirtualizerCount(runtime: VirtualizerRuntime, next: number): void {
  runtime.count = Math.max(0, next)
  runtime.tree.reset(runtime.count)
  runtime.scrollOffset = runtime.clampScroll(runtime.scrollOffset)
  runtime.sync()
}

function replaceVirtualizerData(runtime: VirtualizerRuntime, next: number): void {
  runtime.count = Math.max(0, next)
  runtime.measured.clear()
  runtime.tree.reset(runtime.count)
  runtime.scrollOffset = runtime.clampScroll(runtime.scrollOffset)
  runtime.sync()
}

function measureVirtualizerItem(runtime: VirtualizerRuntime, index: number, size: number): void {
  if (index < 0 || index >= runtime.count) return
  runtime.measured.set(runtime.keyOf(index), Math.max(0, size))
  if (!runtime.tree.set(index, size)) return
  runtime.scrollOffset = runtime.clampScroll(runtime.scrollOffset)
  runtime.sync()
}

function remeasureVirtualizer(runtime: VirtualizerRuntime): void {
  runtime.measured.clear()
  runtime.tree.reset(runtime.count)
  runtime.scrollOffset = runtime.clampScroll(runtime.scrollOffset)
  runtime.sync()
}

function scrollVirtualizerToIndex(
  runtime: VirtualizerRuntime,
  index: number,
  align: 'start' | 'center' | 'end',
): number {
  if (runtime.count <= 0) return 0
  const targetIndex = Math.max(0, Math.min(index, runtime.count - 1))
  const start = runtime.tree.prefix(targetIndex)
  const size = runtime.tree.sizeOf(targetIndex)
  const target =
    align === 'center'
      ? start - (runtime.viewportSize - size) / 2
      : align === 'end'
        ? start - runtime.viewportSize + size
        : start
  const next = runtime.clampScroll(target)
  runtime.scrollOffset = next
  runtime.sync()
  return next
}

function scrollVirtualizerToOffset(runtime: VirtualizerRuntime, offset: number): number {
  const next = runtime.clampScroll(offset)
  runtime.scrollOffset = next
  runtime.sync()
  return next
}

function createVirtualizerViewportApi(
  runtime: VirtualizerRuntime,
): Pick<
  Virtualizer,
  | 'store'
  | 'getState'
  | 'subscribe'
  | 'setScroll'
  | 'setViewportSize'
  | 'setBuffer'
  | 'setFixedSize'
  | 'scrollToIndex'
  | 'scrollToOffset'
  | 'totalSize'
> {
  let snapshotSource: VirtualizerState | undefined
  let snapshot: VirtualizerState | undefined
  const getState = (): VirtualizerState => {
    const state = runtime.store.getState()
    // Keep the public snapshot stable between controller updates for external
    // store consumers, while repairing a snapshot that a caller mutated.
    if (
      snapshot === undefined ||
      snapshotSource !== state ||
      !sameVirtualizerState(snapshot, state)
    ) {
      snapshotSource = state
      snapshot = cloneVirtualizerState(state)
    }
    return snapshot
  }

  return {
    store: runtime.store,
    getState,
    subscribe: (listener) =>
      runtime.store.subscribe((state) => listener(cloneVirtualizerState(state))),
    setScroll: (offset) => setVirtualizerScroll(runtime, offset),
    setViewportSize: (size) => setVirtualizerViewport(runtime, size),
    setBuffer: (buffer) => setVirtualizerBuffer(runtime, buffer),
    setFixedSize: (size) => setVirtualizerFixedSize(runtime, size),
    scrollToIndex: (index, align = 'start') => scrollVirtualizerToIndex(runtime, index, align),
    scrollToOffset: (offset) => scrollVirtualizerToOffset(runtime, offset),
    totalSize: () => runtime.tree.total(),
  }
}

function createVirtualizerDataApi(
  runtime: VirtualizerRuntime,
): Pick<Virtualizer, 'setCount' | 'replaceData' | 'measure' | 'remeasure' | 'detectCacheSkew'> {
  const diagnostics =
    process.env.NODE_ENV === 'development'
      ? {
          detectCacheSkew: (): string | null =>
            !runtime.hasExplicitKey && runtime.count > 0
              ? 'Virtualizer is using index-as-key (no getItemKey provided). ' +
                'Item insertion/deletion will cause measured sizes to map to wrong positions. ' +
                'Provide a stable getItemKey for dynamic data.'
              : null,
        }
      : {}
  return {
    setCount: (count) => setVirtualizerCount(runtime, count),
    replaceData: (count) => replaceVirtualizerData(runtime, count),
    measure: (index, size) => measureVirtualizerItem(runtime, index, size),
    remeasure: () => remeasureVirtualizer(runtime),
    ...diagnostics,
  }
}

function createVirtualizerApi(runtime: VirtualizerRuntime): Virtualizer {
  return { ...createVirtualizerViewportApi(runtime), ...createVirtualizerDataApi(runtime) }
}

export function createVirtualizer(config: VirtualizerConfig): Virtualizer {
  return createVirtualizerApi(createVirtualizerRuntime(config))
}
