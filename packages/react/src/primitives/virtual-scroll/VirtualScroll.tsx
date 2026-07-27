import * as React from 'react'
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
   * `(index) => px` function for known variable heights (memoize it); or
   * `'auto'` to measure rendered rows via `ResizeObserver` and cache them —
   * no need to know heights ahead of time (wrapped text, expandable rows).
   */
  itemHeight: number | ((index: number) => number) | 'auto'
  /** Initial row-height estimate used before measurement, when `itemHeight="auto"`. */
  estimatedItemHeight?: number
  /** Viewport height. Number → px; string → CSS length passed through. */
  height?: number | string
  /** Number of extra rows to render above and below the viewport. */
  buffer?: number
  /** Stable key per item. Falls back to index. */
  keyOf?: (item: T, index: number) => string | number
  /** Render a single item. */
  renderItem: (item: T, index: number) => React.ReactNode
  onScroll?: (scrollTop: number) => void
  onRangeChange?: (range: { start: number; end: number }) => void
  style?: React.CSSProperties
  className?: string
}

/**
 * Virtual scroller. Renders only the visible window of items plus a
 * configurable buffer above and below. Vertical-only. `itemHeight` may be a
 * fixed number, a `(index) => px` function for variable-height rows, or
 * `'auto'` to measure rendered rows.
 *
 * Internally driven by the stateful core {@link createVirtualizer}: a single
 * controller owns the measured-size cache (keyed by item, so a row's real
 * height survives scroll/reorder), the offset tree (O(log n) total/offset/
 * lower-bound — no O(n) rebuild per scroll), and `scrollToIndex`/`scrollToOffset`.
 * At a uniform `itemHeight` the visible window is identical to the bare math, so
 * the public props/output are unchanged.
 */
