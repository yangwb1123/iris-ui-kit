/**
 * Focus trap — Svelte 5 runes port of the Vue adapter.
 *
 * While active:
 *   - Tab on the last focusable element wraps to the first.
 *   - Shift+Tab on the first wraps to the last.
 *
 * On activation: optionally focuses the first focusable descendant.
 * On deactivation: restores focus to the element that was focused
 * before activation (or `returnFocusTo`).
 *
 * Attach via `$effect` in the consuming component.
 */

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
  /** Returns the container element whose focus is being trapped. */
  container: () => HTMLElement | null | undefined
  /** Whether the trap is currently active. */
  active: () => boolean
  /** Element to restore focus to when trap deactivates. */
  returnFocusTo?: () => HTMLElement | null | undefined
  /** Whether to focus the first focusable element on activation. Default `true`. */
  initialFocus?: boolean
}

function createFocusTrapKeyHandler(options: UseFocusTrapOptions): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
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
 * Wire inside a component with `$effect`. Attach/detach automatically.
 *
 * ```ts
 * useFocusTrap({ container: () => containerEl, active: () => open })
 * ```
 */
export function useFocusTrap(options: UseFocusTrapOptions): void {
  let previouslyFocused: HTMLElement | null = null

  const onKeyDown = createFocusTrapKeyHandler(options)

  const activate = (): void => {
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
  }

  const deactivate = (): void => {
    if (typeof document === 'undefined') return
    document.removeEventListener('keydown', onKeyDown)
    const restore = options.returnFocusTo?.() ?? previouslyFocused
    requestAnimationFrame(() => {
      // The saved element may have been unmounted while the trap was open;
      // focusing a detached node silently drops focus to <body>. Only restore
      // when the target is still in the document.
      if (restore && restore.isConnected) restore.focus?.()
    })
    previouslyFocused = null
  }

  $effect(() => {
    const isActive = options.active()
    if (isActive) {
      activate()
    } else {
      deactivate()
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', onKeyDown)
      }
    }
  })
}
