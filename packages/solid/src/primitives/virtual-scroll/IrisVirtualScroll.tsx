import {
  createEffect,
  createMemo,
  createSignal,
  For,
  mergeProps,
  onCleanup,
  onMount,
  splitProps,
  untrack,
  type JSX,
} from 'solid-js'
import { createVirtualizer, type Virtualizer } from '@iris-ui-kit/core'

export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

export interface IrisVirtualScrollHandle {
  scrollToIndex: (index: number, align?: IrisVirtualScrollAlign) => void
  /** Imperatively scroll to a pixel offset (clamped to the scrollable range). */
  scrollToOffset: (offset: number) => void
  refresh: () => void
}

export interface IrisVirtualScrollProps<T = unknown> {
  items: readonly T[]
  /**
   * Per-item height in px. A number means every row shares that height; pass a
   * `(index) => px` function for known variable heights; or `'auto'` to measure
   * rendered rows via `ResizeObserver` and cache them — no need to know heights
   * ahead of time (wrapped text, expandable rows).
   */
  itemHeight: number | ((index: number) => number) | 'auto'
  /** Initial row-height estimate used before measurement, when `itemHeight="auto"`. */
  estimatedItemHeight?: number
  /** Viewport height. Number → px; string → CSS length passed through. */
  height?: number | string
  /** Number of extra rows to render above and below the viewport. */
  buffer?: number
  /** Optional key resolver for stable DOM reuse. Falls back to index. */
  keyOf?: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => JSX.Element
  onScroll?: (scrollTop: number) => void
  onRangeChange?: (range: { start: number; end: number }) => void
  style?: JSX.CSSProperties
  /** Imperative handle setter (parity with the React `ref`). */
  ref?: (handle: IrisVirtualScrollHandle) => void
  /** Additional attributes (e.g. `role`, `data-*`) forwarded to the scroll container. */
  [key: string]: unknown
}

/**
 * Virtual scroller. Renders only the visible window of items plus a configurable
 * buffer above and below. Vertical-only. `itemHeight` may be a fixed number, a
 * `(index) => px` function for variable-height rows, or `'auto'` to measure
 * rendered rows.
 *
 * Internally driven by the stateful core {@link createVirtualizer}: a single
 * controller owns the measured-size cache (keyed by item, so a row's real height
 * survives scroll/reorder), the offset tree (O(log n) total/offset/lower-bound —
 * no O(n) rebuild per scroll), and `scrollToIndex`/`scrollToOffset`. At a uniform
 * `itemHeight` the visible window is identical to the bare math, so the public
 * props/output are unchanged. Solid mirror of the React IrisVirtualScroll.
 */
