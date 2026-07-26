<script lang="ts">
  import type { Snippet } from 'svelte'

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

  interface Props {
    position?: IrisMovablePosition
    defaultPosition?: IrisMovablePosition
    bounds?: IrisMovableBounds
    byHandle?: boolean
    disabled?: boolean
    onPositionChange?: (pos: IrisMovablePosition) => void
    onDragStart?: (pos: IrisMovablePosition) => void
    onDragEnd?: (pos: IrisMovablePosition) => void
    children?: Snippet
  }

  let {
    position: positionProp,
    defaultPosition = { x: 0, y: 0 },
    bounds = {},
    byHandle = false,
    disabled = false,
    onPositionChange,
    onDragStart,
    onDragEnd,
    children,
  }: Props = $props()

  const isControlled = $derived(positionProp !== undefined)

  // svelte-ignore state_referenced_locally
  let internal = $state<IrisMovablePosition>({ ...defaultPosition })

  const pos = $derived(isControlled ? (positionProp as IrisMovablePosition) : internal)

  let dragging = $state(false)

  function clamp(v: number, min?: number, max?: number): number {
    if (min !== undefined && v < min) return min
    if (max !== undefined && v > max) return max
    return v
  }

  function onMouseDown(e: MouseEvent) {
    if (disabled) return
    if (byHandle) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-iris-movable-handle]')) return
    }
    e.preventDefault()
    dragging = true

    const startX = e.clientX - pos.x
    const startY = e.clientY - pos.y

    const onMove = (me: MouseEvent) => {
      const x = clamp(me.clientX - startX, bounds.minX, bounds.maxX)
      const y = clamp(me.clientY - startY, bounds.minY, bounds.maxY)
      const next = { x, y }
      if (!isControlled) internal = next
      onPositionChange?.(next)
    }

    const onUp = (me: MouseEvent) => {
      dragging = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const x = clamp(me.clientX - startX, bounds.minX, bounds.maxX)
      const y = clamp(me.clientY - startY, bounds.minY, bounds.maxY)
      onDragEnd?.({ x, y })
    }

    onDragStart?.(pos)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
</script>

<div
  data-iris-movable
  data-dragging={dragging ? '' : undefined}
  role="presentation"
  onmousedown={onMouseDown}
  style:position="absolute"
  style:transform={`translate(${pos.x}px, ${pos.y}px)`}
  style:cursor={disabled ? 'default' : byHandle ? 'default' : 'grab'}
>
  {@render children?.()}
</div>
