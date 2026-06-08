import { createEffect, onCleanup, type Accessor } from 'solid-js'

let lockCount = 0
let savedOverflow: string | null = null
let savedPaddingRight: string | null = null

function lock(): void {
  if (typeof document === 'undefined') return
  lockCount += 1
  if (lockCount > 1) return
  const body = document.body
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  savedOverflow = body.style.overflow
  savedPaddingRight = body.style.paddingRight
  body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    const currentPadding = parseFloat(getComputedStyle(body).paddingRight || '0')
    body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
  }
}

function unlock(): void {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return
  const body = document.body
  body.style.overflow = savedOverflow ?? ''
  body.style.paddingRight = savedPaddingRight ?? ''
  savedOverflow = null
  savedPaddingRight = null
}

/**
 * Lock the document body's scroll while `active()` is true. Reference-counted
 * so multiple stacked Dialogs cooperate. Restores prior `overflow` and
 * `padding-right` (to compensate for the scrollbar gap) when the last lock
 * releases. SSR-safe. Solid port of the Vue modal-utils hook.
 */
export function useBodyScrollLock(active: Accessor<boolean>): void {
  let isLockedByThis = false

  createEffect(() => {
    const value = active()
    if (value && !isLockedByThis) {
      lock()
      isLockedByThis = true
    } else if (!value && isLockedByThis) {
      unlock()
      isLockedByThis = false
    }
  })

  onCleanup(() => {
    if (isLockedByThis) {
      unlock()
      isLockedByThis = false
    }
  })
}

/** Test-only: read the current lock count. */
export function __getBodyScrollLockCount(): number {
  return lockCount
}

/** Test-only: hard-reset the module-level lock state. */
export function __resetBodyScrollLock(): void {
  lockCount = 0
  savedOverflow = null
  savedPaddingRight = null
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}
