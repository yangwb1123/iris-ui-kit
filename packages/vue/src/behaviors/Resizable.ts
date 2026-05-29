import { computed, defineComponent, h, ref, type PropType, type VNode } from 'vue'
import { useDrag } from '../primitives/drag/useDrag'

export type IrisResizableHandle =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export interface IrisResizableSize {
  width: number
  height: number
}

const ALL_HANDLES: IrisResizableHandle[] = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

const HANDLE_CURSORS: Record<IrisResizableHandle, string> = {
  top: 'ns-resize',
  right: 'ew-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  'top-left': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
  'bottom-right': 'nwse-resize',
}

function handlePosition(handle: IrisResizableHandle): Record<string, string> {
  const s: Record<string, string> = { position: 'absolute' }
  const t = handle.includes('top')
  const b = handle.includes('bottom')
  const l = handle.includes('left')
  const r = handle.includes('right')
  if (t) s.top = '-4px'
  if (b) s.bottom = '-4px'
  if (l) s.left = '-4px'
  if (r) s.right = '-4px'
  const isCorner = (t || b) && (l || r)
  if (isCorner) {
    s.width = '12px'
    s.height = '12px'
  } else if (t || b) {
    s.left = '0'
    s.right = '0'
    s.height = '8px'
  } else {
    s.top = '0'
    s.bottom = '0'
    s.width = '8px'
  }
  s.cursor = HANDLE_CURSORS[handle]
  return s
}

/**
 * Behavior wrapper: makes its child resizable via 8-direction handles. The
 * wrapper itself is `display: inline-block; position: relative` so the child
 * can be ANY element. Handles overlay the wrapper's edges.
 *
 * Composable with `IrisMovable`, `IrisHotkey`, `IrisClickOutside`.
 *
 * @example
 *   <IrisResizable :defaultSize="{ width: 400, height: 300 }">
 *     <IrisList :items="rows" />
 *   </IrisResizable>
 */
export const IrisResizable = defineComponent({
  name: 'IrisResizable',
  inheritAttrs: false,
  props: {
    size: { type: Object as PropType<IrisResizableSize>, default: undefined },
    defaultSize: {
      type: Object as PropType<IrisResizableSize>,
      default: () => ({ width: 200, height: 200 }),
    },
    handles: { type: Array as PropType<IrisResizableHandle[]>, default: () => ALL_HANDLES },
    minWidth: { type: Number, default: 40 },
    minHeight: { type: Number, default: 40 },
    maxWidth: { type: Number, default: Infinity },
    maxHeight: { type: Number, default: Infinity },
    keepAspect: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:size': (_v: IrisResizableSize) => true,
    resizeStart: (_v: IrisResizableSize) => true,
    resizeEnd: (_v: IrisResizableSize) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const isControlled = computed(() => props.size !== undefined)
    const internal = ref<IrisResizableSize>({ ...props.defaultSize })
    const size = computed<IrisResizableSize>(() =>
      isControlled.value ? (props.size as IrisResizableSize) : internal.value,
    )

    const setSize = (next: IrisResizableSize) => {
      if (!isControlled.value) internal.value = next
      emit('update:size', next)
    }

    const renderHandle = (handle: IrisResizableHandle): VNode => {
      const handleRef = ref<HTMLElement | null>(null)
      let startSize: IrisResizableSize = { width: 0, height: 0 }
      let aspect = 1

      useDrag({
        handle: handleRef,
        disabled: computed(() => props.disabled),
        onStart: () => {
          startSize = { ...size.value }
          aspect = startSize.width / Math.max(1, startSize.height)
          emit('resizeStart', startSize)
        },
        onDrag: ({ dx, dy }) => {
          const t = handle.includes('top')
          const b = handle.includes('bottom')
          const l = handle.includes('left')
          const r = handle.includes('right')
          let nextW = startSize.width
          let nextH = startSize.height
          if (r) nextW = startSize.width + dx
          if (l) nextW = startSize.width - dx
          if (b) nextH = startSize.height + dy
          if (t) nextH = startSize.height - dy
          if (props.keepAspect && (t || b) && (l || r)) {
            nextH = nextW / aspect
          }
          nextW = Math.max(props.minWidth, Math.min(props.maxWidth, nextW))
          nextH = Math.max(props.minHeight, Math.min(props.maxHeight, nextH))
          setSize({ width: nextW, height: nextH })
        },
        onEnd: () => {
          emit('resizeEnd', size.value)
        },
      })

      return h('div', {
        ref: (el: unknown) => {
          handleRef.value = (el ?? null) as HTMLElement | null
        },
        'data-iris-resizable-handle': handle,
        style: {
          ...handlePosition(handle),
          touchAction: 'none',
          background: 'transparent',
          zIndex: '1',
        },
      })
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-resizable': '',
          'data-state': props.disabled ? 'disabled' : 'idle',
          style: {
            position: 'relative',
            display: 'inline-block',
            width: `${size.value.width}px`,
            height: `${size.value.height}px`,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [slots.default?.(), ...props.handles.map(renderHandle)],
      )
  },
})
