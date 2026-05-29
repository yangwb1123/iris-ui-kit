/**
 * Writing direction for RTL support. Setting `dir` on the themed root is the
 * foundation that makes CSS logical properties (`margin-inline`, `inset-inline`,
 * text alignment, native flex/flow) flip for right-to-left locales.
 */
export type Direction = 'ltr' | 'rtl'

export interface ApplyDirectionResult {
  /** Restore the previous `dir` / `data-iris-dir` attributes on `target`. */
  revert(): void
}

/**
 * Write the writing direction to `target` (the `dir` attribute plus a
 * `data-iris-dir` hook for CSS selectors). Pure DOM, no framework dependency;
 * returns `revert()` for nested scopes / unmount. The Vue/React `ThemeProvider`
 * calls this.
 */
export function applyDirection(
  dir: Direction,
  target: HTMLElement = document.documentElement,
): ApplyDirectionResult {
  const prevDir = target.getAttribute('dir')
  const prevData = target.getAttribute('data-iris-dir')
  target.setAttribute('dir', dir)
  target.setAttribute('data-iris-dir', dir)
  return {
    revert() {
      if (prevDir === null) target.removeAttribute('dir')
      else target.setAttribute('dir', prevDir)
      if (prevData === null) target.removeAttribute('data-iris-dir')
      else target.setAttribute('data-iris-dir', prevData)
    },
  }
}

/**
 * Read the effective Iris writing direction from `target` (`data-iris-dir`,
 * falling back to the `dir` attribute). Defaults to `'ltr'` — including under
 * SSR where there is no `document`.
 */
export function getDirection(target?: HTMLElement | null): Direction {
  const el = target ?? (typeof document === 'undefined' ? null : document.documentElement)
  if (!el) return 'ltr'
  const value = el.getAttribute('data-iris-dir') ?? el.getAttribute('dir')
  return value === 'rtl' ? 'rtl' : 'ltr'
}
