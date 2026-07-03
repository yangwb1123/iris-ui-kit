import { defineComponent, h, onBeforeUnmount, ref, type PropType, type VNode } from 'vue'
import { createSortable, type SortableRect } from '@iris-ui/core'

/** The data attribute on each sortable item for the collision system. */
export const SORTABLE_ITEM_ATTR = 'data-iris-sortable-item'

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

    // Subscribe to sortable state changes to track the active drag key
    const unsub = sortable.subscribe((state) => {
      activeKey.value = state.activeId
    })
    onBeforeUnmount(unsub)

    // Find the DOM order index of a child by its data-iris-sortable-item value.
    const indexOf = (key: string): number => {
      const container = containerRef.value
      if (!container) return -1
      return Array.from(
        container.querySelectorAll<HTMLElement>(`[${SORTABLE_ITEM_ATTR}]`),
      ).findIndex((el) => el.getAttribute(SORTABLE_ITEM_ATTR) === key)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (props.disabled) return
      const target = (e.target as HTMLElement).closest(`[${SORTABLE_ITEM_ATTR}]`)
      if (!target) return
      const container = containerRef.value
      if (!container) return
      const key = target.getAttribute(SORTABLE_ITEM_ATTR) ?? ''
      const index = indexOf(key)
      if (index < 0) return
      sortable.press(key, e.clientX, e.clientY)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!sortable.isPending() && sortable.getState().activeId === null) return
      const items = containerRef.value?.querySelectorAll<HTMLElement>(`[${SORTABLE_ITEM_ATTR}]`)
      const rects: SortableRect[] = Array.from(items ?? []).map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          id: el.getAttribute(SORTABLE_ITEM_ATTR) ?? '',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      })
      // Promote pending press to active drag once past the movement threshold
      sortable.tryStart(e.clientX, e.clientY)
      if (sortable.getState().activeId !== null) {
        sortable.moveOver({ x: e.clientX, y: e.clientY }, rects)
      }
    }

    const onPointerUp = () => {
      const state = sortable.getState()
      if (state.activeId === null) {
        sortable.cancel()
        return
      }
      const result = sortable.end()
      if (result.activeId && result.overId && result.activeId !== result.overId) {
        const from = indexOf(result.activeId)
        const to = indexOf(result.overId)
        if (from >= 0 && to >= 0) {
          const next = [...(props.items as unknown[])]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved!)
          if (props.onReorder) {
            props.onReorder(next)
          }
          emit('reorder', next)
        }
      }
    }

    const resolveKey = (item: unknown, index: number): string =>
      props.getKey ? props.getKey(item, index) : String(index)

    return () => {
      const children: VNode[] = []
      const defaultSlots = slots.default?.()
      if (defaultSlots) {
        const itemsArray = props.items as unknown[]
        defaultSlots.forEach((child, index) => {
          const item = itemsArray[index]
          const key = resolveKey(item, index)
          const isDragging = key === activeKey.value
          children.push(
            h(
              'div',
              {
                key,
                [SORTABLE_ITEM_ATTR]: key,
                'data-iris-sortable-dragging': isDragging ? '' : undefined,
                style: {
                  transition: isDragging ? 'none' : 'transform 150ms ease',
                  opacity: isDragging ? 0.4 : 1,
                  position: 'relative',
                  zIndex: isDragging ? 100 : undefined,
                },
              },
              [child],
            ),
          )
        })
      }

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
            flexDirection: 'column',
            gap: 'var(--iris-gap-sm, 4px)',
            opacity: props.disabled ? 0.6 : 1,
            userSelect: activeKey.value ? 'none' : undefined,
            ...((props.style as Record<string, string | number> | undefined) ?? {}),
          },
          onPointerdown: onPointerDown,
          onPointermove: onPointerMove,
          onPointerup: onPointerUp,
          onPointerleave: onPointerUp,
        },
        children,
      )
    }
  },
})
