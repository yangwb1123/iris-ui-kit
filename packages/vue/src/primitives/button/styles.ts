/**
 * Singleton stylesheet for `IrisButton`. Lives in a single injected
 * `<style id="iris-button-styles">` block. Holds only what cannot be inline:
 *
 *   - `:hover` / `:focus-visible` pseudo-states
 *   - `:disabled` / `[aria-busy="true"]` attribute selectors
 *   - The spinner keyframe
 *
 * Everything else (variant colors, size paddings) ships as inline `style`
 * bindings on each button instance, which keeps theme switching instant
 * because the values are CSS variables.
 *
 * Injection is **lazy** (first `IrisButton` mount triggers it) and
 * **idempotent** (subsequent mounts are no-ops). Safe under SSR — the
 * function short-circuits when `document` is undefined.
 */

const STYLE_ID = 'iris-button-styles'

const CSS = `
.iris-button {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--iris-gap-sm, 4px);
  font-family: inherit;
  font-weight: 500;
  line-height: 1.2;
  border-radius: var(--iris-radius-md, 6px);
  white-space: nowrap;
  user-select: none;
  position: relative;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    filter 120ms ease;
}
.iris-button:focus-visible {
  outline: 2px solid var(--iris-primary);
  outline-offset: 2px;
}
.iris-button[disabled],
.iris-button[aria-busy="true"] {
  cursor: not-allowed;
  opacity: 0.6;
}
.iris-button[data-iris-button-variant="solid"]:not([disabled]):not([aria-busy="true"]):hover {
  filter: brightness(1.08);
}
.iris-button[data-iris-button-variant="outline"]:not([disabled]):not([aria-busy="true"]):hover,
.iris-button[data-iris-button-variant="ghost"]:not([disabled]):not([aria-busy="true"]):hover {
  background-color: var(--iris-surface-hover);
}
.iris-button[data-iris-button-variant="link"]:not([disabled]):not([aria-busy="true"]):hover {
  text-decoration: underline;
}
.iris-button-leading {
  display: inline-flex;
  align-items: center;
}
.iris-button-spinner {
  width: 1em;
  height: 1em;
  display: inline-block;
  animation: iris-button-spin 0.7s linear infinite;
}
@keyframes iris-button-spin {
  to { transform: rotate(360deg); }
}
`

let installed = false

export function installButtonStyles(): void {
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

/** Test-only reset. Removes the injected `<style>` and clears the flag. */
export function __resetButtonStyles(): void {
  installed = false
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

/** Test-only inspection of the cached install flag. */
export const __BUTTON_STYLE_ID = STYLE_ID
