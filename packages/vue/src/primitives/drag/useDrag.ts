import { onScopeDispose, watch, type Ref } from 'vue'

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
  handle: Ref<HTMLElement | null | undefined>
  /** Drag is only initiated for these pointer button(s). Default `[0]` (primary). */
  buttons?: number[]
  /** Called on pointerdown that starts a drag. Return `false` to cancel. */
  onStart?: (state: DragState) => boolean | void
  /** Called on every pointermove while dragging. */
  onDrag?: (state: DragState) => void
  /** Called on pointerup or pointercancel. */
  onEnd?: (state: DragState) => void
  /** Disable the drag. */
  disabled?: Ref<boolean | undefined>
}

/**
 * Bind pointer-driven drag handlers to an element. Uses `setPointerCapture`
 * so the drag continues even if the pointer leaves the element. Cancels on
 * `pointercancel` (e.g. browser interruption).
 *
 * Pure pointer events — works for mouse, touch, and pen. The handle element
 * gets `touchAction: 'none'` automatically while a drag is in progress to
 * prevent scrolling interference on touch devices.
 *
 * @example
 *   const handleRef = ref<HTMLElement | null>(null)
 *   useDrag({
 *     handle: handleRef,
 *     onDrag: ({ dx }) => (offsetX.value = startOffset + dx),
 *   })
 */
export function useDrag(options: UseDragOptions): void {
  const buttons = options.buttons ?? [0]
  let startX = 0
  let startY = 0
  let active: PointerEvent | null = null

  const onPointerDown = (event: PointerEvent) => {
    if (options.disabled?.value) return
    if (!buttons.includes(event.button)) return
    const handle = options.handle.value
    if (!handle) return

    startX = event.clientX
    startY = event.clientY
    const state: DragState = {
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      dy: 0,
      event,
    }
    const result = options.onStart?.(state)
    if (result === false) return
    active = event
    handle.setPointerCapture?.(event.pointerId)
    handle.style.touchAction = 'none'
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!active || active.pointerId !== event.pointerId) return
    options.onDrag?.({
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - startX,
      dy: event.clientY - startY,
      event,
    })
  }

  const onPointerEnd = (event: PointerEvent) => {
    if (!active || active.pointerId !== event.pointerId) return
    const handle = options.handle.value
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

  const attach = (el: HTMLElement) => {
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
  }

  const detach = (el: HTMLElement) => {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerEnd)
    el.removeEventListener('pointercancel', onPointerEnd)
  }

  watch(
    options.handle,
    (el, prev) => {
      if (prev) detach(prev)
      if (el) attach(el)
    },
    { immediate: true, flush: 'post' },
  )

  onScopeDispose(() => {
    const el = options.handle.value
    if (el) detach(el)
  })
}
