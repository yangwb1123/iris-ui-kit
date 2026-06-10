<script lang="ts">
  import { buildOffsets, computeVirtualRange } from '@iris-ui/core'

  export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

  interface Props {
    items: readonly unknown[]
    itemHeight: number | ((index: number) => number) | 'auto'
    estimatedItemHeight?: number
    height?: number | string
    buffer?: number
    keyOf?: (item: unknown, index: number) => string | number
    onScroll?: (scrollTop: number) => void
    onRangeChange?: (range: { start: number; end: number }) => void
    item?: import('svelte').Snippet<[{ item: unknown; index: number }]>
    style?: string
    [key: string]: unknown
  }

  let {
    items,
    itemHeight,
    estimatedItemHeight = 40,
    height = 400,
    buffer = 4,
    keyOf: _keyOf,
    onScroll,
    onRangeChange,
    item: itemSnippet,
    style,
    ...rest
  }: Props = $props()

  let viewportEl = $state<HTMLElement | undefined>(undefined)
  let scrollTopState = $state(0)
  let viewportHeightState = $state(typeof height === 'number' ? height : 0)
  let rafId: number | null = null

  const isAuto = $derived(itemHeight === 'auto')
  const measuredHeights = new Map<number, number>()
  let measureVersion = $state(0)

  const sizeFn = $derived((): ((index: number) => number) | null => {
    if (typeof itemHeight === 'function') return itemHeight
    if (isAuto) {
      void measureVersion // track reactivity
      return (index: number) => measuredHeights.get(index) ?? estimatedItemHeight
    }
    return null
  })

  const fixedHeight = $derived(sizeFn() ? 0 : (itemHeight as number))
  const offsets = $derived(sizeFn() ? buildOffsets(items.length, sizeFn()!) : null)
  const totalHeight = $derived(
    offsets ? offsets[items.length] ?? 0 : items.length * fixedHeight
  )

  function offsetOf(i: number): number {
    return offsets ? (offsets[i] ?? 0) : i * fixedHeight
  }
  function heightOf(i: number): number {
    return offsets ? ((offsets[i + 1] ?? 0) - (offsets[i] ?? 0)) : fixedHeight
  }

  const range = $derived((): { start: number; end: number } => {
    const fn = sizeFn()
    if (fn) {
      const w = computeVirtualRange({
        itemCount: items.length,
        scrollTop: scrollTopState,
        viewportSize: viewportHeightState,
        itemSize: fn,
        // Reuse the memoized offsets so each scroll binary-searches the cached
        // array instead of rebuilding all offsets O(n).
        offsets: offsets ?? undefined,
        buffer,
      })
      return { start: w.startIndex, end: w.endIndex + 1 }
    }
    const startRaw = Math.floor(scrollTopState / Math.max(1, fixedHeight))
    const visibleCount = fixedHeight <= 0 ? 0 : Math.ceil(viewportHeightState / fixedHeight)
    const start = Math.max(0, startRaw - buffer)
    const end = Math.min(items.length, startRaw + visibleCount + buffer)
    return { start, end }
  })

  $effect(() => {
    onRangeChange?.(range())
  })

  function handleScroll(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      const el = viewportEl
      if (!el) return
      const next = el.scrollTop
      if (next === scrollTopState) return
      scrollTopState = next
      onScroll?.(next)
    })
  }

  function measureViewport(): void {
    const el = viewportEl
    if (!el) return
    viewportHeightState = el.clientHeight
  }

  let resizeObserver: ResizeObserver | null = null

  $effect(() => {
    const el = viewportEl
    if (!el) return
    measureViewport()
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measureViewport)
      resizeObserver.observe(el)
    }
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      resizeObserver = null
    }
  })

  function setViewport(node: HTMLElement): { destroy: () => void } {
    viewportEl = node
    return { destroy: () => { viewportEl = undefined } }
  }

  const heightStyle = $derived(typeof height === 'number' ? `${height}px` : String(height))
</script>

<div
  {...rest}
  use:setViewport
  data-iris-virtual-scroll
  onscroll={handleScroll}
  style="position: relative; overflow: auto; height: {heightStyle}; width: 100%;{style ? ' ' + style : ''}"
>
  <div
    data-iris-virtual-spacer
    style="position: relative; height: {totalHeight}px; width: 100%"
  >
    {#each { length: range().end - range().start } as _, i}
      {@const idx = range().start + i}
      {@const item = items[idx]}
      {#if item !== undefined}
        <div
          data-iris-virtual-item
          data-iris-virtual-index={idx}
          style="position: absolute; top: 0; left: 0; right: 0; {isAuto ? '' : `height: ${heightOf(idx)}px;`} transform: translateY({offsetOf(idx)}px)"
        >
          {#if itemSnippet}
            {@render itemSnippet({ item, index: idx })}
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>
