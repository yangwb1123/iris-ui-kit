/**
 * Global, theme-scoped stylesheet injected once by the framework adapters'
 * `ThemeProvider`. Currently carries the **reduced-motion** compliance rule.
 *
 * Most Iris components animate via inline `transition` / `animation` styles,
 * which a plain `@media (prefers-reduced-motion)` block in a component
 * stylesheet cannot override. A stylesheet declaration marked `!important`,
 * however, beats a non-`!important` inline declaration in the cascade — so a
 * single injected `!important` rule under the reduced-motion media query
 * neutralizes every inline transition/animation at once.
 *
 * Scoped to `[data-iris-theme]` (set by `applyTheme` on the provider's target)
 * so it never acts as a surprise global reset on markup the host owns outside
 * the themed subtree.
 */
const STYLE_ID = 'iris-global-styles'

const CSS = `
@media (prefers-reduced-motion: reduce) {
  [data-iris-theme],
  [data-iris-theme] *,
  [data-iris-theme] *::before,
  [data-iris-theme] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
  }
}
`

let installed = false

/**
 * Inject the global theme stylesheet into `<head>` exactly once. Idempotent
 * and SSR-safe (no-ops when there is no `document`). Called from each adapter's
 * `ThemeProvider` on mount.
 */
export function injectGlobalStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) {
    installed = true
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  installed = true
}

/** Test-only: remove the injected stylesheet and reset the install flag. */
export function __resetGlobalStyles(): void {
  installed = false
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

/** Test-only: the stylesheet element id. */
export const __GLOBAL_STYLE_ID = STYLE_ID