export const IrisVirtualScroll = React.forwardRef(function IrisVirtualScroll<T>(
  {
    items,
    itemHeight,
    estimatedItemHeight = 40,
    height = 400,
    buffer = 4,
    keyOf,
    renderItem,
    onScroll,
    onRangeChange,
    style,
    className,
  }: IrisVirtualScrollProps<T>,
  forwardedRef: React.Ref<IrisVirtualScrollHandle>,
): React.ReactElement {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewportHeight, setViewportHeight] = React.useState(
    typeof height === 'number' ? height : 0,
  )
  const rafRef = React.useRef<number | null>(null)

  const auto = itemHeight === 'auto'
  const userFn = typeof itemHeight === 'function' ? itemHeight : null
  const fixedHeight = typeof itemHeight === 'number' ? itemHeight : 0
  // Variable when sizing comes from a user fn or `auto` measurement; for a
  // plain number the window uses the closed-form fixed formula below.
  const variable = userFn !== null || auto

  // Auto mode: measured row heights cached by index. `measureVersion` bumps to
  // recompute offsets when a measurement changes (keeps the existing semantics;
  // the virtualizer's keyed cache is fed from this).
  const measuredRef = React.useRef<Map<number, number>>(new Map())
  const [measureVersion, setMeasureVersion] = React.useState(0)

  // Items are keyed by position so we can pass a stable getItemKey to the
  // virtualizer (its measured cache survives reorder); `keyOf` is read through
  // a ref to avoid re-creating the controller when an inline closure changes.
  const itemsRef = React.useRef(items)
  itemsRef.current = items
  const keyOfRef = React.useRef(keyOf)
  keyOfRef.current = keyOf

  // estimateSize source of truth, read by the virtualizer per index.
  const estimateSize = React.useCallback(
    (index: number): number => {
      if (userFn) return userFn(index)
      if (auto) return measuredRef.current.get(index) ?? estimatedItemHeight
      return fixedHeight
    },
    [userFn, auto, estimatedItemHeight, fixedHeight],
  )
  const estimateRef = React.useRef(estimateSize)
  estimateRef.current = estimateSize

  // One stateful controller, rebuilt only when count or sizing MODE changes.
  // Sizing CHANGES within a mode (a new user fn / a measurement) are pushed via
  // remeasure below — recreating on every render would drop scroll state.
  const virtualizer = React.useMemo<Virtualizer>(
    () =>
      createVirtualizer({
        count: items.length,
        estimateSize: (index: number) => estimateRef.current(index),
        getItemKey: (index: number) => {
          const fn = keyOfRef.current
          const it = itemsRef.current[index]
          return fn && it !== undefined ? fn(it, index) : index
        },
        buffer,
        viewportSize: typeof height === 'number' ? height : 0,
      }),
    // Keyed on count / buffer / sizing-mode only: sizing CHANGES within a mode
    // are pushed via remeasure below so scroll state survives. `estimateSize` /
    // `getItemKey` / `height` are read live through refs, hence intentionally
    // not deps (recreating would reset the controller's scroll + cache).
    [items.length, buffer, variable],
  )

  // Push sizing changes (new user fn, a fresh measurement, or estimate change)
  // into the controller without recreating it: drop the cache + rebuild the
  // tree from the current `estimateSize`. Cheap; runs only when sizing changes.
  React.useLayoutEffect(() => {
    if (variable) virtualizer.remeasure()
  }, [virtualizer, userFn, measureVersion, estimatedItemHeight, variable])

  // Drive the controller's scroll + viewport from local state so its window,
  // total size, and offsets reflect the live scroll position. Done in a layout
  // effect (not render) so the external store mutation doesn't tear with
  // useSyncExternalStore; a no-op when unchanged.
  React.useLayoutEffect(() => {
    virtualizer.setViewportSize(viewportHeight)
    virtualizer.setScroll(scrollTop)
  }, [virtualizer, viewportHeight, scrollTop])

  const vstate = React.useSyncExternalStore(virtualizer.subscribe, virtualizer.getState)

  const totalHeight = vstate.totalSize
  // Offset/size of a single index, sourced from the controller's windowed
  // items (the render loop only ever asks for in-window indices). For the
  // common fixed case this is the same `i * height` arithmetic.
  const itemInState = (i: number) => vstate.items.find((it) => it.index === i)
  const offsetOf = (i: number): number =>
    variable ? (itemInState(i)?.start ?? i * estimateRef.current(i)) : i * fixedHeight
  const heightOf = (i: number): number =>
    variable ? (itemInState(i)?.size ?? estimateRef.current(i)) : fixedHeight

  // Render window. Fixed: closed-form (preserves the exact uniform-height
  // window). Variable/auto: the controller's measured window (offset-tree walk).
  const range = React.useMemo(() => {
    if (variable) return { start: vstate.startIndex, end: vstate.endIndex + 1 }
    const startRaw = Math.floor(scrollTop / Math.max(1, fixedHeight))
    const visibleCount = fixedHeight <= 0 ? 0 : Math.ceil(viewportHeight / fixedHeight)
    const start = Math.max(0, startRaw - buffer)
    const end = Math.min(items.length, startRaw + visibleCount + buffer)
    return { start, end }
  }, [variable, vstate, scrollTop, viewportHeight, fixedHeight, buffer, items.length])

  // Emit range change without firing onScroll's effect prematurely.
  const rangeRef = React.useRef(range)
  React.useEffect(() => {
    if (rangeRef.current.start !== range.start || rangeRef.current.end !== range.end) {
      rangeRef.current = range
      onRangeChange?.(range)
    }
  }, [range, onRangeChange])

  const handleScroll = () => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = viewportRef.current
      if (!el) return
      const next = el.scrollTop
      setScrollTop((prev) => {
        if (prev === next) return prev
        onScroll?.(next)
        return next
      })
    })
  }

  const measureViewport = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setViewportHeight(el.clientHeight)
  }, [])

  React.useEffect(() => {
    measureViewport()
    if (typeof ResizeObserver === 'undefined') return
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(measureViewport)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measureViewport])

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Auto-measurement: one ResizeObserver watches the rendered rows; each row's
  // measured height is cached by index and feeds the offset table.
  const rowObserverRef = React.useRef<ResizeObserver | null>(null)
  const indexByEl = React.useRef<WeakMap<Element, number>>(new WeakMap())
  const elByIndex = React.useRef<Map<number, HTMLElement>>(new Map())

  React.useEffect(() => {
    if (!auto || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const idx = indexByEl.current.get(entry.target)
        if (idx === undefined) continue
        const h = (entry.target as HTMLElement).offsetHeight
        if (h > 0 && measuredRef.current.get(idx) !== h) {
          measuredRef.current.set(idx, h)
          changed = true
        }
      }
      if (changed) setMeasureVersion((v) => v + 1)
    })
    rowObserverRef.current = ro
    // Row ref-callbacks run during commit, before this passive effect — so the
    // first window of rows is already registered but not yet observed.
    for (const el of elByIndex.current.values()) ro.observe(el)
    return () => {
      ro.disconnect()
      rowObserverRef.current = null
    }
  }, [auto])

  // Ref callback per rendered row (auto mode): (un)observe + track its index.
  const measureRef = (index: number) => (el: HTMLElement | null) => {
    const ro = rowObserverRef.current
    const prev = elByIndex.current.get(index)
    if (prev && prev !== el) {
      ro?.unobserve(prev)
      indexByEl.current.delete(prev)
      elByIndex.current.delete(index)
    }
    if (el) {
      elByIndex.current.set(index, el)
      indexByEl.current.set(el, index)
      ro?.observe(el)
    }
  }

  // Re-clamp scroll if items shrink past the visible region.
  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const max = Math.max(0, totalHeight - viewportHeight)
    if (el.scrollTop > max) el.scrollTop = max
  }, [items.length, totalHeight, viewportHeight])

  const scrollToIndex = React.useCallback(
    (index: number, align: IrisVirtualScrollAlign = 'start') => {
      const el = viewportRef.current
      if (!el) return
      // The controller computes (and clamps to the scrollable range) the target
      // pixel offset; the host scroll element applies it.
      const target = virtualizer.scrollToIndex(index, align)
      el.scrollTop = target
    },
    [virtualizer],
  )

  const scrollToOffset = React.useCallback(
    (offset: number) => {
      const el = viewportRef.current
      if (!el) return
      el.scrollTop = virtualizer.scrollToOffset(offset)
    },
    [virtualizer],
  )

  const refresh = React.useCallback(() => {
    measureViewport()
    handleScroll()
  }, [measureViewport])

  React.useImperativeHandle(forwardedRef, () => ({ scrollToIndex, scrollToOffset, refresh }), [
    scrollToIndex,
    scrollToOffset,
    refresh,
  ])

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'auto',
    height: typeof height === 'number' ? `${height}px` : height,
    width: '100%',
    ...style,
  }

  const visible: React.ReactElement[] = []
  for (let i = range.start; i < range.end; i += 1) {
    const item = items[i]
    if (item === undefined) continue
    const key = keyOf ? keyOf(item, i) : i
    visible.push(
      <div
        key={key}
        ref={auto ? measureRef(i) : undefined}
        data-iris-virtual-item=""
        data-iris-virtual-index={i}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          // Auto mode: let content determine height so it can be measured.
          height: auto ? undefined : heightOf(i),
          transform: `translateY(${offsetOf(i)}px)`,
        }}
      >
        {renderItem(item, i)}
      </div>,
    )
  }

  return (
    <div
      ref={viewportRef}
      data-iris-virtual-scroll=""
      className={className}
      onScroll={handleScroll}
      style={containerStyle}
    >
      <div
        data-iris-virtual-spacer=""
        style={{ position: 'relative', height: totalHeight, width: '100%' }}
      >
        {visible}
      </div>
    </div>
  )
}) as <T>(
  props: IrisVirtualScrollProps<T> & { ref?: React.Ref<IrisVirtualScrollHandle> },
) => React.ReactElement
