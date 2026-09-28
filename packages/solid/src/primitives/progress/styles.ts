import { PROGRESS_STYLES } from '@iris-ui-kit/core'

export const __PROGRESS_STYLE_ID = 'iris-progress-styles'

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
  el.textContent = PROGRESS_STYLES
  document.head.appendChild(el)
  installed = true
}

export function __resetProgressStyles(): void {
  installed = false
  if (typeof document !== 'undefined') {
    document.getElementById(__PROGRESS_STYLE_ID)?.remove()
  }
}
