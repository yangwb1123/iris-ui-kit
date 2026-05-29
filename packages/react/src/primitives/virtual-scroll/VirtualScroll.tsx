import * as React from 'react'
import { buildOffsets, computeVirtualRange } from '@iris-ui/core'

export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

export interface IrisVirtualScrollHandle {
  scrollToIndex: (index: number, align?: IrisVirtualScrollAlign) => void
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
 * fixed number or a `(index) => px` function for variable-height rows.
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
  // Auto mode: measured row heights cached by index; `measureVersion` bumps to
  // recompute offsets when a measurement changes.
  const measuredRef = React.useRef<Map<number, number>>(new Map())
  const [measureVersion, setMeasureVersion] = React.useState(0)

  const sizeFn: ((index: number) => number) | null =
    typeof itemHeight === 'function'
      ? itemHeight
      : auto
        ? (index: number) => measuredRef.current.get(index) ?? estimatedItemHeight
        : null
  const fixedHeight = typeof itemHeight === 'number' ? itemHeight : 0

  // Cumulative offsets for variable/auto mode (rebuilt when sizes or count
  // change; in auto mode `measureVersion` triggers the rebuild after a measure).
  const userFn = typeof itemHeight === 'function' ? itemHeight : null
  const offsets = React.useMemo(
    () => (sizeFn ? buildOffsets(items.length, sizeFn) : null),
    [items.length, userFn, auto, measureVersion, estimatedItemHeight],
  )

  const totalHeight = offsets ? offsets[items.length] : items.length * fixedHeight
  const offsetOf = (i: number): number => (offsets ? offsets[i] : i * fixedHeight)
  const heightOf = (i: number): number => (offsets ? offsets[i + 1] - offsets[i] : fixedHeight)

  const range = React.useMemo(() => {
    if (sizeFn) {
      const w = computeVirtualRange({
        itemCount: items.length,
        scrollTop,
        viewportSize: viewportHeight,
        itemSize: sizeFn,
        buffer,
      })
      return { start: w.startIndex, end: w.endIndex + 1 }
    }
    const startRaw = Math.floor(scrollTop / Math.max(1, fixedHeight))
    const visibleCount = fixedHeight <= 0 ? 0 : Math.ceil(viewportHeight / fixedHeight)
    const start = Math.max(0, startRaw - buffer)
    const end = Math.min(items.length, startRaw + visibleCount + buffer)
    return { start, end }
  }, [sizeFn, scrollTop, viewportHeight, fixedHeight, buffer, items.length])

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
      const clamped = Math.max(0, Math.min(items.length - 1, index))
      const itemTop = offsets ? offsets[clamped] : clamped * fixedHeight
      const itemH = offsets ? offsets[clamped + 1] - offsets[clamped] : fixedHeight
      let target = itemTop
      if (align === 'center') {
        target = itemTop - viewportHeight / 2 + itemH / 2
      } else if (align === 'end') {
        target = itemTop - viewportHeight + itemH
      }
      el.scrollTop = Math.max(0, target)
    },
    [items.length, fixedHeight, offsets, viewportHeight],
  )

  const refresh = React.useCallback(() => {
    measureViewport()
    handleScroll()
  }, [measureViewport])

  React.useImperativeHandle(forwardedRef, () => ({ scrollToIndex, refresh }), [
    scrollToIndex,
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
