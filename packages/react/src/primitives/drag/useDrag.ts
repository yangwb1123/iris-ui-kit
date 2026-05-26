import * as React from 'react'

export interface DragState {
  /** Pointer x in client coordinates. */
  x: number
  /** Pointer y in client coordinates. */
  y: number
  /** Cumulative delta from pointerdown. */
  dx: number
  /** Cumulative delta from pointerdown. */
  dy: number
  /** The active pointer event. */
  event: PointerEvent
}

export interface UseDragOptions {
  /** The element the drag handle is bound to. */
  handle: React.RefObject<HTMLElement | null>
  /** Drag is only initiated for these pointer buttons. Default `[0]`. */
  buttons?: number[]
  onStart?: (state: DragState) => boolean | void
  onDrag?: (state: DragState) => void
  onEnd?: (state: DragState) => void
  disabled?: boolean
}

/**
 * Bind pointer-driven drag handlers to an element. Uses `setPointerCapture`
 * so the drag continues even after the pointer leaves the element. Cancels
 * on `pointercancel`.
 *
 * Pure pointer events — works for mouse, touch, and pen.
 */
export function useDrag(options: UseDragOptions): void {
  const { handle, buttons = [0], onStart, onDrag, onEnd, disabled = false } = options

  // Pin all callbacks/options into a ref so the effect can stay mounted across
  // re-renders without re-wiring listeners on every prop change.
  const latest = React.useRef({ onStart, onDrag, onEnd, disabled, buttons })
  latest.current = { onStart, onDrag, onEnd, disabled, buttons }

  React.useEffect(() => {
    const el = handle.current
    if (!el) return

    let active: PointerEvent | null = null
    let startX = 0
    let startY = 0

    const onPointerDown = (event: PointerEvent) => {
      if (latest.current.disabled) return
      if (!latest.current.buttons.includes(event.button)) return
      startX = event.clientX
      startY = event.clientY
      const state: DragState = {
        x: event.clientX,
        y: event.clientY,
        dx: 0,
        dy: 0,
        event,
      }
      const result = latest.current.onStart?.(state)
      if (result === false) return
      active = event
      el.setPointerCapture?.(event.pointerId)
      el.style.touchAction = 'none'
      event.preventDefault()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!active || active.pointerId !== event.pointerId) return
      latest.current.onDrag?.({
        x: event.clientX,
        y: event.clientY,
        dx: event.clientX - startX,
        dy: event.clientY - startY,
        event,
      })
    }

    const onPointerEnd = (event: PointerEvent) => {
      if (!active || active.pointerId !== event.pointerId) return
      el.releasePointerCapture?.(event.pointerId)
      el.style.touchAction = ''
      latest.current.onEnd?.({
        x: event.clientX,
        y: event.clientY,
        dx: event.clientX - startX,
        dy: event.clientY - startY,
        event,
      })
      active = null
    }

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
  }, [handle])
}
