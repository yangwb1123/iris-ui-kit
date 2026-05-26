import { onScopeDispose, watch, type Ref } from 'vue'

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
  container: Ref<HTMLElement | null>
  /** Whether the trap is currently active. */
  active: Ref<boolean>
  /** Element to restore focus to when the trap deactivates. */
  returnFocusTo?: Ref<HTMLElement | null | undefined>
  /** Whether to focus the first focusable element on activation. Default `true`. */
  initialFocus?: boolean
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
 *   - Restores focus to `returnFocusTo?.value` if provided, else to the
 *     element that was focused when the trap activated.
 */
export function useFocusTrap(options: UseFocusTrapOptions): void {
  let previouslyFocused: HTMLElement | null = null

  const onKeyDown = (event: KeyboardEvent) => {
    if (!options.active.value || event.key !== 'Tab') return
    const root = options.container.value
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
    } else {
      if (active === last || !root.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  const activate = () => {
    if (typeof document === 'undefined') return
    previouslyFocused = (document.activeElement as HTMLElement | null) ?? null
    document.addEventListener('keydown', onKeyDown)
    if (options.initialFocus !== false) {
      requestAnimationFrame(() => {
        const root = options.container.value
        if (!root) return
        const focusables = getFocusable(root)
        ;(focusables[0] ?? root).focus()
      })
    }
  }

  const deactivate = () => {
    if (typeof document === 'undefined') return
    document.removeEventListener('keydown', onKeyDown)
    const restore = options.returnFocusTo?.value ?? previouslyFocused
    requestAnimationFrame(() => {
      restore?.focus?.()
    })
    previouslyFocused = null
  }

  watch(
    options.active,
    (active, wasActive) => {
      if (active && !wasActive) activate()
      else if (!active && wasActive) deactivate()
    },
    { immediate: true, flush: 'post' },
  )

  onScopeDispose(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', onKeyDown)
    }
  })
}
