export const DATA_STATE_CLASS = 'iris-data-state-enter'
export const __DATA_STATE_STYLE_ID = 'iris-data-state-styles'

const CSS = `
@keyframes iris-data-state-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
.${DATA_STATE_CLASS} {
  animation: iris-data-state-enter var(--iris-duration-md, 200ms) ease;
}
@media (prefers-reduced-motion: reduce) {
  .${DATA_STATE_CLASS} { animation: none; }
}
`.trim()

let installed = false

export function installDataStateStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(__DATA_STATE_STYLE_ID)) {
    installed = true
    return
  }
  const el = document.createElement('style')
  el.id = __DATA_STATE_STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
  installed = true
}
