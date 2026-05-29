import * as React from 'react'
import { useDrag } from '../drag/useDrag'

export interface IrisDraggerPosition {
  x: number
  y: number
}

export interface IrisDraggerBounds {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

export interface IrisDraggerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'onDragStart' | 'onDragEnd'
> {
  value?: IrisDraggerPosition
  defaultValue?: IrisDraggerPosition
  onValueChange?: (next: IrisDraggerPosition) => void
  onDragStart?: (start: IrisDraggerPosition) => void
  onDragEnd?: (end: IrisDraggerPosition) => void
  disabled?: boolean
  /** Constrain the position to within these bounds (px from wrapper origin). */
  bounds?: IrisDraggerBounds
  /** Optional drag handle (restricts the draggable region). */
  handle?: React.ReactNode
}

/**
 * Make a child element positionable by drag. The wrapper is absolutely
 * positioned at its parent's top-left; the position is driven by `value` /
 * `defaultValue` (px). Drag uses pointer capture so the gesture survives
 * the pointer leaving the element.
 */
export function IrisDragger({
  value: valueProp,
  defaultValue = { x: 0, y: 0 },
  onValueChange,
  onDragStart,
  onDragEnd,
  disabled = false,
  bounds = {},
  handle,
  style,
  children,
  ...rest
}: IrisDraggerProps): React.ReactElement {
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<IrisDraggerPosition>(defaultValue)
  const position = isControlled ? (valueProp as IrisDraggerPosition) : internal

  const positionRef = React.useRef(position)
  positionRef.current = position

  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const handleRef = React.useRef<HTMLDivElement | null>(null)
  const dragHandleRef = handle ? handleRef : rootRef

  const [dragging, setDragging] = React.useState(false)
  const startPosRef = React.useRef<IrisDraggerPosition>({ x: 0, y: 0 })

  const clamp = (p: IrisDraggerPosition): IrisDraggerPosition => ({
    x: Math.max(bounds.minX ?? -Infinity, Math.min(bounds.maxX ?? Infinity, p.x)),
    y: Math.max(bounds.minY ?? -Infinity, Math.min(bounds.maxY ?? Infinity, p.y)),
  })

  useDrag({
    handle: dragHandleRef,
    disabled,
    onStart: () => {
      startPosRef.current = positionRef.current
      setDragging(true)
      onDragStart?.(positionRef.current)
    },
    onDrag: ({ dx, dy }) => {
      const next = clamp({
        x: startPosRef.current.x + dx,
        y: startPosRef.current.y + dy,
      })
      if (!isControlled) setInternal(next)
      onValueChange?.(next)
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
      data-iris-dragger=""
      data-state={dragging ? 'dragging' : 'idle'}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        cursor: handle ? 'default' : disabled ? 'not-allowed' : 'grab',
        touchAction: 'none',
        ...style,
      }}
    >
      {handle ? (
        <div
          ref={handleRef}
          data-iris-dragger-handle=""
          style={{
            cursor: disabled ? 'not-allowed' : 'grab',
            touchAction: 'none',
          }}
        >
          {handle}
        </div>
      ) : null}
      {children}
    </div>
  )
}
