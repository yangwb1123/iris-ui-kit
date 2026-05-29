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
   * `(index) => px` function for variable heights (wrapped text, expandable
   * rows). Memoize the function so the offset table isn't rebuilt every render.
   */
  itemHeight: number | ((index: number) => number)
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
 * Fixed-height virtual scroller. Renders only the visible window of items
 * plus a configurable buffer above and below. Vertical-only; items must
 * have uniform height.
 */
export const IrisVirtualScroll = React.forwardRef(function IrisVirtualScroll<T>(
  {
    items,
    itemHeight,
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

  const sizeFn = typeof itemHeight === 'function' ? itemHeight : null
  const fixedHeight = typeof itemHeight === 'number' ? itemHeight : 0

  // Variable mode: cumulative offsets (rebuilt when the size fn or count change).
  const offsets = React.useMemo(
    () => (sizeFn ? buildOffsets(items.length, sizeFn) : null),
    [sizeFn, items.length],
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
        data-iris-virtual-item=""
        data-iris-virtual-index={i}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: heightOf(i),
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