export function IrisVirtualScroll<T = unknown>(props: IrisVirtualScrollProps<T>): JSX.Element {
  const merged = mergeProps({ buffer: 4, height: 400, estimatedItemHeight: 40 }, props)

  // Extra attributes (role, data-*, …) forwarded to the scroll container.
  const [, rest] = splitProps(merged, [
    'items',
    'itemHeight',
    'estimatedItemHeight',
    'height',
    'buffer',
    'keyOf',
    'renderItem',
    'onScroll',
    'onRangeChange',
    'style',
    'ref',
  ])

  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(
    typeof merged.height === 'number' ? (merged.height as number) : 0,
  )
  let viewportRef: HTMLDivElement | undefined
  let rafId: number | null = null

  const auto = (): boolean => merged.itemHeight === 'auto'
  const userFn = (): ((index: number) => number) | null =>
    typeof merged.itemHeight === 'function' ? merged.itemHeight : null
  const fixedHeight = (): number => (typeof merged.itemHeight === 'number' ? merged.itemHeight : 0)
  // Variable when sizing comes from a user fn or `auto` measurement; for a plain
  // number the window uses the closed-form fixed formula below.
  const variable = (): boolean => userFn() !== null || auto()

  // Auto mode: measured row heights cached by index. `measureVersion` bumps to
  // recompute offsets when a measurement changes (the virtualizer's keyed cache
  // is fed from this).
  const measured = new Map<number, number>()
  const [measureVersion, setMeasureVersion] = createSignal(0)

  // Live inputs read by the controller THROUGH plain (non-reactive) refs so the
  // controller memo's identity is never busted by a new closure / item array —
  // recreating it would reset scroll + cache. These are kept current via the
  // effect below.
  let itemsRef = merged.items
  let keyOfRef = merged.keyOf
  let estimateRef = (index: number): number => {
    if (userFn()) return userFn()!(index)
    if (auto()) return measured.get(index) ?? merged.estimatedItemHeight
    return fixedHeight()
  }
  createEffect(() => {
    // Track the reactive props so the refs stay current; the controller reads
    // them lazily (not reactively) through these mutable bindings.
    itemsRef = merged.items
    keyOfRef = merged.keyOf
    // estimateRef closes over reactive getters, but reassigning each render keeps
    // it consistent with the current sizing mode (so a remeasure rebuilds right).
    void merged.itemHeight
    void merged.estimatedItemHeight
    void measureVersion()
    estimateRef = (index: number): number => {
      if (userFn()) return userFn()!(index)
      if (auto()) return measured.get(index) ?? merged.estimatedItemHeight
      return fixedHeight()
    }
  })

  // One stateful controller, rebuilt only when count or sizing MODE changes.
  // Sizing CHANGES within a mode (a new user fn / a measurement) are pushed via
  // remeasure below — recreating on every change would drop scroll state. The
  // memo tracks ONLY count / buffer / variable; everything else is read untracked
  // through the refs above.
  const virtualizer = createMemo<Virtualizer>(() => {
    const count = merged.items.length
    const buffer = merged.buffer
    void variable()
    return untrack(() =>
      createVirtualizer({
        count,
        estimateSize: (index: number) => estimateRef(index),
        getItemKey: (index: number) => {
          const fn = keyOfRef
          const it = itemsRef[index]
          return fn && it !== undefined ? fn(it, index) : index
        },
        buffer,
        viewportSize: typeof merged.height === 'number' ? (merged.height as number) : 0,
      }),
    )
  })

  // Push sizing changes (new user fn, a fresh measurement, or estimate change)
  // into the controller without recreating it: drop the cache + rebuild the tree
  // from the current `estimateSize`. Cheap; runs only when sizing changes.
  createEffect(() => {
    void merged.itemHeight
    void measureVersion()
    void merged.estimatedItemHeight
    const v = virtualizer()
    if (variable()) v.remeasure()
  })

  // Drive the controller's scroll + viewport from local signals so its window,
  // total size, and offsets reflect the live scroll position. A no-op when
  // unchanged.
  createEffect(() => {
    const v = virtualizer()
    v.setViewportSize(viewportHeight())
    v.setScroll(scrollTop())
  })

  // Bridge the controller's external store into Solid reactivity (its store is
  // the same one Button/Dialog use; this is the only adapter glue). Re-subscribe
  // whenever the controller instance changes (count / buffer / sizing-mode), with
  // cleanup of the prior subscription.
  const [vstate, setVstate] = createSignal(untrack(virtualizer).getState())
  createEffect(() => {
    const v = virtualizer()
    setVstate(() => v.getState())
    const unsubscribe = v.subscribe((next) => setVstate(() => next))
    onCleanup(unsubscribe)
  })

  const totalHeight = (): number => vstate().totalSize
  // Offset/size of a single index, sourced from the controller's windowed items
  // (the render loop only ever asks for in-window indices). For the common fixed
  // case this is the same `i * height` arithmetic.
  const itemInState = (i: number) => vstate().items.find((it) => it.index === i)
  const offsetOf = (i: number): number =>
    variable() ? (itemInState(i)?.start ?? i * estimateRef(i)) : i * fixedHeight()
  const heightOf = (i: number): number =>
    variable() ? (itemInState(i)?.size ?? estimateRef(i)) : fixedHeight()

  // Render window. Fixed: closed-form (preserves the exact uniform-height
  // window). Variable/auto: the controller's measured window (offset-tree walk).
  const range = createMemo(() => {
    if (variable()) {
      const s = vstate()
      return { start: s.startIndex, end: s.endIndex + 1 }
    }
    const fh = fixedHeight()
    const st = scrollTop()
    const vh = viewportHeight()
    const startRaw = Math.floor(st / Math.max(1, fh))
    const visibleCount = fh <= 0 ? 0 : Math.ceil(vh / fh)
    const start = Math.max(0, startRaw - merged.buffer)
    const end = Math.min(merged.items.length, startRaw + visibleCount + merged.buffer)
    return { start, end }
  })

  createEffect(() => {
    const r = range()
    merged.onRangeChange?.(r)
  })

  const onScroll = (): void => {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      const el = viewportRef
      if (!el) return
      const next = el.scrollTop
      if (next === scrollTop()) return
      setScrollTop(next)
      merged.onScroll?.(next)
    })
  }

  const measureViewport = (): void => {
    const el = viewportRef
    if (!el) return
    setViewportHeight(el.clientHeight)
  }

  // Auto-measurement: one ResizeObserver watches the rendered rows; each row's
  // measured height is cached by index and feeds the offset table.
  let rowObserver: ResizeObserver | null = null
  const indexByEl = new WeakMap<Element, number>()
  const elByIndex = new Map<number, HTMLElement>()
  const measureRef =
    (index: number) =>
    (el: HTMLElement | null): void => {
      const prev = elByIndex.get(index)
      if (prev && prev !== el) {
        rowObserver?.unobserve(prev)
        indexByEl.delete(prev)
        elByIndex.delete(index)
      }
      if (el) {
        elByIndex.set(index, el)
        indexByEl.set(el, index)
        rowObserver?.observe(el)
      }
    }

  onMount(() => {
    measureViewport()
    const el = viewportRef
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measureViewport)
      ro.observe(el)
      onCleanup(() => ro.disconnect())
    }
    if (auto() && typeof ResizeObserver !== 'undefined') {
      rowObserver = new ResizeObserver((entries) => {
        let changed = false
        for (const entry of entries) {
          const idx = indexByEl.get(entry.target)
          if (idx === undefined) continue
          const h = (entry.target as HTMLElement).offsetHeight
          if (h > 0 && measured.get(idx) !== h) {
            measured.set(idx, h)
            changed = true
          }
        }
        if (changed) setMeasureVersion((v) => v + 1)
      })
      // Row refs run during mount, before this hook — observe the first window.
      for (const node of elByIndex.values()) rowObserver.observe(node)
      onCleanup(() => {
        rowObserver?.disconnect()
        rowObserver = null
      })
    }
  })

  onCleanup(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
  })

  // Re-clamp scroll if items shrink past the visible region.
  createEffect(() => {
    void merged.items.length
    void totalHeight()
    const el = viewportRef
    if (!el) return
    const max = Math.max(0, totalHeight() - viewportHeight())
    if (el.scrollTop > max) el.scrollTop = max
  })

  const scrollToIndex = (index: number, align: IrisVirtualScrollAlign = 'start'): void => {
    const el = viewportRef
    if (!el) return
    // The controller computes (and clamps to the scrollable range) the target
    // pixel offset; the host scroll element applies it.
    el.scrollTop = virtualizer().scrollToIndex(index, align)
  }

  const scrollToOffset = (offset: number): void => {
    const el = viewportRef
    if (!el) return
    el.scrollTop = virtualizer().scrollToOffset(offset)
  }

  const refresh = (): void => {
    measureViewport()
    onScroll()
  }

  // Expose the imperative handle (parity with React's useImperativeHandle).
  props.ref?.({ scrollToIndex, scrollToOffset, refresh })

  // Visible items to render.
  const visibleItems = createMemo(() => {
    const { start, end } = range()
    const visible: Array<{
      item: T
      index: number
      top: number
      height: number
      key: string | number
    }> = []
    for (let i = start; i < end; i++) {
      const item = merged.items[i]
      if (item === undefined) continue
      visible.push({
        item,
        index: i,
        top: offsetOf(i),
        height: heightOf(i),
        key: merged.keyOf ? merged.keyOf(item, i) : i,
      })
    }
    return visible
  })

  return (
    <div
      {...rest}
      ref={viewportRef}
      data-iris-virtual-scroll=""
      onScroll={onScroll}
      style={{
        position: 'relative',
        overflow: 'auto',
        height: typeof merged.height === 'number' ? `${merged.height}px` : String(merged.height),
        width: '100%',
        ...(merged.style ?? {}),
      }}
    >
      <div
        data-iris-virtual-spacer=""
        style={{
          position: 'relative',
          height: `${totalHeight()}px`,
          width: '100%',
        }}
      >
        <For each={visibleItems()}>
          {(entry) => (
            <div
              ref={auto() ? measureRef(entry.index) : undefined}
              data-iris-virtual-key={String(entry.key)}
              data-iris-virtual-item=""
              data-iris-virtual-index={entry.index}
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                // Auto mode: let content determine height so it can be measured.
                height: auto() ? undefined : `${entry.height}px`,
                transform: `translateY(${entry.top}px)`,
              }}
            >
              {merged.renderItem(entry.item, entry.index)}
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
