import { createSignal, mergeProps, splitProps, type JSX } from 'solid-js'

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

export interface IrisMovableProps {
  position?: IrisMovablePosition
  defaultPosition?: IrisMovablePosition
  bounds?: IrisMovableBounds
  byHandle?: boolean
  disabled?: boolean
  onPositionChange?: (pos: IrisMovablePosition) => void
  onDragStart?: (pos: IrisMovablePosition) => void
  onDragEnd?: (pos: IrisMovablePosition) => void
  children?: JSX.Element
}

function clamp(pos: IrisMovablePosition, bounds: IrisMovableBounds): IrisMovablePosition {
  return {
    x: Math.max(bounds.minX ?? -Infinity, Math.min(bounds.maxX ?? Infinity, pos.x)),
    y: Math.max(bounds.minY ?? -Infinity, Math.min(bounds.maxY ?? Infinity, pos.y)),
  }
}

/**
 * Behavior wrapper: makes its child draggable via transform.
 * Solid port of the Vue IrisMovable.
 */
export function IrisMovable(props: IrisMovableProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultPosition: { x: 0, y: 0 } as IrisMovablePosition,
      bounds: {} as IrisMovableBounds,
      byHandle: false,
      disabled: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'position',
    'defaultPosition',
    'bounds',
    'byHandle',
    'disabled',
    'onPositionChange',
    'onDragStart',
    'onDragEnd',
    'children',
  ])

  const [internalPos, setInternalPos] = createSignal<IrisMovablePosition>({
    ...local.defaultPosition,
  })
  const [dragging, setDragging] = createSignal(false)

  const currentPos = (): IrisMovablePosition => local.position ?? internalPos()

  const setPosition = (next: IrisMovablePosition) => {
    if (!local.position) setInternalPos(next)
    local.onPositionChange?.(next)
  }

  let startPos = { x: 0, y: 0 }
  let startMouse = { x: 0, y: 0 }

  const onMouseDown = (e: MouseEvent) => {
    if (local.disabled) return
    if (local.byHandle && !(e.target as HTMLElement).closest('[data-iris-movable-handle]')) return
    e.preventDefault()
    startPos = currentPos()
    startMouse = { x: e.clientX, y: e.clientY }
    setDragging(true)
    local.onDragStart?.(currentPos())

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouse.x
      const dy = ev.clientY - startMouse.y
      setPosition(clamp({ x: startPos.x + dx, y: startPos.y + dy }, local.bounds))
    }

    const onUp = () => {
      setDragging(false)
      local.onDragEnd?.(currentPos())
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      data-iris-movable=""
      data-state={dragging() ? 'dragging' : 'idle'}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: '0',
        top: '0',
        transform: `translate3d(${currentPos().x}px, ${currentPos().y}px, 0)`,
        cursor: local.byHandle ? 'default' : local.disabled ? 'not-allowed' : 'grab',
        'touch-action': 'none',
      }}
    >
      {local.children}
    </div>
  )
}
