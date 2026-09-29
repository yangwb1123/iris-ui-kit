import { createSignal, mergeProps, splitProps, For, type JSX } from 'solid-js'
import { useI18n } from '../i18n'

export type IrisResizableHandle =
  'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

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

function resizeFromKeyboard(
  base: IrisResizableSize,
  handle: IrisResizableHandle,
  key: string,
  step: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): IrisResizableSize | null {
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
  }

  const next = {
    width: Math.max(minWidth, Math.min(maxWidth, width)),
    height: Math.max(minHeight, Math.min(maxHeight, height)),
  }
  return next.width === base.width && next.height === base.height ? null : next
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

  const { t } = useI18n()
  const [internalSize, setInternalSize] = createSignal<IrisResizableSize>({ ...local.defaultSize })

  const currentSize = (): IrisResizableSize => local.size ?? internalSize()

  const clampSize = (next: IrisResizableSize): IrisResizableSize => ({
    width: Math.max(
      local.minSize?.width ?? 40,
      Math.min(local.maxSize?.width ?? Infinity, next.width),
    ),
    height: Math.max(
      local.minSize?.height ?? 40,
      Math.min(local.maxSize?.height ?? Infinity, next.height),
    ),
  })

  const setSize = (next: IrisResizableSize): IrisResizableSize => {
    const clamped = clampSize(next)
    if (!local.size) setInternalSize(clamped)
    local.onSizeChange?.(clamped)
    return clamped
  }

  const onHandleKeyDown = (handle: IrisResizableHandle, e: KeyboardEvent) => {
    if (local.disabled) return
    const base = { ...currentSize() }
    const next = resizeFromKeyboard(
      base,
      handle,
      e.key,
      e.shiftKey ? 1 : 10,
      local.minSize?.width ?? 40,
      local.minSize?.height ?? 40,
      local.maxSize?.width ?? Infinity,
      local.maxSize?.height ?? Infinity,
    )
    if (!next) return
    e.preventDefault()
    const clamped = setSize(next)
    local.onResizeEnd?.(clamped)
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
          <button
            type="button"
            disabled={local.disabled || undefined}
            aria-label={t('resizer.handle', { handle })}
            data-iris-resizable-handle={handle}
            onMouseDown={(e) => onHandleMouseDown(handle, e)}
            onKeyDown={(e) => onHandleKeyDown(handle, e)}
            style={{
              ...handlePosition(handle),
              cursor: local.disabled ? 'default' : HANDLE_CURSORS[handle],
              'z-index': '10',
              border: '0',
              padding: '0',
              background: 'transparent',
            }}
          />
        )}
      </For>
    </div>
  )
}
