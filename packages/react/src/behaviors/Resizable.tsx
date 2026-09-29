import * as React from 'react'
import { useI18n } from '../i18n'
import { useDrag } from '../primitives/drag/useDrag'

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

function handlePosition(handle: IrisResizableHandle): React.CSSProperties {
  const s: React.CSSProperties = { position: 'absolute' }
  const t = handle.includes('top')
  const b = handle.includes('bottom')
  const l = handle.includes('left')
  const r = handle.includes('right')
  if (t) s.top = -4
  if (b) s.bottom = -4
  if (l) s.left = -4
  if (r) s.right = -4
  const isCorner = (t || b) && (l || r)
  if (isCorner) {
    s.width = 12
    s.height = 12
  } else if (t || b) {
    s.left = 0
    s.right = 0
    s.height = 8
  } else {
    s.top = 0
    s.bottom = 0
    s.width = 8
  }
  s.cursor = HANDLE_CURSORS[handle]
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
  keepAspect: boolean,
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

interface HandleProps {
  handle: IrisResizableHandle
  disabled: boolean
  keepAspect: boolean
  sizeRef: React.MutableRefObject<IrisResizableSize>
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
  onUpdate: (next: IrisResizableSize) => void
  onResizeStart?: (start: IrisResizableSize) => void
  onResizeEnd?: (end: IrisResizableSize) => void
}

function Handle(props: HandleProps): React.ReactElement {
  const { t } = useI18n()
  const handleRef = React.useRef<HTMLButtonElement | null>(null)
  const startRef = React.useRef<IrisResizableSize>({ width: 0, height: 0 })
  const aspectRef = React.useRef(1)

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (props.disabled) return
    const base = { ...props.sizeRef.current }
    const next = resizeFromKeyboard(
      base,
      props.handle,
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
    props.onResizeStart?.(base)
    props.onUpdate(next)
    props.onResizeEnd?.(next)
  }

  useDrag({
    handle: handleRef,
    disabled: props.disabled,
    onStart: () => {
      startRef.current = { ...props.sizeRef.current }
      aspectRef.current = startRef.current.width / Math.max(1, startRef.current.height)
      props.onResizeStart?.(startRef.current)
    },
    onDrag: ({ dx, dy }) => {
      const { handle } = props
      const t = handle.includes('top')
      const b = handle.includes('bottom')
      const l = handle.includes('left')
      const r = handle.includes('right')
      let nextW = startRef.current.width
      let nextH = startRef.current.height
      if (r) nextW = startRef.current.width + dx
      if (l) nextW = startRef.current.width - dx
      if (b) nextH = startRef.current.height + dy
      if (t) nextH = startRef.current.height - dy
      if (props.keepAspect && (t || b) && (l || r)) {
        nextH = nextW / aspectRef.current
      }
      nextW = Math.max(props.minWidth, Math.min(props.maxWidth, nextW))
      nextH = Math.max(props.minHeight, Math.min(props.maxHeight, nextH))
      props.onUpdate({ width: nextW, height: nextH })
    },
    onEnd: () => {
      props.onResizeEnd?.(props.sizeRef.current)
    },
  })

  return (
    <button
      ref={handleRef}
      type="button"
      disabled={props.disabled}
      aria-label={t('resizer.handle', { handle: props.handle })}
      data-iris-resizable-handle={props.handle}
      onKeyDown={onKeyDown}
      style={{
        ...handlePosition(props.handle),
        touchAction: 'none',
        border: 0,
        padding: 0,
        background: 'transparent',
        zIndex: 1,
      }}
    />
  )
}

export interface IrisResizableProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Controlled size. */
  size?: IrisResizableSize
  defaultSize?: IrisResizableSize
  onSizeChange?: (next: IrisResizableSize) => void
  onResizeStart?: (start: IrisResizableSize) => void
  onResizeEnd?: (end: IrisResizableSize) => void
  handles?: IrisResizableHandle[]
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  keepAspect?: boolean
  disabled?: boolean
  children?: React.ReactNode
}

/**
 * Behavior wrapper: makes its child resizable via 8-direction handles. The
 * wrapper itself is `display: inline-block; position: relative` so the child
 * can be ANY element (no need for the child to know it's wrapped). Handles
 * are absolutely positioned over the wrapper's edges.
 *
 * Composable: stack with `IrisMovable` / `IrisHotkey` / `IrisClickOutside`
 * for richer interactions on the same wrapped UI.
 *
 * @example
 *   <IrisResizable defaultSize={{ width: 400, height: 300 }}>
 *     <IrisList items={items} />
 *   </IrisResizable>
 */
export function IrisResizable({
  size: sizeProp,
  defaultSize = { width: 200, height: 200 },
  onSizeChange,
  onResizeStart,
  onResizeEnd,
  handles = ALL_HANDLES,
  minWidth = 40,
  minHeight = 40,
  maxWidth = Infinity,
  maxHeight = Infinity,
  keepAspect = false,
  disabled = false,
  style,
  children,
  ...rest
}: IrisResizableProps): React.ReactElement {
  const isControlled = sizeProp !== undefined
  const [internal, setInternal] = React.useState(defaultSize)
  const size = isControlled ? (sizeProp as IrisResizableSize) : internal
  const sizeRef = React.useRef(size)
  sizeRef.current = size

  const setSize = React.useCallback(
    (next: IrisResizableSize) => {
      if (!isControlled) setInternal(next)
      onSizeChange?.(next)
    },
    [isControlled, onSizeChange],
  )

  return (
    <div
      {...rest}
      data-iris-resizable=""
      data-state={disabled ? 'disabled' : 'idle'}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size.width,
        height: size.height,
        ...style,
      }}
    >
      {children}
      {handles.map((h) => (
        <Handle
          key={h}
          handle={h}
          disabled={disabled}
          keepAspect={keepAspect}
          sizeRef={sizeRef}
          minWidth={minWidth}
          minHeight={minHeight}
          maxWidth={maxWidth}
          maxHeight={maxHeight}
          onUpdate={setSize}
          onResizeStart={onResizeStart}
          onResizeEnd={onResizeEnd}
        />
      ))}
    </div>
  )
}
