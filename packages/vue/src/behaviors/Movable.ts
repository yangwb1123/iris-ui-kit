import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUpdated,
  ref,
  type PropType,
} from 'vue'
import { useDrag } from '../primitives/drag/useDrag'

export interface IrisMovablePosition {
  x: number
  y: number
}

export interface IrisMovableBounds {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

/**
 * Behavior wrapper: makes its child draggable via `transform`. The whole
 * wrapper drags by default; pass `byHandle` + put `data-iris-movable-handle`
 * on a descendant to restrict the drag origin.
 *
 * Renders `position: absolute` — wrap inside a `position: relative`
 * container for predictable layout.
 */
export const IrisMovable = defineComponent({
  name: 'IrisMovable',
  inheritAttrs: false,
  props: {
    position: { type: Object as PropType<IrisMovablePosition>, default: undefined },
    defaultPosition: {
      type: Object as PropType<IrisMovablePosition>,
      default: () => ({ x: 0, y: 0 }),
    },
    bounds: { type: Object as PropType<IrisMovableBounds>, default: () => ({}) },
    byHandle: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:position': (_v: IrisMovablePosition) => true,
    dragStart: (_v: IrisMovablePosition) => true,
    dragEnd: (_v: IrisMovablePosition) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const isControlled = computed(() => props.position !== undefined)
    const internal = ref<IrisMovablePosition>({ ...props.defaultPosition })
    const position = computed<IrisMovablePosition>(() =>
      isControlled.value ? (props.position as IrisMovablePosition) : internal.value,
    )

    const rootRef = ref<HTMLElement | null>(null)
    const handleRef = ref<HTMLElement | null>(null)
    const dragging = ref(false)
    let startPos: IrisMovablePosition = { x: 0, y: 0 }

    // Find handle inside the wrapper when byHandle is set.
    const refreshHandle = () => {
      if (!props.byHandle) return
      handleRef.value = rootRef.value?.querySelector<HTMLElement>(
        '[data-iris-movable-handle]',
      ) ?? null
    }
    onMounted(refreshHandle)
    onUpdated(refreshHandle)

    const dragTarget = computed(() =>
      props.byHandle ? handleRef : rootRef,
    )

    const clamp = (p: IrisMovablePosition): IrisMovablePosition => ({
      x: Math.max(
        props.bounds.minX ?? -Infinity,
        Math.min(props.bounds.maxX ?? Infinity, p.x),
      ),
      y: Math.max(
        props.bounds.minY ?? -Infinity,
        Math.min(props.bounds.maxY ?? Infinity, p.y),
      ),
    })

    const setPosition = (next: IrisMovablePosition) => {
      if (!isControlled.value) internal.value = next
      emit('update:position', next)
    }

    useDrag({
      handle: computed(() => dragTarget.value.value),
      disabled: computed(() => props.disabled),
      onStart: () => {
        startPos = position.value
        dragging.value = true
        emit('dragStart', position.value)
      },
      onDrag: ({ dx, dy }) => {
        setPosition(clamp({ x: startPos.x + dx, y: startPos.y + dy }))
      },
      onEnd: () => {
        dragging.value = false
        emit('dragEnd', position.value)
      },
    })

    return () =>
      h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            rootRef.value = (el ?? null) as HTMLElement | null
          },
          'data-iris-movable': '',
          'data-state': dragging.value ? 'dragging' : 'idle',
          style: {
            position: 'absolute',
            left: '0',
            top: '0',
            transform: `translate3d(${position.value.x}px, ${position.value.y}px, 0)`,
            cursor: props.byHandle ? 'default' : props.disabled ? 'not-allowed' : 'grab',
            touchAction: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})
