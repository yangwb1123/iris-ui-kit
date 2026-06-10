import { createSignal, For, mergeProps, type JSX } from 'solid-js'
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

function handlePosition(handle: IrisResizerHandle): JSX.CSSProperties {
  const s: JSX.CSSProperties = { position: 'absolute' }
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

export interface IrisResizerProps {
  value: IrisResizerSize
  onChange?: (size: IrisResizerSize) => void
  onResizeStart?: (size: IrisResizerSize) => void
  onResizeEnd?: (size: IrisResizerSize) => void
  handles?: IrisResizerHandle[]
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  disabled?: boolean
  keepAspect?: boolean
  children?: JSX.Element
  style?: JSX.CSSProperties
}

/**
 * 8-direction resizer wrapping a single child element. Drag updates `value` clamped by min/max.
 * Solid port of the Vue IrisResizer.
 */
export function IrisResizer(props: IrisResizerProps): JSX.Element {
  const merged = mergeProps(
    {
      handles: ALL_HANDLES,
      minWidth: 40,
      minHeight: 40,
      maxWidth: Infinity,
      maxHeight: Infinity,
      disabled: false,
      keepAspect: false,
    },
    props,
  )

  function renderHandle(handle: IrisResizerHandle): JSX.Element {
    const [handleEl, setHandleEl] = createSignal<HTMLElement | null | undefined>()
    let startSize: IrisResizerSize = { width: 0, height: 0 }
    let aspect = 1

    useDrag({
      handle: handleEl,
      disabled: () => merged.disabled,
      onStart: () => {
        startSize = { ...merged.value }
        aspect = startSize.width / Math.max(1, startSize.height)
        merged.onResizeStart?.(startSize)
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

        if (merged.keepAspect && (t || b) && (l || r)) {
          nextH = nextW / aspect
        }

        nextW = Math.max(merged.minWidth, Math.min(merged.maxWidth, nextW))
        nextH = Math.max(merged.minHeight, Math.min(merged.maxHeight, nextH))

        merged.onChange?.({ width: nextW, height: nextH })
      },
      onEnd: () => {
        merged.onResizeEnd?.({ ...merged.value })
      },
    })

    return (
      <div
        ref={setHandleEl}
        data-iris-resizer-handle={handle}
        style={{
          ...handlePosition(handle),
          'touch-action': 'none',
          background: 'transparent',
          'z-index': '1',
        }}
      />
    )
  }

  return (
    <div
      data-iris-resizer=""
      data-state={merged.disabled ? 'disabled' : 'idle'}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: `${merged.value.width}px`,
        height: `${merged.value.height}px`,
        ...(merged.style ?? {}),
      }}
    >
      {merged.children}
      <For each={merged.handles}>{(handle) => renderHandle(handle)}</For>
    </div>
  )
}
