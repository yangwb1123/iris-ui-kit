import { computed, defineComponent, h, ref } from 'vue'
import { useDrag } from '../drag/useDrag'

export interface IrisDraggerPosition {
  x: number
  y: number
}

/**
 * Make a child element positionable by drag. The child renders inside a
 * relative-positioned wrapper; position is driven by `v-model` (px from the
 * wrapper's top-left). Drag uses pointer capture so the gesture survives the
 * pointer leaving the element.
 *
 * The drag handle can be the whole element (default) or restricted to a
 * specific child via the `#handle` slot — useful for "title-bar" dragging
 * of window-like surfaces.
 */
export const IrisDragger = defineComponent({
  name: 'IrisDragger',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: Object as () => IrisDraggerPosition,
      default: () => ({ x: 0, y: 0 }),
    },
    disabled: { type: Boolean, default: false },
    /** Constrain the position to within these bounds (px from wrapper origin). */
    bounds: {
      type: Object as () => { minX?: number; maxX?: number; minY?: number; maxY?: number },
      default: () => ({}),
    },
  },
  emits: {
    'update:modelValue': (_value: IrisDraggerPosition) => true,
    dragStart: (_value: IrisDraggerPosition) => true,
    dragEnd: (_value: IrisDraggerPosition) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const rootRef = ref<HTMLElement | null>(null)
    const handleRef = ref<HTMLElement | null>(null)
    const dragging = ref(false)

    let startPos: IrisDraggerPosition = { x: 0, y: 0 }

    const clamp = (pos: IrisDraggerPosition): IrisDraggerPosition => ({
      x: Math.max(
        props.bounds.minX ?? -Infinity,
        Math.min(props.bounds.maxX ?? Infinity, pos.x),
      ),
      y: Math.max(
        props.bounds.minY ?? -Infinity,
        Math.min(props.bounds.maxY ?? Infinity, pos.y),
      ),
    })

    // The handle is either the named slot or the root element.
    const effectiveHandle = computed(() => handleRef.value ?? rootRef.value)

    useDrag({
      handle: effectiveHandle,
      disabled: computed(() => props.disabled),
      onStart: () => {
        startPos = { ...props.modelValue }
        dragging.value = true
        emit('dragStart', startPos)
      },
      onDrag: ({ dx, dy }) => {
        emit('update:modelValue', clamp({ x: startPos.x + dx, y: startPos.y + dy }))
      },
      onEnd: () => {
        dragging.value = false
        emit('dragEnd', { ...props.modelValue })
      },
    })

    return () => {
      const hasHandleSlot = !!slots.handle
      return h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            rootRef.value = (el ?? null) as HTMLElement | null
          },
          'data-iris-dragger': '',
          'data-state': dragging.value ? 'dragging' : 'idle',
          style: {
            position: 'absolute',
            left: '0',
            top: '0',
            transform: `translate3d(${props.modelValue.x}px, ${props.modelValue.y}px, 0)`,
            cursor: hasHandleSlot ? 'default' : props.disabled ? 'not-allowed' : 'grab',
            touchAction: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          hasHandleSlot &&
            h(
              'div',
              {
                ref: (el: unknown) => {
                  handleRef.value = (el ?? null) as HTMLElement | null
                },
                'data-iris-dragger-handle': '',
                style: {
                  cursor: props.disabled ? 'not-allowed' : 'grab',
                  touchAction: 'none',
                },
              },
              slots.handle?.(),
            ),
          slots.default?.(),
        ],
      )
    }
  },
})
