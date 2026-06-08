/**
 * Global, theme-scoped stylesheet injected once by the framework adapters'
 * `ThemeProvider`. Carries the **reduced-motion** and **forced-colors**
 * (Windows High Contrast) compliance rules.
 *
 * Most Iris components animate via inline `transition` / `animation` styles,
 * which a plain `@media (prefers-reduced-motion)` block in a component
 * stylesheet cannot override. A stylesheet declaration marked `!important`,
 * however, beats a non-`!important` inline declaration in the cascade — so a
 * single injected `!important` rule under the reduced-motion media query
 * neutralizes every inline transition/animation at once.
 *
 * The forced-colors block addresses the fact that in Windows High Contrast /
 * `forced-colors: active`, the OS strips `background` and `box-shadow` — so
 * Iris's `box-shadow` focus rings disappear (a hard WCAG 2.4.7 failure) and
 * `background`-only selected states become indistinguishable. We restore a
 * system-color `outline` for `:focus-visible` and for selected/checked/current
 * elements so keyboard focus and selection stay visible.
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
@media (forced-colors: active) {
  [data-iris-theme] :focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 1px;
  }
  [data-iris-theme] [aria-selected="true"],
  [data-iris-theme] [aria-checked="true"],
  [data-iris-theme] [aria-current="page"],
  [data-iris-theme] [data-selected],
  [data-iris-theme] [data-state="active"] {
    outline: 1px solid Highlight;
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
