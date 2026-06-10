/**
 * Body scroll lock — Svelte 5 runes port of the Vue adapter.
 *
 * Reference-counted so multiple stacked dialogs cooperate:
 * the first `lock()` saves overflow/padding-right; the last
 * `unlock()` restores them. SSR-safe (guards on `document`).
 */

let lockCount = 0
let savedOverflow: string | null = null
let savedPaddingRight: string | null = null
let appliedOverflow: string | null = null
let appliedPaddingRight: string | null = null

function lock(): void {
  if (typeof document === 'undefined') return
  lockCount += 1
  if (lockCount > 1) return
  const body = document.body
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  savedOverflow = body.style.overflow
  savedPaddingRight = body.style.paddingRight
  body.style.overflow = 'hidden'
  appliedOverflow = 'hidden'
  if (scrollbarWidth > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight || '0')
    appliedPaddingRight = `${current + scrollbarWidth}px`
    body.style.paddingRight = appliedPaddingRight
  } else {
    appliedPaddingRight = null
  }
}

function unlock(): void {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return
  const body = document.body
  // Only restore if our locked value is still in place; respect host mutations.
  if (body.style.overflow === appliedOverflow) {
    body.style.overflow = savedOverflow ?? ''
  }
  if (appliedPaddingRight !== null && body.style.paddingRight === appliedPaddingRight) {
    body.style.paddingRight = savedPaddingRight ?? ''
  }
  savedOverflow = null
  savedPaddingRight = null
  appliedOverflow = null
  appliedPaddingRight = null
}

/**
 * Call inside a component's `$effect` (or pass `active` as a reactive getter).
 * Returns `{ lock, unlock }` so the caller controls timing.
 *
 * Typical usage inside a component:
 *
 * ```ts
 * const { lockScroll, unlockScroll } = useBodyScrollLock()
 * $effect(() => {
 *   if (open) lockScroll(); else unlockScroll()
 *   return () => unlockScroll()
 * })
 * ```
 */
export function useBodyScrollLock(): { lockScroll: () => void; unlockScroll: () => void } {
  let locked = false
  return {
    lockScroll(): void {
      if (!locked) {
        lock()
        locked = true
      }
    },
    unlockScroll(): void {
      if (locked) {
        unlock()
        locked = false
      }
    },
  }
}

/** Test-only helpers */
export function __getBodyScrollLockCount(): number {
  return lockCount
}
export function __resetBodyScrollLock(): void {
  lockCount = 0
  savedOverflow = null
  savedPaddingRight = null
  appliedOverflow = null
  appliedPaddingRight = null
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}
