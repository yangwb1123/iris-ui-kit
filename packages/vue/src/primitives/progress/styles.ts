export const __PROGRESS_STYLE_ID = 'iris-progress-styles'

const CSS = `
@keyframes iris-progress-indeterminate {
  0%   { left: -40%; right: 100%; }
  60%  { left: 100%; right: -20%; }
  100% { left: 100%; right: -20%; }
}
[data-iris-progress] {
  position: relative;
  overflow: hidden;
  background: var(--iris-surface);
  border-radius: 9999px;
}
[data-iris-progress-bar] {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: 9999px;
  transition: width 200ms ease;
}
[data-iris-progress][data-state="indeterminate"] [data-iris-progress-bar] {
  width: auto;
  right: 100%;
  animation: iris-progress-indeterminate 1.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-progress][data-state="indeterminate"] [data-iris-progress-bar] {
    animation: none;
    right: 50%;
    left: 0;
  }
}
`.trim()

let installed = false

export function installProgressStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(__PROGRESS_STYLE_ID)) {
    installed = true
    return
  }
  const el = document.createElement('style')
  el.id = __PROGRESS_STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
  installed = true
}

export function __resetProgressStyles(): void {
  installed = false
  if (typeof document !== 'undefined') {
    document.getElementById(__PROGRESS_STYLE_ID)?.remove()
  }
}
