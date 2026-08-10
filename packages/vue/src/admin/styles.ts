export const __NAV_MENU_STYLE_ID = 'iris-nav-menu-styles'

const CSS = `
:where(.iris-nav-menu) {
  --iris-nav-indent-step: 16px;
  --iris-nav-item-padding-inline: 12px;
  --iris-nav-item-padding-block: 8px;
  --iris-nav-item-border-radius: var(--iris-radius-md, 6px);
  --iris-nav-item-hover: var(--iris-surface-hover, var(--iris-surface));
  --iris-nav-item-height: 34px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--iris-space-xxs, 4px);
  width: 100%;
}

:where(.iris-nav-menu--horizontal) {
  flex-direction: row;
  align-items: center;
  width: auto;
}

:where(.iris-nav-menu-group) {
  position: relative;
}

:where(.iris-nav-menu-item) {
  appearance: none;
  box-sizing: border-box;
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  width: 100%;
  min-height: var(--iris-nav-item-height);
  border: none;
  border-radius: var(--iris-nav-item-border-radius);
  background: transparent;
  color: var(--iris-foreground);
  font: inherit;
  font-size: var(--iris-font-size-md, 14px);
  line-height: 1.2;
  font-weight: 400;
  text-align: start;
  cursor: pointer;
  opacity: 1;
  margin: 0;
  gap: var(--iris-space-sm, 12px);
  padding-block: var(--iris-nav-item-padding-block);
  padding-inline: var(--iris-nav-item-padding-inline);
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where(.iris-nav-menu--horizontal > .iris-nav-menu-group > .iris-nav-menu-item) {
  width: auto;
  padding-inline-start: var(--iris-nav-item-padding-inline);
}

:where(.iris-nav-menu-item[data-depth='0']) {
  --iris-nav-item-padding-inline-start: 12px;
}

:where(.iris-nav-menu-item[data-depth='1']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step));
}

:where(.iris-nav-menu-item[data-depth='2']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 2);
}

:where(.iris-nav-menu-item[data-depth='3']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 3);
}

:where(.iris-nav-menu-item[data-depth='4']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 4);
}

:where(.iris-nav-menu-item[data-depth='5']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 5);
}

:where(.iris-nav-menu-item[data-depth='6']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 6);
}

:where(.iris-nav-menu-item[data-depth='7']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 7);
}

:where(.iris-nav-menu-item[data-depth='8']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 8);
}

:where(.iris-nav-menu-item[data-depth='9']) {
  --iris-nav-item-padding-inline-start: calc(12px + var(--iris-nav-indent-step) * 9);
}

:where(.iris-nav-menu--vertical .iris-nav-menu-item[data-depth]) {
  padding-inline-start: var(--iris-nav-item-padding-inline-start);
}

:where(.iris-nav-menu-item:hover),
:where(.iris-nav-menu-item.is-hovered):not([disabled], .is-disabled) {
  background: var(--iris-nav-item-hover);
}

.iris-nav-menu-item[data-active='true'] {
  background: var(--iris-primary);
  color: var(--iris-primary-foreground, #fff);
  font-weight: 600;
}

:where(.iris-nav-menu-item[data-active-trail='true']) {
  color: var(--iris-primary);
  font-weight: 600;
}

:where(.iris-nav-menu-item[disabled], .iris-nav-menu-item.is-disabled) {
  cursor: not-allowed;
  opacity: 0.5;
}

:where(.iris-nav-menu-item:focus-visible) {
  outline: 2px solid var(--iris-ring, var(--iris-primary));
  outline-offset: 1px;
}

:where(.iris-nav-menu-label) {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

:where(.iris-nav-menu-badge) {
  margin-inline-start: var(--iris-space-xs, 8px);
  font-size: var(--iris-font-size-xs, 12px);
  line-height: 1;
  padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px);
  border-radius: 999px;
  background: var(--iris-danger, #ef4444);
  color: var(--iris-primary-foreground, #fff);
  flex: 0 0 auto;
}

:where(.iris-nav-menu-arrow) {
  flex: 0 0 auto;
  opacity: 0.6;
  transform: rotate(0deg);
  transform-origin: center;
  transition: transform 160ms ease;
  margin-inline-start: auto;
}

:where(.iris-nav-menu-arrow[data-reversed='true']) {
  transform: rotate(180deg);
}

:where(.iris-nav-menu-fallback-icon) {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

:where(.iris-nav-menu-item.is-disabled) .iris-nav-menu-label {
  opacity: 0.75;
}

/* Vertical branches stay in the DOM and animate height via the grid-rows
   trick (0fr → 1fr); the inner wrapper provides the overflow clipping so the
   transition is a smooth accordion without a max-height cap. */
:where(.iris-nav-menu--vertical .iris-nav-menu-group > .iris-nav-menu-children) {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 200ms ease,
    opacity 150ms ease,
    visibility 0s linear 200ms;
}

:where(.iris-nav-menu--vertical .iris-nav-menu-group > .iris-nav-menu-children > .iris-nav-menu-children-inner) {
  overflow: hidden;
  min-height: 0;
}

:where(.iris-nav-menu--vertical .iris-nav-menu-group[data-open='true'] > .iris-nav-menu-children) {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 200ms ease,
    opacity 150ms ease;
}

/* Flyout popups (horizontal mode + the collapsed rail) share the popup chrome
   and are hard-hidden when closed (no height animation needed). */
:where(.iris-nav-menu--horizontal .iris-nav-menu-group > .iris-nav-menu-children),
:where(.iris-nav-menu--collapsed .iris-nav-menu-group > .iris-nav-menu-children) {
  display: none;
  position: absolute;
  min-width: 220px;
  padding: var(--iris-space-xs, 8px);
  border: 1px solid var(--iris-border);
  border-radius: var(--iris-radius-md, 6px);
  background: var(--iris-surface);
  box-shadow: var(--iris-shadow-md);
}

:where(.iris-nav-menu--horizontal .iris-nav-menu-group[data-open='true'] > .iris-nav-menu-children),
:where(.iris-nav-menu--collapsed .iris-nav-menu-group[data-open='true'] > .iris-nav-menu-children) {
  display: block;
}

:where(.iris-nav-menu--horizontal .iris-nav-menu-group[data-depth='0'] > .iris-nav-menu-children) {
  inset-block-start: 100%;
  inset-inline-start: 0;
  z-index: 60;
}

/* A9: the collapsed rail popup opens to the right of the icon. */
:where(.iris-nav-menu--collapsed .iris-nav-menu-group[data-depth='0'] > .iris-nav-menu-children) {
  inset-block-start: 0;
  inset-inline-start: 100%;
  z-index: 60;
}

:where(.iris-nav-menu--horizontal .iris-nav-menu-group[data-depth]:not([data-depth='0']) > .iris-nav-menu-children),
:where(.iris-nav-menu--collapsed .iris-nav-menu-group[data-depth]:not([data-depth='0']) > .iris-nav-menu-children) {
  inset-block-start: 0;
  inset-inline-start: 100%;
  z-index: 61;
}

:where(.iris-nav-menu--collapsed .iris-nav-menu-item) {
  justify-content: center;
  padding-inline-start: var(--iris-nav-item-padding-inline);
}

:where(.iris-nav-menu-item.is-collapsed) {
  justify-content: center;
  padding-inline: var(--iris-nav-item-padding-inline);
}

/* A9: the collapsed rail stays centered even though rows carry data-depth
   (the vertical indent rules would otherwise win the specificity tie). */
:where(.iris-nav-menu--collapsed .iris-nav-menu-item[data-depth]) {
  justify-content: center;
  padding-inline: var(--iris-nav-item-padding-inline);
}

@media (prefers-reduced-motion: reduce) {
  :where(.iris-nav-menu-arrow) {
    transition: none;
  }
  :where(.iris-nav-menu--vertical .iris-nav-menu-group > .iris-nav-menu-children) {
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
