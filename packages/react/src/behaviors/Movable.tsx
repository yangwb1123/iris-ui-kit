import * as React from 'react'
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

export interface IrisMovableProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'onDragStart' | 'onDragEnd'
> {
  position?: IrisMovablePosition
  defaultPosition?: IrisMovablePosition
  onPositionChange?: (next: IrisMovablePosition) => void
  onDragStart?: (start: IrisMovablePosition) => void
  onDragEnd?: (end: IrisMovablePosition) => void
  bounds?: IrisMovableBounds
  /** Restrict drag origination to a child element marked `data-iris-movable-handle`. */
  byHandle?: boolean
  disabled?: boolean
  children?: React.ReactNode
}

/**
 * Behavior wrapper: makes its child draggable. Position is `transform`-based
 * (no layout thrash). The whole wrapper drags by default; pass `byHandle`
 * and put `data-iris-movable-handle=""` on a descendant (e.g. a title bar)
 * to restrict the drag origin.
 *
 * The wrapper renders `position: absolute` at its parent's top-left — wrap
 * inside a `position: relative` container for predictable layout.
 *
 * @example
 *   <div style={{ position: 'relative', height: 500 }}>
 *     <IrisMovable defaultPosition={{ x: 20, y: 20 }} byHandle>
 *       <div>
 *         <div data-iris-movable-handle>Drag me by this title bar</div>
 *         <IrisList items={items} />
 *       </div>
 *     </IrisMovable>
 *   </div>
 */
export function IrisMovable({
  position: positionProp,
  defaultPosition = { x: 0, y: 0 },
  onPositionChange,
  onDragStart,
  onDragEnd,
  bounds = {},
  byHandle = false,
  disabled = false,
  style,
  children,
  ...rest
}: IrisMovableProps): React.ReactElement {
  const isControlled = positionProp !== undefined
  const [internal, setInternal] = React.useState<IrisMovablePosition>(defaultPosition)
  const position = isControlled ? (positionProp as IrisMovablePosition) : internal
  const positionRef = React.useRef(position)
  positionRef.current = position

  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const handleRef = React.useRef<HTMLElement | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const startRef = React.useRef<IrisMovablePosition>({ x: 0, y: 0 })

  // If byHandle, locate `[data-iris-movable-handle]` inside the wrapper.
  React.useEffect(() => {
    if (!byHandle) return
    handleRef.current =
      rootRef.current?.querySelector<HTMLElement>('[data-iris-movable-handle]') ?? null
  })

  const dragTargetRef = byHandle
    ? (handleRef as React.MutableRefObject<HTMLElement | null>)
    : (rootRef as React.MutableRefObject<HTMLElement | null>)

  const clamp = (p: IrisMovablePosition): IrisMovablePosition => ({
    x: Math.max(bounds.minX ?? -Infinity, Math.min(bounds.maxX ?? Infinity, p.x)),
    y: Math.max(bounds.minY ?? -Infinity, Math.min(bounds.maxY ?? Infinity, p.y)),
  })

  const setPosition = (next: IrisMovablePosition) => {
    if (!isControlled) setInternal(next)
    onPositionChange?.(next)
  }

  useDrag({
    handle: dragTargetRef,
    disabled,
    onStart: () => {
      startRef.current = positionRef.current
      setDragging(true)
      onDragStart?.(positionRef.current)
    },
    onDrag: ({ dx, dy }) => {
      setPosition(clamp({ x: startRef.current.x + dx, y: startRef.current.y + dy }))
    },
    onEnd: () => {
      setDragging(false)
      onDragEnd?.(positionRef.current)
    },
  })

  return (
    <div
      {...rest}
      ref={rootRef}
      data-iris-movable=""
      data-state={dragging ? 'dragging' : 'idle'}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        cursor: byHandle ? 'default' : disabled ? 'not-allowed' : 'grab',
        touchAction: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
