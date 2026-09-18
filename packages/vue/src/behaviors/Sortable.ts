import {
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import { createSortable, type SortableRect } from '@iris-ui-kit/core'

/** The data attribute on each sortable item for the collision system. */
export const SORTABLE_ITEM_ATTR = 'data-iris-sortable-item'

const SORTABLE_ANIMATION_MS = 150
const SORTABLE_TRANSITION = `transform ${SORTABLE_ANIMATION_MS}ms ease`

type RectMap = Map<string, SortableRect>

interface SortableEntry {
  key: string
  item: unknown
}

interface DragMetrics {
  activeKey: string
  activeRect: SortableRect
  layoutRects: RectMap
  pointerX: number
  pointerY: number
  rects: SortableRect[]
  startX: number
  startY: number
}

/**
 * Behavior wrapper: makes a list of items sortable via drag-and-drop. Wraps
 * each direct child in a sortable item context. The consumer supplies the
 * `items` array and an `onReorder` callback. Items render through the default
 * slot; each item is wrapped with drag detection from `createSortable`.
 *
 * Composable: stack with `IrisResizable` / `IrisMovable` / `IrisHotkey` for
 * richer interactions on the same wrapped UI.
 *
 * @example
 *   <IrisSortable :items="items" @reorder="items = $event">
 *     <div v-for="(label, i) in items" :key="i">{{ label }}</div>
 *   </IrisSortable>
 */
export const IrisSortable = defineComponent({
  name: 'IrisSortable',
  inheritAttrs: false,
  props: {
    /** The ordered items. Used to detect which item is at which position. */
    items: {
      type: Array as PropType<readonly unknown[]>,
      required: true,
    },
    /** Called when the user drops an item in a new position. */
    onReorder: {
      type: Function as PropType<(next: unknown[]) => void>,
      default: undefined,
    },
    /** Optional item key getter. Defaults to `String(index)`. */
    getKey: {
      type: Function as PropType<(item: unknown, index: number) => string>,
      default: undefined,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    orientation: {
      type: String as PropType<'vertical' | 'horizontal'>,
      default: 'vertical',
    },
    class: {
      type: String,
      default: undefined,
    },
    style: {
      type: Object as PropType<Record<string, string | number>>,
      default: undefined,
    },
  },
  emits: {
    reorder: (_next: unknown[]) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const containerRef = ref<HTMLElement | null>(null)
    const sortable = createSortable()
    const activeKey = ref<string | null>(null)
    const pressPoint = ref<{ x: number; y: number } | null>(null)
    const pointerId = ref<number | null>(null)
    const dragMetrics = shallowRef<DragMetrics | null>(null)
    const previewEntries = ref<SortableEntry[] | null>(null)

    let animationFrame: number | null = null
    let animationTimer: number | null = null
    let animationToken = 0
    let pendingFromRects: RectMap | null = null
    let pendingAnimation = false

    // Subscribe to sortable state changes to track the active drag key.
    const unsub = sortable.subscribe((state) => {
      activeKey.value = state.activeId
    })
    onBeforeUnmount(() => {
      unsub()
      stopAnimation()
    })

    const resolveKey = (item: unknown, index: number): string =>
      props.getKey ? props.getKey(item, index) : String(index)

    const entriesFor = (items: readonly unknown[]): SortableEntry[] =>
      items.map((item, index) => ({ item, key: resolveKey(item, index) }))

    const itemElements = (): HTMLElement[] =>
      Array.from(containerRef.value?.querySelectorAll<HTMLElement>(`[${SORTABLE_ITEM_ATTR}]`) ?? [])

    const readRects = (): SortableRect[] =>
      itemElements().map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          id: el.getAttribute(SORTABLE_ITEM_ATTR) ?? '',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      })

    const readRectMap = (): RectMap => new Map(readRects().map((rect) => [rect.id, rect]))

    const readElements = (): Map<string, HTMLElement> =>
      new Map(itemElements().map((el) => [el.getAttribute(SORTABLE_ITEM_ATTR) ?? '', el]))

    const transform = (x: number, y: number): string => `translate3d(${x}px, ${y}px, 0)`

    const activeTransform = (
      metrics: DragMetrics,
      base: SortableRect,
    ): { x: number; y: number } => ({
      x: metrics.activeRect.left + metrics.pointerX - metrics.startX - base.left,
      y: metrics.activeRect.top + metrics.pointerY - metrics.startY - base.top,
    })

    const requestFrame = (callback: () => void): number => {
      if (typeof requestAnimationFrame === 'function') {
        return requestAnimationFrame(() => callback())
      }
      return window.setTimeout(callback, 0)
    }

    const cancelFrame = (handle: number): void => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
      else window.clearTimeout(handle)
    }

    /** Stop an in-flight FLIP animation without changing the current order. */
    const stopAnimation = (): void => {
      animationToken += 1
      if (animationFrame !== null) cancelFrame(animationFrame)
      if (animationTimer !== null) window.clearTimeout(animationTimer)
      animationFrame = null
      animationTimer = null
    }

    const clearItemMotion = (): void => {
      itemElements().forEach((el) => {
        el.style.transform = ''
        el.style.transition = ''
        el.style.willChange = ''
      })
    }

    const releasePointerCapture = (): void => {
      const container = containerRef.value
      const id = pointerId.value
      if (!container || id === null || typeof container.releasePointerCapture !== 'function') return
      if (typeof container.hasPointerCapture === 'function' && !container.hasPointerCapture(id))
        return
      container.releasePointerCapture(id)
    }

    const resetInteraction = (): void => {
      releasePointerCapture()
      stopAnimation()
      clearItemMotion()
      pressPoint.value = null
      pointerId.value = null
      dragMetrics.value = null
      previewEntries.value = null
      pendingFromRects = null
      pendingAnimation = false
    }

    const applyActiveTransform = (): void => {
      const metrics = dragMetrics.value
      if (!metrics) return
      const element = readElements().get(metrics.activeKey)
      const base = metrics.layoutRects.get(metrics.activeKey)
      if (!element || !base) return
      const offset = activeTransform(metrics, base)
      element.style.transition = 'none'
      element.style.transform = transform(offset.x, offset.y)
      element.style.willChange = 'transform'
    }

    /**
     * Reproduce SortableJS's capture → reorder → inverse transform → animate
     * cycle. The list is reordered in the preview immediately, while each
     * wrapper is FLIP-animated from its current visual rectangle to its new
     * flex position. This handles variable-width tabs and interrupted drags;
     * fixed one-slot transforms do not.
     */
    const runPreviewAnimation = (fromRects: RectMap): void => {
      const root = containerRef.value
      const metrics = dragMetrics.value
      if (!root || !metrics) return
      stopAnimation()
      const token = animationToken
      const elements = readElements()

      elements.forEach((element, key) => {
        if (!fromRects.has(key)) return
        element.style.transition = 'none'
        element.style.transform = ''
      })
      void root.offsetWidth

      const toRects = readRectMap()
      metrics.layoutRects = toRects
      // Once the preview order has changed, collision must use the new base
      // layout. It must never use an in-flight transform, but keeping the old
      // order would make the pointer hit the tab that just moved away.
      metrics.rects = [...toRects.values()]
      const startOffsets = new Map<string, { x: number; y: number }>()
      elements.forEach((element, key) => {
        const from = fromRects.get(key)
        const to = toRects.get(key)
        if (!from || !to) return
        const offset = { x: from.left - to.left, y: from.top - to.top }
        startOffsets.set(key, offset)
        element.style.transform = transform(offset.x, offset.y)
        element.style.willChange = 'transform'
      })
      void root.offsetWidth

      animationFrame = requestFrame(() => {
        animationFrame = null
        if (token !== animationToken || !dragMetrics.value) return
        const latest = dragMetrics.value
        const latestElements = readElements()
        latestElements.forEach((element, key) => {
          const base = latest.layoutRects.get(key)
          if (!base) return
          if (key === latest.activeKey) {
            const offset = activeTransform(latest, base)
            element.style.transition = 'none'
            element.style.transform = transform(offset.x, offset.y)
            return
          }
          const start = startOffsets.get(key)
          const moved = !!start && (Math.abs(start.x) > 0.5 || Math.abs(start.y) > 0.5)
          element.style.transition = moved ? SORTABLE_TRANSITION : 'none'
          element.style.transform = transform(0, 0)
        })

        animationTimer = window.setTimeout(() => {
          if (token !== animationToken) return
          animationTimer = null
          latestElements.forEach((element, key) => {
            if (key === dragMetrics.value?.activeKey) {
              element.style.transition = 'none'
              return
            }
            element.style.transform = ''
            element.style.transition = ''
            element.style.willChange = ''
          })
        }, SORTABLE_ANIMATION_MS)
      })
    }

    const schedulePreviewAnimation = (fromRects: RectMap): void => {
      if (!pendingFromRects) pendingFromRects = fromRects
      if (pendingAnimation) return
      pendingAnimation = true
      void nextTick(() => {
        pendingAnimation = false
        const captured = pendingFromRects
        pendingFromRects = null
        if (captured && dragMetrics.value) runPreviewAnimation(captured)
      })
    }

    const movePreviewTo = (targetKey: string): void => {
      const entries = previewEntries.value
      const metrics = dragMetrics.value
      if (!entries || !metrics) return
      const from = entries.findIndex((entry) => entry.key === metrics.activeKey)
      const to = entries.findIndex((entry) => entry.key === targetKey)
      if (from < 0 || to < 0 || from === to) return

      const fromRects = readRectMap()
      const next = [...entries]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      previewEntries.value = next
      schedulePreviewAnimation(fromRects)
    }

    const onPointerDown = (e: PointerEvent): void => {
      if (props.disabled || (e.button !== undefined && e.button !== 0)) return
      const target = (e.target as HTMLElement).closest(`[${SORTABLE_ITEM_ATTR}]`)
      const container = containerRef.value
      if (!target || !container) return
      const key = target.getAttribute(SORTABLE_ITEM_ATTR) ?? ''
      if (!key) return
      pressPoint.value = { x: e.clientX, y: e.clientY }
      pointerId.value = Number.isFinite(e.pointerId) ? e.pointerId : null
      stopAnimation()
      pendingFromRects = null
      pendingAnimation = false
      clearItemMotion()
      dragMetrics.value = null
      previewEntries.value = null
      if (pointerId.value !== null && typeof container.setPointerCapture === 'function') {
        container.setPointerCapture(pointerId.value)
      }
      sortable.press(key, e.clientX, e.clientY)
    }

    const onPointerMove = (e: PointerEvent): void => {
      if (
        pointerId.value !== null &&
        Number.isFinite(e.pointerId) &&
        pointerId.value !== e.pointerId
      ) {
        return
      }
      if (!sortable.isPending() && sortable.getState().activeId === null) return
      const rects = dragMetrics.value?.rects ?? readRects()
      sortable.tryStart(e.clientX, e.clientY)
      const activeId = sortable.getState().activeId
      if (activeId === null) return

      if (!dragMetrics.value) {
        const activeRect = rects.find((rect) => rect.id === activeId)
        const start = pressPoint.value
        if (!activeRect || !start) return
        dragMetrics.value = {
          activeKey: activeId,
          activeRect,
          layoutRects: new Map(rects.map((rect) => [rect.id, rect])),
          pointerX: e.clientX,
          pointerY: e.clientY,
          rects,
          startX: start.x,
          startY: start.y,
        }
        previewEntries.value = entriesFor(props.items as unknown[])
      } else {
        dragMetrics.value.pointerX = e.clientX
        dragMetrics.value.pointerY = e.clientY
      }

      if (e.cancelable) e.preventDefault()
      applyActiveTransform()
      const overId = sortable.moveOver({ x: e.clientX, y: e.clientY }, dragMetrics.value.rects)
      if (overId) movePreviewTo(overId)
    }

    const reorderedItems = (result: {
      activeId: string | null
      overId: string | null
    }): unknown[] | null => {
      const source = props.items as unknown[]
      const sourceEntries = entriesFor(source)
      const preview = previewEntries.value
      if (
        preview &&
        preview.length === sourceEntries.length &&
        preview.every((entry) => sourceEntries.some((sourceEntry) => sourceEntry.key === entry.key))
      ) {
        const changed = preview.some((entry, index) => entry.key !== sourceEntries[index]?.key)
        return changed ? preview.map((entry) => entry.item) : null
      }
      if (!result.activeId || !result.overId || result.activeId === result.overId) return null
      const from = sourceEntries.findIndex((entry) => entry.key === result.activeId)
      const to = sourceEntries.findIndex((entry) => entry.key === result.overId)
      if (from < 0 || to < 0 || from === to) return null
      const next = [...source]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      return next
    }

    const onPointerUp = (): void => {
      const state = sortable.getState()
      if (state.activeId === null) {
        sortable.cancel()
        resetInteraction()
        return
      }
      const result = sortable.end()
      const next = reorderedItems(result)
      resetInteraction()
      if (next) {
        props.onReorder?.(next)
        emit('reorder', next)
      }
    }

    const onPointerCancel = (): void => {
      sortable.cancel()
      resetInteraction()
    }

    return () => {
      const sourceItems = props.items as unknown[]
      const sourceEntries = entriesFor(sourceItems)
      const sourceChildren = slots.default?.() ?? []
      const childByKey = new Map<string, VNode>()
      sourceEntries.forEach((entry, index) => {
        const child = sourceChildren[index]
        if (child) childByKey.set(entry.key, child)
      })
      const sourceKeys = new Set(sourceEntries.map((entry) => entry.key))
      const preview = previewEntries.value
      const entries =
        preview &&
        preview.length === sourceEntries.length &&
        preview.every((entry) => sourceKeys.has(entry.key))
          ? preview
          : sourceEntries
      const children: VNode[] = entries.map((entry, index) => {
        const isDragging = entry.key === activeKey.value
        const child = childByKey.get(entry.key) ?? sourceChildren[index]
        return h(
          'div',
          {
            key: entry.key,
            [SORTABLE_ITEM_ATTR]: entry.key,
            'data-iris-sortable-dragging': isDragging ? '' : undefined,
            style: {
              transition: isDragging ? 'none' : SORTABLE_TRANSITION,
              willChange: isDragging ? 'transform' : undefined,
              opacity: isDragging ? 0.4 : 1,
              position: 'relative',
              zIndex: isDragging ? 100 : undefined,
            },
          },
          child ? [child] : [],
        )
      })

      return h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            containerRef.value = (el ?? null) as HTMLElement | null
          },
          'data-iris-sortable': '',
          'data-state': activeKey.value ? 'dragging' : 'idle',
          class: props.class,
          style: {
            display: 'flex',
            flexDirection: props.orientation === 'horizontal' ? 'row' : 'column',
            gap: 'var(--iris-gap-sm, 4px)',
            opacity: props.disabled ? 0.6 : 1,
            userSelect: activeKey.value ? 'none' : undefined,
            ...((props.style as Record<string, string | number> | undefined) ?? {}),
          },
          onPointerdown: onPointerDown,
          onPointermove: onPointerMove,
          onPointerup: onPointerUp,
          onPointercancel: onPointerCancel,
        },
        children,
      )
    }
  },
})
