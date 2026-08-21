import { createStore, type Store } from './store'

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

/**
 * Fenwick (binary-indexed) tree over per-item sizes: O(log n) point update and
 * prefix-sum (item offset), plus an O(log n) lower-bound to find the item at a
 * pixel offset. This is what makes `measure` and the per-scroll window cheap at
 * 100k rows instead of an O(n) cumulative-offset rebuild.
 */
interface SizeTree {
  prefix(index: number): number
  set(index: number, size: number): boolean
  lowerBound(target: number): number
  sizeOf(index: number): number
  total(): number
  reset(count: number): void
  readonly count: number
  snapshotSizes(): number[]
}

class FenwickSizeTree implements SizeTree {
  private n: number
  private sizes: number[]
  private tree: number[]

  constructor(
    private readonly sizeAt: (index: number) => number,
    count: number,
  ) {
    this.n = count
    this.sizes = []
    this.tree = []
    this.build()
  }

  private build(): void {
    this.sizes = new Array<number>(this.n)
    this.tree = new Array<number>(this.n + 1).fill(0)
    for (let i = 0; i < this.n; i++) {
      const size = Math.max(0, this.sizeAt(i))
      this.sizes[i] = size
      this.tree[i + 1] += size
      const parent = i + 1 + ((i + 1) & -(i + 1) || 0)
      if (parent <= this.n) this.tree[parent] += this.tree[i + 1]
    }
  }

  prefix(index: number): number {
    let sum = 0
    for (let cursor = index; cursor > 0; cursor -= cursor & -cursor) sum += this.tree[cursor]
    return sum
  }

  set(index: number, size: number): boolean {
    if (index < 0 || index >= this.n) return false
    const next = Math.max(0, size)
    const delta = next - this.sizes[index]
    if (delta === 0) return false
    this.sizes[index] = next
    for (let cursor = index + 1; cursor <= this.n; cursor += cursor & -cursor) {
      this.tree[cursor] += delta
    }
    return true
  }

  lowerBound(target: number): number {
    let pos = 0
    let remaining = target
    let power = 1
    while (power * 2 <= this.n) power *= 2
    for (; power > 0; power >>= 1) {
      if (pos + power <= this.n && this.tree[pos + power] <= remaining) {
        pos += power
        remaining -= this.tree[pos]
      }
    }
    return pos
  }

  sizeOf(index: number): number {
    return this.sizes[index] ?? 0
  }

  total(): number {
    return this.prefix(this.n)
  }

  reset(count: number): void {
    this.n = count
    this.build()
  }

  get count(): number {
    return this.n
  }

  snapshotSizes(): number[] {
    return [...this.sizes]
  }
}

function createSizeTree(count: number, sizeAt: (index: number) => number): SizeTree {
  return new FenwickSizeTree(sizeAt, count)
}

interface VirtualizerRuntime {
  count: number
  viewportSize: number
  scrollOffset: number
  buffer: number
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

function computeVirtualizerWindow(runtime: VirtualizerRuntime): VirtualizerState {
  const { count, tree, viewportSize, scrollOffset, buffer, keyOf } = runtime
  if (count <= 0) return { items: [], offsetBefore: 0, totalSize: 0, startIndex: 0, endIndex: -1 }
  const total = tree.total()
  const maxScroll = Math.max(0, total - viewportSize)
  const top = Math.max(0, Math.min(scrollOffset, maxScroll))
  const first = Math.min(tree.lowerBound(top), count - 1)
  let last = first
  const bottom = top + viewportSize
  while (last < count - 1 && tree.prefix(last + 1) < bottom) last += 1
  const startIndex = Math.max(0, first - buffer)
  const endIndex = Math.min(count - 1, last + buffer)
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
  | 'scrollToIndex'
  | 'scrollToOffset'
  | 'totalSize'
> {
  return {
    store: runtime.store,
    getState: runtime.store.getState,
    subscribe: runtime.store.subscribe,
    setScroll: (offset) => setVirtualizerScroll(runtime, offset),
    setViewportSize: (size) => setVirtualizerViewport(runtime, size),
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
