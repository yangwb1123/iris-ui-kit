<script lang="ts" module>
  export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

  /** Imperative handle exposed via the component instance (bind:this). */
  export interface IrisVirtualScrollHandle {
    scrollToIndex: (index: number, align?: IrisVirtualScrollAlign) => void
    /** Imperatively scroll to a pixel offset (clamped to the scrollable range). */
    scrollToOffset: (offset: number) => void
    refresh: () => void
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->

<script lang="ts">
  import { untrack } from 'svelte'
  import { createVirtualizer, type Virtualizer, type VirtualizerState } from '@iris-ui-kit/core'

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
    keyOf,
    onScroll,
    onRangeChange,
    item: itemSnippet,
    style,
    ...rest
  }: Props = $props()

  let viewportEl = $state<HTMLElement | undefined>(undefined)
  let scrollTopState = $state(0)
  let viewportHeightState = $state(untrack(() => (typeof height === 'number' ? height : 0)))
  let rafId: number | null = null

  const isAuto = $derived(itemHeight === 'auto')
  const userFn = $derived(typeof itemHeight === 'function' ? itemHeight : null)
  const fixedHeight = $derived(typeof itemHeight === 'number' ? itemHeight : 0)
  // Variable when sizing comes from a user fn or `auto` measurement; for a plain
  // number the window uses the closed-form fixed formula below.
  const variable = $derived(userFn !== null || isAuto)

  // Auto mode: measured row heights cached by index. `measureVersion` bumps to
  // recompute offsets when a measurement changes (the virtualizer's keyed cache
  // is fed from this via remeasure).
  const measuredHeights = new Map<number, number>()
  let measureVersion = $state(0)

  // estimateSize source of truth, read by the virtualizer per index. Read through
  // a ref-like (non-reactive) closure so the controller's memo isn't busted when
  // an inline `itemHeight`/`estimatedItemHeight` identity changes.
  function estimateSize(index: number): number {
    const fn = userFn
    if (fn) return fn(index)
    if (isAuto) return measuredHeights.get(index) ?? estimatedItemHeight
    return fixedHeight
  }

  // Live inputs read by the controller's config closures (refs) — reassigned on
  // every render so the closures captured at create time always see fresh values
  // without recreating the controller (recreating would reset scroll + cache).
  let estimateRef: (index: number) => number = () => 40
  let keyOfRef: Props['keyOf'] = undefined
  let itemsRef: readonly unknown[] = []
  $effect(() => {
    estimateRef = estimateSize
    keyOfRef = keyOf
    itemsRef = items
    // Re-seat cached measurements against live item keys even when the item
    // count stays the same (reorder/filter is otherwise invisible to the memo
    // key that intentionally preserves this controller).
    virtualizer.setCount(items.length)
  })

  // One stateful controller, rebuilt only when count or sizing MODE changes.
  // Sizing CHANGES within a mode (a new user fn / a measurement) are pushed via
  // remeasure below; recreating on every render would drop scroll state. We track
  // the memo key manually (Svelte $derived can't "rebuild only on key change").
  let virtualizer: Virtualizer
  let memoKey = ''
  let vstate = $state<VirtualizerState>(
    // seeded synchronously below; placeholder satisfies the initializer.
    { items: [], offsetBefore: 0, totalSize: 0, startIndex: 0, endIndex: -1 },
  )
  let unsubscribe: (() => void) | null = null

  function buildVirtualizer(): void {
    unsubscribe?.()
    virtualizer = createVirtualizer({
      count: itemsRef.length,
      estimateSize: (index: number) => estimateRef(index),
      getItemKey: (index: number) => {
        const fn = keyOfRef
        const it = itemsRef[index]
        return fn && it !== undefined ? fn(it, index) : index
      },
      buffer,
      viewportSize: viewportHeightState,
    })
    vstate = virtualizer.getState()
    unsubscribe = virtualizer.subscribe((s) => {
      vstate = s
    })
  }

  // Build synchronously on first run so the initial render has a real controller.
  // `itemsRef`/`estimateRef`/`keyOfRef` are assigned to their props above before
  // this runs (module-eval order), so the seed reads correct values.
  untrack(() => {
    estimateRef = estimateSize
    keyOfRef = keyOf
    itemsRef = items
    memoKey = `${items.length}|${buffer}|${variable}`
    buildVirtualizer()
  })

  // Rebuild ONLY when the memo key (count / buffer / sizing-mode) changes.
  $effect(() => {
    const nextKey = `${items.length}|${buffer}|${variable}`
    if (nextKey !== memoKey) {
      memoKey = nextKey
      buildVirtualizer()
    }
  })

  // Cleanup the live subscription on destroy.
  $effect(() => () => {
    unsubscribe?.()
    unsubscribe = null
  })

  // Push sizing changes (new user fn, a fresh measurement, or estimate change)
  // into the controller without recreating it: drop the cache + rebuild the tree
  // from the current `estimateSize`. Cheap; runs only when sizing changes.
  $effect(() => {
    void userFn
    void measureVersion
    void estimatedItemHeight
    if (variable) virtualizer.remeasure()
  })

  // Drive the controller's scroll + viewport from local state so its window,
  // total size, and offsets reflect the live scroll position. A no-op when
  // unchanged (the controller short-circuits equal values).
  $effect(() => {
    virtualizer.setViewportSize(viewportHeightState)
    virtualizer.setScroll(scrollTopState)
  })

  const totalHeight = $derived(vstate.totalSize)

  // Offset/size of a single in-window index, sourced from the controller's
  // windowed items (the render loop only ever asks for in-window indices). For
  // the common fixed case this is the same `i * height` arithmetic.
  function itemInState(i: number): VirtualizerState['items'][number] | undefined {
    return vstate.items.find((it) => it.index === i)
  }
  function offsetOf(i: number): number {
    return variable ? (itemInState(i)?.start ?? i * estimateRef(i)) : i * fixedHeight
  }
  function heightOf(i: number): number {
    return variable ? (itemInState(i)?.size ?? estimateRef(i)) : fixedHeight
  }

  // Render window. Fixed: closed-form (preserves the exact uniform-height
  // window). Variable/auto: the controller's measured window (offset-tree walk).
  const range = $derived((): { start: number; end: number } => {
    if (variable) return { start: vstate.startIndex, end: vstate.endIndex + 1 }
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
    const measured = el.clientHeight
    // jsdom and hidden/pre-layout containers report 0. Preserve a numeric
    // configured height in that case so the initial and rerendered window stay
    // useful; a real non-zero measurement always wins.
    viewportHeightState = measured || (typeof height === 'number' ? height : 0)
  }

  // A numeric height is also the viewport contract before layout and remains
  // reactive when ResizeObserver is unavailable.
  $effect(() => {
    if (typeof height === 'number' && (!viewportEl || viewportEl.clientHeight === 0)) {
      viewportHeightState = height
    }
  })

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

  // Auto-measurement: one ResizeObserver watches the rendered rows; each row's
  // measured height is cached by index and feeds the offset table (via the
  // remeasure effect above, keyed on measureVersion).
  let rowObserver: ResizeObserver | null = null
  const indexByEl = new WeakMap<Element, number>()
  const elByIndex = new Map<number, HTMLElement>()

  $effect(() => {
    if (!isAuto || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const idx = indexByEl.get(entry.target)
        if (idx === undefined) continue
        const h = (entry.target as HTMLElement).offsetHeight
        if (h > 0 && measuredHeights.get(idx) !== h) {
          measuredHeights.set(idx, h)
          changed = true
        }
      }
      if (changed) measureVersion += 1
    })
    rowObserver = ro
    // Rows registered by the `setRow` action before this effect runs are already
    // tracked but not yet observed — observe them now.
    for (const el of elByIndex.values()) ro.observe(el)
    return () => {
      ro.disconnect()
      rowObserver = null
    }
  })

  // Per-row action (auto mode only): (un)observe + track its index so its
  // measured height feeds the offset tree. Inert when `index < 0` (the sentinel
  // passed in non-auto mode), mirroring React's `ref={auto ? measureRef : undefined}`.
  function setRow(
    node: HTMLElement,
    index: number,
  ): { update: (i: number) => void; destroy: () => void } {
    function attach(i: number): void {
      if (i < 0) return
      const prev = indexByEl.get(node)
      if (prev !== undefined && prev !== i) {
        rowObserver?.unobserve(node)
        elByIndex.delete(prev)
      }
      elByIndex.set(i, node)
      indexByEl.set(node, i)
      rowObserver?.observe(node)
    }
    function detach(): void {
      const prev = indexByEl.get(node)
      rowObserver?.unobserve(node)
      indexByEl.delete(node)
      if (prev !== undefined) elByIndex.delete(prev)
    }
    attach(index)
    return {
      update: attach,
      destroy: detach,
    }
  }

  // Re-clamp scroll if items shrink past the visible region.
  $effect(() => {
    void totalHeight
    void items.length
    const el = viewportEl
    if (!el) return
    const max = Math.max(0, totalHeight - viewportHeightState)
    if (el.scrollTop > max) el.scrollTop = max
  })

  function setViewport(node: HTMLElement): { destroy: () => void } {
    viewportEl = node
    return {
      destroy: () => {
        viewportEl = undefined
      },
    }
  }

  const heightStyle = $derived(typeof height === 'number' ? `${height}px` : String(height))

  // ---- Imperative handle (exported; read via bind:this on the component) ----
  // The controller computes (and clamps to the scrollable range) the target
  // pixel offset; the host scroll element applies it.
  export function scrollToIndex(index: number, align: IrisVirtualScrollAlign = 'start'): void {
    const el = viewportEl
    if (!el) return
    el.scrollTop = virtualizer.scrollToIndex(index, align)
  }
  export function scrollToOffset(offset: number): void {
    const el = viewportEl
    if (!el) return
    el.scrollTop = virtualizer.scrollToOffset(offset)
  }
  export function refresh(): void {
    measureViewport()
    handleScroll()
  }
</script>

<div
  {...rest}
  use:setViewport
  data-iris-virtual-scroll
  onscroll={handleScroll}
  style="position: relative; overflow: auto; height: {heightStyle}; width: 100%;{style
    ? ' ' + style
    : ''}"
>
  <div data-iris-virtual-spacer style="position: relative; height: {totalHeight}px; width: 100%">
    {#each { length: range().end - range().start } as _, i}
      {@const idx = range().start + i}
      {@const item = items[idx]}
      {#if item !== undefined}
        <div
          use:setRow={isAuto ? idx : -1}
          data-iris-virtual-item
          data-iris-virtual-index={idx}
          style="position: absolute; top: 0; left: 0; right: 0; {isAuto
            ? ''
            : `height: ${heightOf(idx)}px;`} transform: translateY({offsetOf(idx)}px)"
        >
          {#if itemSnippet}
            {@render itemSnippet({ item, index: idx })}
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>
