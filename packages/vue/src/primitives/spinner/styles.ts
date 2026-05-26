export const __SPINNER_STYLE_ID = 'iris-spinner-styles'

const CSS = `
@keyframes iris-spinner-rotate {
  to { transform: rotate(360deg); }
}
[data-iris-spinner] {
  display: inline-block;
  animation: iris-spinner-rotate 0.9s linear infinite;
  vertical-align: middle;
}
[data-iris-spinner] > circle {
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 60 200;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-spinner] {
    animation: none;
  }
  [data-iris-spinner] > circle {
    stroke-dasharray: 0;
  }
}
`.trim()

let installed = false

export function installSpinnerStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(__SPINNER_STYLE_ID)) {
    installed = true
    return
  }
  const el = document.createElement('style')
  el.id = __SPINNER_STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
  installed = true
}

/** Test-only: reset and remove the injected stylesheet. */
export function __resetSpinnerStyles(): void {
  installed = false
  if (typeof document !== 'undefined') {
    document.getElementById(__SPINNER_STYLE_ID)?.remove()
  }
}
