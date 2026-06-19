import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import { createVirtualizer, type Virtualizer, type VirtualizerState } from '@iris-ui/core'

export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

export interface IrisVirtualScrollExposed {
  /** Programmatically scroll so the item at `index` is visible. */
  scrollToIndex: (index: number, align?: IrisVirtualScrollAlign) => void
  /** Imperatively scroll to a pixel offset (clamped to the scrollable range). */
  scrollToOffset: (offset: number) => void
  /** Force-recompute the visible range (e.g. after resizing externally). */
  refresh: () => void
}

/**
 * Virtual scroller. Renders only the visible window of items plus a
 * configurable buffer above and below, so lists of 10k+ rows stay smooth.
 *
 * The container is `overflow: auto` with explicit height; an inner spacer
 * is sized to the full virtual height, and each visible item is absolutely
 * positioned at its natural Y offset. Scroll events are throttled with
 * `requestAnimationFrame` to avoid layout thrash. `itemHeight` may be a fixed
 * number, a `(index) => px` function for variable-height rows, or `'auto'` to
 * measure rendered rows via `ResizeObserver`.
 *
 * Internally driven by the stateful core {@link createVirtualizer}: one
 * controller owns the measured-size cache (keyed by item, so a row's real
 * height survives scroll/reorder), the offset tree (O(log n) total/offset/
 * lower-bound — no O(n) rebuild per scroll), and `scrollToIndex`/`scrollToOffset`.
 * At a uniform `itemHeight` the visible window is identical to the bare math, so
 * the public props/output are unchanged.
 *
 * **Limitations (intentional in this iteration)**:
 *   - Vertical only (no horizontal virtualization).
 *   - Items must be addressable by stable index (`items[index]`).
 *
 * @example
 *   <IrisVirtualScroll :items="rows" :item-height="40" :height="400">
 *     <template #item="{ item, index }">
 *       Row #{{ index }} — {{ item.name }}
 *     </template>
 *   </IrisVirtualScroll>
 */
