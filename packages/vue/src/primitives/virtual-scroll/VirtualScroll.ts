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

export type IrisVirtualScrollAlign = 'start' | 'center' | 'end'

export interface IrisVirtualScrollExposed {
  /** Programmatically scroll so the item at `index` is visible. */
  scrollToIndex: (index: number, align?: IrisVirtualScrollAlign) => void
  /** Force-recompute the visible range (e.g. after resizing externally). */
  refresh: () => void
}

/**
 * Fixed-height virtual scroller. Renders only the visible window of items
 * plus a configurable buffer above and below, so lists of 10k+ rows stay
 * smooth.
 *
 * The container is `overflow: auto` with explicit height; an inner spacer
 * is sized to the full virtual height (`items.length × itemHeight`), and
 * each visible item is absolutely positioned at its natural Y offset. Scroll
 * events are throttled with `requestAnimationFrame` to avoid layout thrash.
 *
 * **Limitations (intentional in this iteration)**:
 *   - Items must have a uniform `itemHeight` (px).
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
    /** Per-item height in px. All items share this height. */
    itemHeight: { type: Number, required: true },
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

    const totalHeight = computed(() => props.items.length * props.itemHeight)

    const visibleCount = computed(() => {
      if (props.itemHeight <= 0) return 0
      return Math.ceil(viewportHeight.value / props.itemHeight)
    })

    const range = computed(() => {
      const startRaw = Math.floor(scrollTop.value / Math.max(1, props.itemHeight))
      const start = Math.max(0, startRaw - props.buffer)
      const end = Math.min(props.items.length, startRaw + visibleCount.value + props.buffer)
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

    onMounted(() => {
      measureViewport()
      if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
        observer = new ResizeObserver(measureViewport)
        observer.observe(viewportRef.value)
      }
    })

    onBeforeUnmount(() => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer?.disconnect()
      observer = null
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
      const itemTop = clamped * props.itemHeight
      let target = itemTop
      if (align === 'center') {
        target = itemTop - viewportHeight.value / 2 + props.itemHeight / 2
      } else if (align === 'end') {
        target = itemTop - viewportHeight.value + props.itemHeight
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
              'data-iris-virtual-item': '',
              'data-iris-virtual-index': i,
              style: {
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                height: `${props.itemHeight}px`,
                transform: `translateY(${i * props.itemHeight}px)`,
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
