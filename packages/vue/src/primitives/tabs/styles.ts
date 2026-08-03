const STYLE_ID = 'iris-tabs-styles'

const CSS = `
:where(.iris-tabs-list) {
  display: flex;
  gap: 2px;
}
:where(.iris-tabs-list[data-orientation="horizontal"]) {
  flex-direction: row;
  border-bottom: 1px solid var(--iris-border);
}
:where(.iris-tabs-list[data-orientation="vertical"]) {
  flex-direction: column;
  border-inline-end: 1px solid var(--iris-border);
}
:where(.iris-tabs-trigger) {
  padding: 8px var(--iris-padding-md);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  opacity: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--iris-muted);
  transition: color 120ms ease, border-color 120ms ease;
}
:where(.iris-tabs-trigger[data-orientation="horizontal"]) {
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
}
:where(.iris-tabs-trigger[data-orientation="vertical"]) {
  margin-inline-end: -1px;
  border-inline-end: 2px solid transparent;
}
:where(.iris-tabs-trigger[data-state="active"]) {
  color: var(--iris-primary);
}
:where(.iris-tabs-trigger[data-state="active"][data-orientation="horizontal"]) {
  border-bottom-color: var(--iris-primary);
}
:where(.iris-tabs-trigger[data-state="active"][data-orientation="vertical"]) {
  border-inline-end-color: var(--iris-primary);
}
:where(.iris-tabs-trigger[data-disabled]) {
  cursor: not-allowed;
  opacity: 0.5;
}
:where(.iris-tabs-trigger:focus-visible) {
  outline: 2px solid var(--iris-focus-ring, var(--iris-primary));
  outline-offset: 2px;
}
`.trim()

let installed = false

export function installTabsStyles(): void {
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

/** Test-only reset. Removes the injected stylesheet and clears the flag. */
export function __resetTabsStyles(): void {
  installed = false
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

/** Test-only inspection of the singleton style element id. */
export const __TABS_STYLE_ID = STYLE_ID
