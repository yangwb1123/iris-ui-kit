import {
  computed,
  defineComponent,
  effectScope,
  h,
  onBeforeUnmount,
  ref,
  type PropType,
  type VNode,
} from 'vue'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'

export type IrisResizerHandle =
  'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

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

function resizeFromKeyboard(
  base: IrisResizerSize,
  handle: IrisResizerHandle,
  key: string,
  step: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
  keepAspect: boolean,
): IrisResizerSize | null {
  let dx = 0
  let dy = 0
  const isBoundary = key === 'Home' || key === 'End'

  if (key === 'ArrowLeft') dx = -step
  else if (key === 'ArrowRight') dx = step
  else if (key === 'ArrowUp') dy = -step
  else if (key === 'ArrowDown') dy = step
  else if (!isBoundary) return null

  let width = base.width
  let height = base.height
  const hasHorizontalHandle = handle.includes('left') || handle.includes('right')
  const hasVerticalHandle = handle.includes('top') || handle.includes('bottom')

  if (isBoundary) {
    if (hasHorizontalHandle) {
      width = key === 'Home' ? minWidth : Number.isFinite(maxWidth) ? maxWidth : base.width
    }
    if (hasVerticalHandle) {
      height = key === 'Home' ? minHeight : Number.isFinite(maxHeight) ? maxHeight : base.height
    }
  } else {
    if (handle.includes('right')) width = base.width + dx
    if (handle.includes('left')) width = base.width - dx
    if (handle.includes('bottom')) height = base.height + dy
    if (handle.includes('top')) height = base.height - dy

    if (keepAspect && hasHorizontalHandle && hasVerticalHandle) {
      height = width / (base.width / Math.max(1, base.height))
    }
  }

  const next = {
    width: Math.max(minWidth, Math.min(maxWidth, width)),
    height: Math.max(minHeight, Math.min(maxHeight, height)),
  }
  return next.width === base.width && next.height === base.height ? null : next
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
    const { t } = useI18n()
    const wrapperStyle = computed<Record<string, string>>(() => ({
      position: 'relative',
      display: 'inline-block',
      width: `${props.modelValue.width}px`,
      height: `${props.modelValue.height}px`,
      ...((attrs.style as Record<string, string> | undefined) ?? {}),
    }))

    const handleRefs = new Map<IrisResizerHandle, ReturnType<typeof ref<HTMLElement | null>>>()
    const handleScopes = new Map<IrisResizerHandle, ReturnType<typeof effectScope>>()
    const wiredHandles = new Set<IrisResizerHandle>()
    const getHandleRef = (handle: IrisResizerHandle) => {
      let handleRef = handleRefs.get(handle)
      if (!handleRef) {
        handleRef = ref<HTMLElement | null>(null)
        handleRefs.set(handle, handleRef)
      }
      return handleRef
    }
    const wireHandle = (handle: IrisResizerHandle): void => {
      if (wiredHandles.has(handle)) return
      wiredHandles.add(handle)
      const handleRef = getHandleRef(handle)
      const scope = effectScope()
      handleScopes.set(handle, scope)
      let startSize: IrisResizerSize = { width: 0, height: 0 }
      let aspect = 1
      scope.run(() => {
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
      })
    }
    onBeforeUnmount(() => {
      for (const scope of handleScopes.values()) scope.stop()
      handleScopes.clear()
    })

    const onKeyDown = (event: KeyboardEvent, handle: IrisResizerHandle) => {
      if (props.disabled) return
      const base = { ...props.modelValue }
      const next = resizeFromKeyboard(
        base,
        handle,
        event.key,
        event.shiftKey ? 1 : 10,
        props.minWidth,
        props.minHeight,
        props.maxWidth,
        props.maxHeight,
        props.keepAspect,
      )
      if (!next) return
      event.preventDefault()
      emit('resizeStart', base)
      emit('update:modelValue', next)
      emit('resizeEnd', next)
    }

    const renderHandle = (handle: IrisResizerHandle): VNode => {
      wireHandle(handle)
      const handleRef = getHandleRef(handle)
      return h('button', {
        ref: (el: unknown) => {
          handleRef.value = (el ?? null) as HTMLElement | null
        },
        type: 'button',
        disabled: props.disabled || undefined,
        'aria-label': t('resizer.handle', { handle }),
        'data-iris-resizer-handle': handle,
        onKeydown: (event: KeyboardEvent) => onKeyDown(event, handle),
        style: {
          ...handlePosition(handle),
          touchAction: 'none',
          border: '0',
          padding: '0',
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
        [slots.default?.(), ...props.handles.map(renderHandle)],
      )
  },
})
