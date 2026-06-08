import { createEffect, onCleanup, type Accessor } from 'solid-js'

export interface DragState {
  x: number
  y: number
  dx: number
  dy: number
  event: PointerEvent
}

export interface UseDragOptions {
  /** Accessor returning the drag handle element. */
  handle: Accessor<HTMLElement | null | undefined>
  /** Drag is only initiated for these pointer button(s). Default `[0]` (primary). */
  buttons?: number[]
  /** Called on pointerdown that starts a drag. Return `false` to cancel. */
  onStart?: (state: DragState) => boolean | void
  /** Called on every pointermove while dragging. */
  onDrag?: (state: DragState) => void
  /** Called on pointerup or pointercancel. */
  onEnd?: (state: DragState) => void
  /** Whether drag is disabled. */
  disabled?: Accessor<boolean | undefined>
}

/**
 * Bind pointer-driven drag handlers to an element. Uses `setPointerCapture`
 * so the drag continues even if the pointer leaves the element.
 * Solid port of the Vue useDrag.
 */
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

  const attach = (el: HTMLElement): void => {
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
  }

  const detach = (el: HTMLElement): void => {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerEnd)
    el.removeEventListener('pointercancel', onPointerEnd)
  }

  createEffect(() => {
    const el = options.handle()
    if (el) {
      attach(el)
      onCleanup(() => detach(el))
    }
  })
}
