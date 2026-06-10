import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import { buildOffsets, computeVirtualRange } from '@iris-ui/core'

export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

export interface IrisVirtualScrollExposed {
  /** Programmatically scroll so the item at `index` is visible. */
  scrollToIndex: (index: number, align?: IrisVirtualScrollAlign) => void
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
 * number or a `(index) => px` function for variable-height rows.
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
    // Auto mode: measured row heights cached by index; bumping `measureVersion`
    // recomputes the offsets/range after a measurement changes.
    const measuredHeights = new Map<number, number>()
    const measureVersion = ref(0)

    const sizeFn = computed<((index: number) => number) | null>(() => {
      if (typeof props.itemHeight === 'function') return props.itemHeight
      if (auto.value) {
        void measureVersion.value // track so offsets recompute after a measure
        return (index: number) => measuredHeights.get(index) ?? props.estimatedItemHeight
      }
      return null
    })
    const fixedHeight = computed(() => (sizeFn.value ? 0 : (props.itemHeight as number)))
    const offsets = computed(() =>
      sizeFn.value ? buildOffsets(props.items.length, sizeFn.value) : null,
    )
    const totalHeight = computed(() =>
      offsets.value ? offsets.value[props.items.length] : props.items.length * fixedHeight.value,
    )
    const offsetOf = (i: number): number =>
      offsets.value ? offsets.value[i] : i * fixedHeight.value
    const heightOf = (i: number): number =>
      offsets.value ? offsets.value[i + 1] - offsets.value[i] : fixedHeight.value

    const range = computed(() => {
      const fn = sizeFn.value
      if (fn) {
        const w = computeVirtualRange({
          itemCount: props.items.length,
          scrollTop: scrollTop.value,
          viewportSize: viewportHeight.value,
          itemSize: fn,
          // Reuse the memoized offsets so each scroll binary-searches the cached
          // array instead of rebuilding all offsets O(n).
          offsets: offsets.value ?? undefined,
          buffer: props.buffer,
        })
        return { start: w.startIndex, end: w.endIndex + 1 }
      }
      const startRaw = Math.floor(scrollTop.value / Math.max(1, fixedHeight.value))
      const visibleCount =
        fixedHeight.value <= 0 ? 0 : Math.ceil(viewportHeight.value / fixedHeight.value)
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
      const clamped = Math.max(0, Math.min(props.items.length - 1, index))
      const itemTop = offsetOf(clamped)
      const itemH = heightOf(clamped)
      let target = itemTop
      if (align === 'center') {
        target = itemTop - viewportHeight.value / 2 + itemH / 2
      } else if (align === 'end') {
        target = itemTop - viewportHeight.value + itemH
      }
      el.scrollTop = Math.max(0, target)
    }

    const refresh = () => {
      measureViewport()
      onScroll()
    }

    expose({ scrollToIndex, refresh } satisfies IrisVirtualScrollExposed)

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
