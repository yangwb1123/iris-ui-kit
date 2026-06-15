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
   */
  setCount(count: number): void
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
}

/**
 * Fenwick (binary-indexed) tree over per-item sizes: O(log n) point update and
 * prefix-sum (item offset), plus an O(log n) lower-bound to find the item at a
 * pixel offset. This is what makes `measure` and the per-scroll window cheap at
 * 100k rows instead of an O(n) cumulative-offset rebuild.
 */
function createSizeTree(count: number, sizeAt: (index: number) => number) {
  let n = count
  let sizes = new Array<number>(n)
  // 1-indexed Fenwick array; tree[i] covers sizes[i-lowbit(i) .. i-1].
  let tree = new Array<number>(n + 1).fill(0)

  const build = (): void => {
    sizes = new Array<number>(n)
    tree = new Array<number>(n + 1).fill(0)
    for (let i = 0; i < n; i++) {
      const s = Math.max(0, sizeAt(i))
      sizes[i] = s
      tree[i + 1] += s
      const parent = i + 1 + ((i + 1) & -(i + 1) || 0)
      if (parent <= n) tree[parent] += tree[i + 1]
    }
  }
  build()

  /** Sum of sizes[0 .. i-1] = pixel offset of item `i`. */
  const prefix = (i: number): number => {
    let sum = 0
    let x = i
    while (x > 0) {
      sum += tree[x]
      x -= x & -x
    }
    return sum
  }

  /** Set item `i`'s size, patching the tree by the delta. O(log n). */
  const set = (i: number, size: number): boolean => {
    if (i < 0 || i >= n) return false
    const next = Math.max(0, size)
    const delta = next - sizes[i]
    if (delta === 0) return false
    sizes[i] = next
    let x = i + 1
    while (x <= n) {
      tree[x] += delta
      x += x & -x
    }
    return true
  }

  /**
   * Largest index whose cumulative top is <= `target` (the item containing the
   * pixel offset). Binary-lifting over the tree — O(log n), no array scan.
   */
  const lowerBound = (target: number): number => {
    let pos = 0
    let remaining = target
    let pw = 1
    while (pw * 2 <= n) pw *= 2
    for (; pw > 0; pw >>= 1) {
      if (pos + pw <= n && tree[pos + pw] <= remaining) {
        pos += pw
        remaining -= tree[pos]
      }
    }
    return pos // number of whole items before `target` → index containing it
  }

  return {
    prefix,
    set,
    lowerBound,
    sizeOf: (i: number): number => sizes[i] ?? 0,
    total: (): number => prefix(n),
    reset: (nextCount: number): void => {
      n = nextCount
      build()
    },
  }
}

export function createVirtualizer(config: VirtualizerConfig): Virtualizer {
  let count = Math.max(0, config.count)
  let viewportSize = Math.max(0, config.viewportSize ?? 0)
  let scrollOffset = Math.max(0, config.scrollOffset ?? 0)
  const buffer = Math.max(0, Math.floor(config.buffer ?? 0))
  const keyOf = config.getItemKey ?? ((index: number) => index)
  const estimate =
    typeof config.estimateSize === 'function'
      ? config.estimateSize
      : (_index: number) => config.estimateSize as number

  // Measured sizes are keyed (not positional), so they follow a row through
  // reorder/filtering. `sizeAt` is what the size tree reads per position.
  const measured = new Map<string | number, number>()
  const sizeAt = (index: number): number => {
    const m = measured.get(keyOf(index))
    return m !== undefined ? m : Math.max(0, estimate(index))
  }

  const tree = createSizeTree(count, sizeAt)

  const computeWindow = (): VirtualizerState => {
    if (count <= 0) return { items: [], offsetBefore: 0, totalSize: 0, startIndex: 0, endIndex: -1 }
    const total = tree.total()
    const maxScroll = Math.max(0, total - viewportSize)
    const top = Math.max(0, Math.min(scrollOffset, maxScroll))
    const first = Math.min(tree.lowerBound(top), count - 1)
    // Walk to the last item whose top is above the viewport's bottom edge.
    let last = first
    const bottom = top + viewportSize
    while (last < count - 1 && tree.prefix(last + 1) < bottom) last += 1
    const startIndex = Math.max(0, first - buffer)
    const endIndex = Math.min(count - 1, last + buffer)
    const items: VirtualItem[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({ index: i, key: keyOf(i), start: tree.prefix(i), size: tree.sizeOf(i) })
    }
    return { items, offsetBefore: tree.prefix(startIndex), totalSize: total, startIndex, endIndex }
  }

  const store = createStore<VirtualizerState>(computeWindow())
  const sync = (): void => store.setState(computeWindow())

  const clampScroll = (offset: number): number => {
    const maxScroll = Math.max(0, tree.total() - viewportSize)
    return Math.max(0, Math.min(offset, maxScroll))
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    setScroll(offset) {
      const next = clampScroll(offset)
      if (next === scrollOffset) return
      scrollOffset = next
      sync()
    },
    setViewportSize(size) {
      const next = Math.max(0, size)
      if (next === viewportSize) return
      viewportSize = next
      scrollOffset = clampScroll(scrollOffset)
      sync()
    },
    setCount(next) {
      const n = Math.max(0, next)
      if (n === count) {
        // same count, possibly reordered: re-seat measured sizes onto positions.
        tree.reset(n)
      } else {
        count = n
        tree.reset(n)
      }
      scrollOffset = clampScroll(scrollOffset)
      sync()
    },
    measure(index, size) {
      if (index < 0 || index >= count) return
      measured.set(keyOf(index), Math.max(0, size))
      if (tree.set(index, size)) {
        // a size change can shift the clamped scroll bound; re-clamp then emit.
        scrollOffset = clampScroll(scrollOffset)
        sync()
      }
    },
    remeasure() {
      measured.clear()
      tree.reset(count)
      scrollOffset = clampScroll(scrollOffset)
      sync()
    },
    scrollToIndex(index, align = 'start') {
      if (count <= 0) return 0
      const i = Math.max(0, Math.min(index, count - 1))
      const start = tree.prefix(i)
      const size = tree.sizeOf(i)
      let target = start
      if (align === 'center') target = start - (viewportSize - size) / 2
      else if (align === 'end') target = start - viewportSize + size
      const next = clampScroll(target)
      scrollOffset = next
      sync()
      return next
    },
    scrollToOffset(offset) {
      const next = clampScroll(offset)
      scrollOffset = next
      sync()
      return next
    },
    totalSize: () => tree.total(),
  }
}
