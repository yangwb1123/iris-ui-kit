import { createMemo, createSignal, mergeProps, Show, type JSX } from 'solid-js'
import { useDrag } from './useDrag'

export interface IrisDraggerPosition {
  x: number
  y: number
}

export interface IrisDraggerProps {
  value?: IrisDraggerPosition
  defaultValue?: IrisDraggerPosition
  onChange?: (pos: IrisDraggerPosition) => void
  onDragStart?: (pos: IrisDraggerPosition) => void
  onDragEnd?: (pos: IrisDraggerPosition) => void
  disabled?: boolean
  bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number }
  /** If provided, only the handle triggers the drag; the rest is non-draggable. */
  handle?: JSX.Element
  children?: JSX.Element
  style?: JSX.CSSProperties
}

/**
 * Make a child element positionable by drag. Position driven by `value` (px from container origin).
 * Solid port of the Vue IrisDragger.
 */
export function IrisDragger(props: IrisDraggerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: { x: 0, y: 0 } as IrisDraggerPosition,
      disabled: false,
      bounds: {} as { minX?: number; maxX?: number; minY?: number; maxY?: number },
    },
    props,
  )

  const isControlled = (): boolean => props.value !== undefined
  const [internalValue, setInternalValue] = createSignal<IrisDraggerPosition>(merged.defaultValue)
  const currentValue = (): IrisDraggerPosition =>
    isControlled() ? (props.value ?? { x: 0, y: 0 }) : internalValue()

  const clamp = (pos: IrisDraggerPosition): IrisDraggerPosition => ({
    x: Math.max(merged.bounds.minX ?? -Infinity, Math.min(merged.bounds.maxX ?? Infinity, pos.x)),
    y: Math.max(merged.bounds.minY ?? -Infinity, Math.min(merged.bounds.maxY ?? Infinity, pos.y)),
  })

  const setPosition = (pos: IrisDraggerPosition): void => {
    if (!isControlled()) setInternalValue(pos)
    merged.onChange?.(pos)
  }

  const [rootEl, setRootEl] = createSignal<HTMLElement | null | undefined>()
  const [handleEl, setHandleEl] = createSignal<HTMLElement | null | undefined>()
  const [dragging, setDragging] = createSignal(false)
  let startPos: IrisDraggerPosition = { x: 0, y: 0 }

  // If no handle slot, use root element as the drag handle
  const effectiveHandle = createMemo(() => handleEl() ?? rootEl())

  useDrag({
    handle: effectiveHandle,
    disabled: () => merged.disabled,
    onStart: () => {
      startPos = { ...currentValue() }
      setDragging(true)
      merged.onDragStart?.(startPos)
    },
    onDrag: ({ dx, dy }) => {
      setPosition(clamp({ x: startPos.x + dx, y: startPos.y + dy }))
    },
    onEnd: () => {
      setDragging(false)
      merged.onDragEnd?.({ ...currentValue() })
    },
  })

  const hasHandle = (): boolean => !!merged.handle

  return (
    <div
      ref={setRootEl}
      data-iris-dragger=""
      data-state={dragging() ? 'dragging' : 'idle'}
      style={{
        position: 'absolute',
        left: '0',
        top: '0',
        transform: `translate3d(${currentValue().x}px, ${currentValue().y}px, 0)`,
        cursor: hasHandle() ? 'default' : merged.disabled ? 'not-allowed' : 'grab',
        'touch-action': 'none',
        ...(merged.style ?? {}),
      }}
    >
      <Show when={hasHandle()}>
        <div
          ref={setHandleEl}
          data-iris-dragger-handle=""
          style={{
            cursor: merged.disabled ? 'not-allowed' : 'grab',
            'touch-action': 'none',
          }}
        >
          {merged.handle}
        </div>
      </Show>
      {merged.children}
    </div>
  )
}
