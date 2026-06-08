import { createSignal, mergeProps, splitProps, For, type JSX } from 'solid-js'

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

function handlePosition(handle: IrisResizableHandle): JSX.CSSProperties {
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
  return s
}

export interface IrisResizableProps {
  size?: IrisResizableSize
  defaultSize?: IrisResizableSize
  minSize?: Partial<IrisResizableSize>
  maxSize?: Partial<IrisResizableSize>
  handles?: IrisResizableHandle[]
  disabled?: boolean
  onSizeChange?: (size: IrisResizableSize) => void
  onResizeEnd?: (size: IrisResizableSize) => void
  children?: JSX.Element
}

/**
 * Behavior wrapper: adds drag handles to resize an element.
 * Solid port of the Vue IrisResizable.
 */
export function IrisResizable(props: IrisResizableProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultSize: { width: 200, height: 200 } as IrisResizableSize,
      handles: ALL_HANDLES,
      disabled: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'size',
    'defaultSize',
    'minSize',
    'maxSize',
    'handles',
    'disabled',
    'onSizeChange',
    'onResizeEnd',
    'children',
  ])

  const [internalSize, setInternalSize] = createSignal<IrisResizableSize>({ ...local.defaultSize })

  const currentSize = (): IrisResizableSize => local.size ?? internalSize()

  const setSize = (next: IrisResizableSize) => {
    const w = Math.max(
      local.minSize?.width ?? 40,
      Math.min(local.maxSize?.width ?? Infinity, next.width),
    )
    const h = Math.max(
      local.minSize?.height ?? 40,
      Math.min(local.maxSize?.height ?? Infinity, next.height),
    )
    const clamped = { width: w, height: h }
    if (!local.size) setInternalSize(clamped)
    local.onSizeChange?.(clamped)
  }

  const onHandleMouseDown = (handle: IrisResizableHandle, e: MouseEvent) => {
    if (local.disabled) return
    e.preventDefault()
    const startSize = currentSize()
    const startX = e.clientX
    const startY = e.clientY

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      let { width, height } = startSize
      if (handle.includes('right')) width += dx
      if (handle.includes('left')) width -= dx
      if (handle.includes('bottom')) height += dy
      if (handle.includes('top')) height -= dy
      setSize({ width, height })
    }

    const onUp = () => {
      local.onResizeEnd?.(currentSize())
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      data-iris-resizable=""
      style={{
        position: 'relative',
        width: `${currentSize().width}px`,
        height: `${currentSize().height}px`,
        overflow: 'hidden',
      }}
    >
      {local.children}
      <For each={local.handles}>
        {(handle) => (
          <div
            data-iris-resizable-handle={handle}
            onMouseDown={(e) => onHandleMouseDown(handle, e)}
            style={{
              ...handlePosition(handle),
              cursor: local.disabled ? 'default' : HANDLE_CURSORS[handle],
              'z-index': '10',
              background: 'transparent',
            }}
          />
        )}
      </For>
    </div>
  )
}
