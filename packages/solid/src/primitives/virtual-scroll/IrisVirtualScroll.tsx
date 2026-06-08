import {
  createEffect,
  createMemo,
  createSignal,
  For,
  mergeProps,
  onCleanup,
  onMount,
  type JSX,
} from 'solid-js'

export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

export interface IrisVirtualScrollProps<T = unknown> {
  items: readonly T[]
  itemHeight: number | ((index: number) => number)
  height?: number | string
  buffer?: number
  /** Optional key resolver for stable DOM reuse. */
  keyOf?: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => JSX.Element
  onScroll?: (scrollTop: number) => void
  onRangeChange?: (range: { start: number; end: number }) => void
  style?: JSX.CSSProperties
}

function buildOffsets(count: number, sizeFn: (i: number) => number): number[] {
  const offsets = new Array<number>(count + 1)
  offsets[0] = 0
  for (let i = 0; i < count; i++) {
    offsets[i + 1] = (offsets[i] ?? 0) + sizeFn(i)
  }
  return offsets
}

/**
 * Virtual scroller. Renders only the visible window of items plus a configurable
 * buffer above and below. Solid port of the Vue IrisVirtualScroll.
 */
export function IrisVirtualScroll<T = unknown>(props: IrisVirtualScrollProps<T>): JSX.Element {
  const merged = mergeProps({ buffer: 4, height: 400 }, props)

  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(
    typeof merged.height === 'number' ? (merged.height as number) : 0,
  )
  let viewportRef: HTMLDivElement | undefined
  let rafId: number | null = null

  const isFixedHeight = (): boolean => typeof merged.itemHeight === 'number'
  const fixedHeight = (): number => (isFixedHeight() ? (merged.itemHeight as number) : 0)
  const sizeFn = (): ((i: number) => number) | null =>
    typeof merged.itemHeight === 'function' ? merged.itemHeight : null

  const offsets = createMemo(() => {
    const fn = sizeFn()
    if (fn) return buildOffsets(merged.items.length, fn)
    return null
  })

  const totalHeight = createMemo(() => {
    const offs = offsets()
    if (offs) return offs[merged.items.length] ?? 0
    return merged.items.length * fixedHeight()
  })

  const offsetOf = (i: number): number => {
    const offs = offsets()
    if (offs) return offs[i] ?? 0
    return i * fixedHeight()
  }

  const heightOf = (i: number): number => {
    const offs = offsets()
    if (offs) return (offs[i + 1] ?? 0) - (offs[i] ?? 0)
    return fixedHeight()
  }

  const range = createMemo(() => {
    const fn = sizeFn()
    const vh = viewportHeight()
    const st = scrollTop()
    if (fn) {
      let start = 0
      const offArr = offsets()
      if (offArr) {
        // Binary search for start
        let lo = 0,
          hi = merged.items.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if ((offArr[mid] ?? 0) <= st) lo = mid + 1
          else hi = mid
        }
        start = Math.max(0, lo - 1 - merged.buffer)
      }
      let end = start
      while (
        end < merged.items.length &&
        (offArr?.[end] ?? 0) < st + vh + merged.buffer * (fn(end) || 40)
      ) {
        end++
      }
      return { start, end: Math.min(merged.items.length, end + merged.buffer) }
    }
    const fh = Math.max(1, fixedHeight())
    const startRaw = Math.floor(st / fh)
    const visibleCount = fh <= 0 ? 0 : Math.ceil(vh / fh)
    return {
      start: Math.max(0, startRaw - merged.buffer),
      end: Math.min(merged.items.length, startRaw + visibleCount + merged.buffer),
    }
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

  onMount(() => {
    const el = viewportRef
    if (!el) return
    setViewportHeight(el.clientHeight)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (el) setViewportHeight(el.clientHeight)
      })
      ro.observe(el)
      onCleanup(() => ro.disconnect())
    }
  })

  onCleanup(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
  })

  // Visible items to render
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
              data-iris-virtual-key={String(entry.key)}
              data-iris-virtual-item=""
              data-iris-virtual-index={entry.index}
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                height: isFixedHeight() ? `${entry.height}px` : undefined,
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