export const IrisVirtualScroll = defineComponent({
  name: 'IrisVirtualScroll',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<readonly unknown[]>, required: true },
    /**
     * Per-item height in px (fixed), a `(index) => px` function for known
     * variable heights, or `'auto'` to measure rendered rows via
     * `ResizeObserver` and cache them (wrapped text, expandable rows).
     */
    itemHeight: {
      type: [Number, Function, String] as PropType<number | ((index: number) => number) | 'auto'>,
      required: true,
    },
    /** Initial row-height estimate before measurement, when `item-height="auto"`. */
    estimatedItemHeight: { type: Number, default: 40 },
    /** Viewport height. Number → px; string → CSS length passed through. */
    height: { type: [Number, String], default: 400 },
    /** Number of extra rows to render above and below the viewport. */
    buffer: { type: Number, default: 4 },
    /** Optional `keyOf` lookup so DOM reuse keys are stable across reorders. */
    keyOf: {
      type: Function as PropType<(item: unknown, index: number) => string | number>,
      default: undefined,
    },
  },
  emits: {
    scroll: (_scrollTop: number) => true,
    rangeChange: (_range: { start: number; end: number }) => true,
  },
  setup(props, { slots, attrs, emit, expose }) {
    const viewportRef = ref<HTMLElement | null>(null)
    const scrollTop = ref(0)
    const viewportHeight = ref(typeof props.height === 'number' ? props.height : 0)
    let rafId: number | null = null

    const auto = computed(() => props.itemHeight === 'auto')
    const userFn = computed<((index: number) => number) | null>(() =>
      typeof props.itemHeight === 'function' ? props.itemHeight : null,
    )
    const fixedHeight = computed(() =>
      typeof props.itemHeight === 'number' ? props.itemHeight : 0,
    )
    // Variable when sizing comes from a user fn or `auto` measurement; for a
    // plain number the window uses the closed-form fixed formula below.
    const variable = computed(() => userFn.value !== null || auto.value)

    // Auto mode: measured row heights cached by index; bumping `measureVersion`
    // recomputes offsets after a measurement changes (semantics preserved; the
    // virtualizer's keyed cache is fed from this).
    const measuredHeights = new Map<number, number>()
    const measureVersion = ref(0)

    // estimateSize source of truth, read by the virtualizer per index. Reads
    // live `props`, so the controller never needs recreating on a closure swap.
    const estimateSize = (index: number): number => {
      const fn = userFn.value
      if (fn) return fn(index)
      if (auto.value) return measuredHeights.get(index) ?? props.estimatedItemHeight
      return fixedHeight.value
    }

    // One stateful controller, rebuilt only when count or sizing MODE changes.
    // Sizing CHANGES within a mode (a new user fn / a measurement) are pushed via
    // remeasure below — recreating on every change would drop scroll state.
    // `estimateSize` / `getItemKey` read live `props`, so a fresh closure /
    // estimate / keyOf never busts this.
    const buildVirtualizer = (): Virtualizer =>
      createVirtualizer({
        count: props.items.length,
        estimateSize: (index: number) => estimateSize(index),
        getItemKey: (index: number) => {
          const fn = props.keyOf
          const it = props.items[index]
          return fn && it !== undefined ? fn(it, index) : index
        },
        buffer: props.buffer,
        viewportSize: typeof props.height === 'number' ? props.height : 0,
      })

    const virtualizer = shallowRef<Virtualizer>(buildVirtualizer())
    const vstate = shallowRef<VirtualizerState>(virtualizer.value.getState())
    let unsubscribe: (() => void) | null = virtualizer.value.subscribe((s) => {
      vstate.value = s
    })

    // Wire/rewire the controller: subscribe its store into `vstate` and push the
    // current live scroll + viewport so the new instance reflects reality.
    const wire = (v: Virtualizer): void => {
      unsubscribe?.()
      virtualizer.value = v
      vstate.value = v.getState()
      unsubscribe = v.subscribe((s) => {
        vstate.value = s
      })
      v.setViewportSize(viewportHeight.value)
      v.setScroll(scrollTop.value)
    }

    // Rebuild only on count / buffer / sizing-mode change (mirrors the React memo
    // key `[items.length, buffer, variable]`). Sizing changes within a mode go
    // through remeasure below, preserving scroll + cache.
    watch([() => props.items.length, () => props.buffer, variable], () => wire(buildVirtualizer()))

    // Push sizing changes (new user fn, a fresh measurement, or estimate change)
    // into the controller without recreating it: drop the cache + rebuild the
    // tree from the current `estimateSize`. Cheap; runs only when sizing changes.
    watch(
      [userFn, measureVersion, () => props.estimatedItemHeight],
      () => {
        if (variable.value) virtualizer.value.remeasure()
      },
      { flush: 'post' },
    )

    // Drive the controller's scroll + viewport from local state so its window,
    // total size, and offsets reflect the live scroll position. A no-op when
    // unchanged.
    watch([scrollTop, viewportHeight], ([st, vh]) => {
      virtualizer.value.setViewportSize(vh)
      virtualizer.value.setScroll(st)
    })

    const totalHeight = computed(() => vstate.value.totalSize)
    // Offset/size of a single index, sourced from the controller's windowed
    // items (the render loop only ever asks for in-window indices). For the
    // common fixed case this is the same `i * height` arithmetic.
    const itemInState = (i: number) => vstate.value.items.find((it) => it.index === i)
    const offsetOf = (i: number): number =>
      variable.value ? (itemInState(i)?.start ?? i * estimateSize(i)) : i * fixedHeight.value
    const heightOf = (i: number): number =>
      variable.value ? (itemInState(i)?.size ?? estimateSize(i)) : fixedHeight.value

    // Render window. Fixed: closed-form (preserves the exact uniform-height
    // window). Variable/auto: the controller's measured window (offset-tree walk).
    const range = computed(() => {
      if (variable.value) {
        return { start: vstate.value.startIndex, end: vstate.value.endIndex + 1 }
      }
      const h0 = fixedHeight.value
      const startRaw = Math.floor(scrollTop.value / Math.max(1, h0))
      const visibleCount = h0 <= 0 ? 0 : Math.ceil(viewportHeight.value / h0)
      const start = Math.max(0, startRaw - props.buffer)
      const end = Math.min(props.items.length, startRaw + visibleCount + props.buffer)
      return { start, end }
    })

    watch(range, (next) => emit('rangeChange', next), { flush: 'post' })

    const onScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const el = viewportRef.value
        if (!el) return
        const next = el.scrollTop
        if (next === scrollTop.value) return
        scrollTop.value = next
        emit('scroll', next)
      })
    }

    const measureViewport = () => {
      const el = viewportRef.value
      if (!el) return
      viewportHeight.value = el.clientHeight
    }

    let observer: ResizeObserver | null = null

    // Auto-measurement: one ResizeObserver watches rendered rows; measured
    // heights are cached by index and feed the offset table.
    let rowObserver: ResizeObserver | null = null
    const indexByEl = new WeakMap<Element, number>()
    const elByIndex = new Map<number, HTMLElement>()
    const rowRef = (index: number) => (el: unknown) => {
      const node = (el ?? null) as HTMLElement | null
      const prev = elByIndex.get(index)
      if (prev && prev !== node) {
        rowObserver?.unobserve(prev)
        indexByEl.delete(prev)
        elByIndex.delete(index)
      }
      if (node) {
        elByIndex.set(index, node)
        indexByEl.set(node, index)
        rowObserver?.observe(node)
      }
    }

    onMounted(() => {
      measureViewport()
      if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
        observer = new ResizeObserver(measureViewport)
        observer.observe(viewportRef.value)
      }
      if (auto.value && typeof ResizeObserver !== 'undefined') {
        rowObserver = new ResizeObserver((entries) => {
          let changed = false
          for (const entry of entries) {
            const idx = indexByEl.get(entry.target)
            if (idx === undefined) continue
            const hgt = (entry.target as HTMLElement).offsetHeight
            if (hgt > 0 && measuredHeights.get(idx) !== hgt) {
              measuredHeights.set(idx, hgt)
              changed = true
            }
          }
          if (changed) measureVersion.value += 1
        })
        // Row refs run during mount, before this hook — observe the first window.
        for (const el of elByIndex.values()) rowObserver.observe(el)
      }
    })

    onBeforeUnmount(() => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer?.disconnect()
      observer = null
      rowObserver?.disconnect()
      rowObserver = null
      unsubscribe?.()
      unsubscribe = null
    })

    // Re-clamp scroll if items shrink so the current scrollTop falls past the new totalHeight.
    watch(
      () => props.items.length,
      () => {
        const el = viewportRef.value
        if (!el) return
        const max = Math.max(0, totalHeight.value - viewportHeight.value)
        if (el.scrollTop > max) el.scrollTop = max
      },
      { flush: 'post' },
    )

    const scrollToIndex = (index: number, align: IrisVirtualScrollAlign = 'start') => {
      const el = viewportRef.value
      if (!el) return
      // The controller computes (and clamps to the scrollable range) the target
      // pixel offset; the host scroll element applies it.
      el.scrollTop = virtualizer.value.scrollToIndex(index, align)
    }

    const scrollToOffset = (offset: number) => {
      const el = viewportRef.value
      if (!el) return
      el.scrollTop = virtualizer.value.scrollToOffset(offset)
    }

    const refresh = () => {
      measureViewport()
      onScroll()
    }

    expose({ scrollToIndex, scrollToOffset, refresh } satisfies IrisVirtualScrollExposed)

    const containerStyle = computed<Record<string, string>>(() => ({
      position: 'relative',
      overflow: 'auto',
      height: typeof props.height === 'number' ? `${props.height}px` : String(props.height),
      width: '100%',
      ...((attrs.style as Record<string, string> | undefined) ?? {}),
    }))

    const spacerStyle = computed<Record<string, string>>(() => ({
      position: 'relative',
      height: `${totalHeight.value}px`,
      width: '100%',
    }))

    return () => {
      const { start, end } = range.value
      const visible: VNode[] = []
      for (let i = start; i < end; i++) {
        const item = props.items[i]
        if (item === undefined) continue
        const slotContent = slots.item?.({ item, index: i })
        const key = props.keyOf ? props.keyOf(item, i) : i
        visible.push(
          h(
            'div',
            {
              key,
              ref: auto.value ? rowRef(i) : undefined,
              'data-iris-virtual-item': '',
              'data-iris-virtual-index': i,
              style: {
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                // Auto mode: let content set the height so it can be measured.
                height: auto.value ? undefined : `${heightOf(i)}px`,
                transform: `translateY(${offsetOf(i)}px)`,
              },
            },
            slotContent,
          ),
        )
      }

      return h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            viewportRef.value = (el ?? null) as HTMLElement | null
          },
          'data-iris-virtual-scroll': '',
          onScroll,
          style: containerStyle.value,
        },
        [h('div', { 'data-iris-virtual-spacer': '', style: spacerStyle.value }, visible)],
      )
    }
  },
})
