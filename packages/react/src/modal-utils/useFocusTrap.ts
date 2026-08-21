import * as React from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'audio[controls]',
  'video[controls]',
  'iframe',
  'object',
  'embed',
].join(',')

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  )
}

export interface UseFocusTrapOptions {
  /** Element whose Tab key cycle is being trapped. */
  container: React.RefObject<HTMLElement | null>
  /** Whether the trap is currently active. */
  active: boolean
  /** Element to restore focus to when the trap deactivates. */
  returnFocusTo?: React.RefObject<HTMLElement | null | undefined>
  /** Whether to focus the first focusable element on activation. Default `true`. */
  initialFocus?: boolean
}

function createFocusTrapKeyHandler(
  container: React.RefObject<HTMLElement | null>,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return
    const root = container.current
    if (!root) return
    const focusables = getFocusable(root)
    if (focusables.length === 0) {
      event.preventDefault()
      root.focus()
      return
    }
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    const active = document.activeElement as HTMLElement | null

    if (event.shiftKey) {
      if (active === first || !root.contains(active)) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last || !root.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }
}

/**
 * Constrain Tab / Shift+Tab focus traversal to descendants of `container`.
 *
 * Behavior on activation:
 *   - Records the currently focused element.
 *   - If `initialFocus !== false`, focuses the first focusable descendant
 *     (or the container itself if there are none).
 *
 * Behavior while active:
 *   - Tab on the last focusable element wraps to the first; Shift+Tab on
 *     the first wraps to the last.
 *
 * Behavior on deactivation:
 *   - Restores focus to `returnFocusTo?.current` if provided, else to the
 *     element that was focused when the trap activated.
 */
export function useFocusTrap(options: UseFocusTrapOptions): void {
  const { container, active, returnFocusTo, initialFocus = true } = options
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!active) return
    if (typeof document === 'undefined') return

    previouslyFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null

    const onKeyDown = createFocusTrapKeyHandler(container)
    document.addEventListener('keydown', onKeyDown)

    let raf: number | undefined
    if (initialFocus) {
      raf = requestAnimationFrame(() => {
        const root = container.current
        if (!root) return
        const focusables = getFocusable(root)
        ;(focusables[0] ?? root).focus()
      })
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (raf !== undefined) cancelAnimationFrame(raf)
      const target = returnFocusTo?.current ?? previouslyFocusedRef.current
      requestAnimationFrame(() => {
        // The element that had focus when the trap opened may have been
        // unmounted while it was open; focusing a detached node silently drops
        // focus to <body>. Only restore if it is still in the document.
        if (target && target.isConnected) target.focus?.()
      })
      previouslyFocusedRef.current = null
    }
  }, [active, container, returnFocusTo, initialFocus])
}
