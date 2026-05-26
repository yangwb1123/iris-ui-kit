import { computed, defineComponent, h, ref, type PropType, type VNode } from 'vue'
import { useDrag } from '../drag/useDrag'

export type IrisResizerHandle =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export interface IrisResizerSize {
  width: number
  height: number
}

const ALL_HANDLES: IrisResizerHandle[] = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

const HANDLE_CURSORS: Record<IrisResizerHandle, string> = {
  top: 'ns-resize',
  right: 'ew-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  'top-left': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
  'bottom-right': 'nwse-resize',
}

function handlePosition(handle: IrisResizerHandle): Record<string, string> {
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
 * 8-direction resizer wrapping a single child element. The child is rendered
 * in a relative-positioned wrapper; handles overlay each side and corner.
 * Drag updates `v-model:size` ({ width, height } in px) clamped by `minWidth`
 * / `minHeight` / `maxWidth` / `maxHeight`.
 *
 * Only requested handles are rendered — pass `handles="bottom-right"` for a
 * common diagonal corner drag, or omit to enable all 8.
 */
export const IrisResizer = defineComponent({
  name: 'IrisResizer',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: Object as PropType<IrisResizerSize>,
      required: true,
    },
    handles: {
      type: Array as PropType<IrisResizerHandle[]>,
      default: () => ALL_HANDLES,
    },
    minWidth: { type: Number, default: 40 },
    minHeight: { type: Number, default: 40 },
    maxWidth: { type: Number, default: Infinity },
    maxHeight: { type: Number, default: Infinity },
    disabled: { type: Boolean, default: false },
    /** Maintain `width / height` ratio when dragging corner handles. */
    keepAspect: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: IrisResizerSize) => true,
    resizeStart: (_value: IrisResizerSize) => true,
    resizeEnd: (_value: IrisResizerSize) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const wrapperStyle = computed<Record<string, string>>(() => ({
      position: 'relative',
      display: 'inline-block',
      width: `${props.modelValue.width}px`,
      height: `${props.modelValue.height}px`,
      ...((attrs.style as Record<string, string> | undefined) ?? {}),
    }))

    const renderHandle = (handle: IrisResizerHandle): VNode => {
      const handleRef = ref<HTMLElement | null>(null)
      let startSize: IrisResizerSize = { width: 0, height: 0 }
      let aspect = 1

      useDrag({
        handle: handleRef,
        disabled: computed(() => props.disabled),
        onStart: () => {
          startSize = { ...props.modelValue }
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
            // For corners, lock to aspect by driving height from width.
            nextH = nextW / aspect
          }

          nextW = Math.max(props.minWidth, Math.min(props.maxWidth, nextW))
          nextH = Math.max(props.minHeight, Math.min(props.maxHeight, nextH))

          emit('update:modelValue', { width: nextW, height: nextH })
        },
        onEnd: () => {
          emit('resizeEnd', { ...props.modelValue })
        },
      })

      return h('div', {
        ref: (el: unknown) => {
          handleRef.value = (el ?? null) as HTMLElement | null
        },
        'data-iris-resizer-handle': handle,
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
          'data-iris-resizer': '',
          'data-state': props.disabled ? 'disabled' : 'idle',
          style: wrapperStyle.value,
        },
        [
          slots.default?.(),
          ...props.handles.map(renderHandle),
        ],
      )
  },
})
