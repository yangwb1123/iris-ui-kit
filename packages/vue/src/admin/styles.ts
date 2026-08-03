export const __NAV_MENU_STYLE_ID = 'iris-nav-menu-styles'

const CSS = `
:where(.iris-nav-menu-arrow) {
  flex: 0 0 auto;
  opacity: 0.6;
  transform: rotate(0deg);
  transform-origin: center;
  transition: transform 160ms ease;
}
:where(.iris-nav-menu-arrow[data-reversed="true"]) {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  :where(.iris-nav-menu-arrow) {
    transition: none;
  }
}
`.trim()

let installed = false

export function installNavMenuStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(__NAV_MENU_STYLE_ID)) {
    installed = true
    return
  }
  const style = document.createElement('style')
  style.id = __NAV_MENU_STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  installed = true
}

/** Test-only: remove the singleton stylesheet and reset installation state. */
export function __resetNavMenuStyles(): void {
  installed = false
  if (typeof document !== 'undefined') {
    document.getElementById(__NAV_MENU_STYLE_ID)?.remove()
  }
}
