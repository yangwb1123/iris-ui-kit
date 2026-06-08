/**
 * Svelte 5 runes port of the Vue `useDrag` utility.
 * Bind pointer-driven drag to an element via `$effect`.
 */

export interface DragState {
  x: number
  y: number
  dx: number
  dy: number
  event: PointerEvent
}

export interface UseDragOptions {
  handle: () => HTMLElement | null | undefined
  buttons?: number[]
  disabled?: () => boolean | undefined
  onStart?: (state: DragState) => boolean | void
  onDrag?: (state: DragState) => void
  onEnd?: (state: DragState) => void
}

export function useDrag(options: UseDragOptions): void {
  const buttons = options.buttons ?? [0]
  let startX = 0
  let startY = 0
  let active: PointerEvent | null = null

  const onPointerDown = (event: PointerEvent): void => {
    if (options.disabled?.()) return
    if (!buttons.includes(event.button)) return
    const handle = options.handle()
    if (!handle) return
    startX = event.clientX
    startY = event.clientY
    const state: DragState = { x: event.clientX, y: event.clientY, dx: 0, dy: 0, event }
    const result = options.onStart?.(state)
    if (result === false) return
    active = event
    handle.setPointerCapture?.(event.pointerId)
    handle.style.touchAction = 'none'
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!active || active.pointerId !== event.pointerId) return
    options.onDrag?.({
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - startX,
      dy: event.clientY - startY,
      event,
    })
  }

  const onPointerEnd = (event: PointerEvent): void => {
    if (!active || active.pointerId !== event.pointerId) return
    const handle = options.handle()
    handle?.releasePointerCapture?.(event.pointerId)
    if (handle) handle.style.touchAction = ''
    options.onEnd?.({
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - startX,
      dy: event.clientY - startY,
      event,
    })
    active = null
  }

  $effect(() => {
    const el = options.handle()
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerEnd)
      el.removeEventListener('pointercancel', onPointerEnd)
    }
  })
}
