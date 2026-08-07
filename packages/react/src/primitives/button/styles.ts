/**
 * Singleton stylesheet for the React `IrisButton`. Functionally identical to
 * the one in `@iris-ui-kit/vue` — both adapters end up writing the same DOM with
 * the same selectors, so the same CSS works. (Were we to ship both adapters
 * on the same page, the second installation would no-op because the
 * `<style id>` is shared.)
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
.iris-button[data-iris-button-variant="solid"]:not([disabled]):not([aria-busy="true"]):hover,
.iris-button[data-iris-button-variant="danger"]:not([disabled]):not([aria-busy="true"]):hover {
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

/** Test-only reset. */
export function __resetButtonStyles(): void {
  installed = false
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

export const __BUTTON_STYLE_ID = STYLE_ID
