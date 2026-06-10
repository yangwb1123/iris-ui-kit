import { createEffect, onCleanup, type Accessor } from 'solid-js'

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
  /** Accessor returning the container element whose Tab key cycle is trapped. */
  container: Accessor<HTMLElement | null | undefined>
  /** Whether the trap is currently active. */
  active: Accessor<boolean>
  /** Element to restore focus to when the trap deactivates. */
  returnFocusTo?: Accessor<HTMLElement | null | undefined>
  /** Whether to focus the first focusable element on activation. Default `true`. */
  initialFocus?: boolean
}

/**
 * Constrain Tab / Shift+Tab focus traversal to descendants of `container`.
 * Solid port of the Vue modal-utils `useFocusTrap`.
 */
export function useFocusTrap(options: UseFocusTrapOptions): void {
  let previouslyFocused: HTMLElement | null = null

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!options.active() || event.key !== 'Tab') return
    const root = options.container()
    if (!root) return
    const focusables = getFocusable(root)
    if (focusables.length === 0) {
      event.preventDefault()
      root.focus()
      return
    }
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    const activeEl = document.activeElement as HTMLElement | null

    if (event.shiftKey) {
      if (activeEl === first || !root.contains(activeEl)) {
        event.preventDefault()
        last.focus()
      }
    } else {
      if (activeEl === last || !root.contains(activeEl)) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  createEffect(() => {
    const isActive = options.active()
    if (isActive) {
      // Activate
      if (typeof document === 'undefined') return
      previouslyFocused = (document.activeElement as HTMLElement | null) ?? null
      document.addEventListener('keydown', onKeyDown)
      if (options.initialFocus !== false) {
        requestAnimationFrame(() => {
          const root = options.container()
          if (!root) return
          const focusables = getFocusable(root)
          ;(focusables[0] ?? root).focus()
        })
      }
    } else {
      // Deactivate
      if (typeof document === 'undefined') return
      document.removeEventListener('keydown', onKeyDown)
      const restore = options.returnFocusTo?.() ?? previouslyFocused
      requestAnimationFrame(() => {
        // The element that had focus when the trap opened may have been
        // unmounted while it was open; focusing a detached node silently drops
        // focus to <body>. Only restore if it is still in the document.
        if (restore && restore.isConnected) restore.focus?.()
      })
      previouslyFocused = null
    }
  })

  onCleanup(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', onKeyDown)
    }
  })
}
