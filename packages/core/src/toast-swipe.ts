/** Interactive descendants own their pointer sequence; a parent swipe must not capture it. */
export const TOAST_SWIPE_IGNORE_SELECTOR =
  'button, a, input, select, textarea, summary, [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"])'

/** Pure gesture-start policy; the adapters only inspect the DOM target. */
export function canStartToastSwipe(interactiveTarget: boolean, button = 0): boolean {
  return !interactiveTarget && button === 0
}

/** Structural pointer data: core never reads a DOM node or captures a pointer. */
export interface ToastSwipePointer {
  pointerId: number
  clientX: number
  button?: number
  isPrimary?: boolean
}

/** One gesture belongs to one item identity and one primary pointer. */
export function createToastSwipe<T>() {
  let active: { item: T; pointerId: number; startX: number; dx: number } | null = null
  const owns = (item: T, pointerId: number): boolean =>
    active !== null && active.item === item && active.pointerId === pointerId

  return {
    start(item: T, pointer: ToastSwipePointer, interactiveTarget: boolean): boolean {
      if (
        active ||
        pointer.isPrimary === false ||
        !Number.isFinite(pointer.pointerId) ||
        !Number.isFinite(pointer.clientX) ||
        !canStartToastSwipe(interactiveTarget, pointer.button)
      )
        return false
      active = { item, pointerId: pointer.pointerId, startX: pointer.clientX, dx: 0 }
      return true
    },
    move(item: T, pointer: ToastSwipePointer): number | null {
      if (!owns(item, pointer.pointerId) || !Number.isFinite(pointer.clientX)) return null
      const dx = pointer.clientX - active!.startX
      if (!Number.isFinite(dx)) return null
      active!.dx = dx
      return dx
    },
    /** null means unowned; false means an owned release below the unchanged 80px threshold. */
    end(item: T, pointerId: number): boolean | null {
      if (!owns(item, pointerId)) return null
      const dismiss = Math.abs(active!.dx) > 80
      active = null
      return dismiss
    },
    cancel(item: T, pointerId: number): boolean {
      if (!owns(item, pointerId)) return false
      active = null
      return true
    },
    /** A removed/replaced item cannot transfer its gesture to a new toast with the same id. */
    retain(items: readonly T[]): boolean {
      if (!active || items.includes(active.item)) return false
      active = null
      return true
    },
    reset(): void {
      active = null
    },
  }
}
