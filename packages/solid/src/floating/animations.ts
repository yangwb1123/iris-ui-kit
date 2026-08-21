/**
 * Shared floating-layer entrance animations (P3: aesthetic review).
 *
 * Injects one global stylesheet with the @keyframes and CSS variables that
 * the overlay components (Dialog / Popover / Toast / Tooltip) reference via
 * `animation: var(--iris-anim-*)`. `prefers-reduced-motion` flips the
 * variables to `none`, so overlays degrade to instant appearance.
 */
const STYLE_ID = 'iris-floating-animations'
let installed = false

export const ANIM_DIALOG = 'var(--iris-anim-dialog)'
export const ANIM_POPOVER = 'var(--iris-anim-popover)'
export const ANIM_TOAST = 'var(--iris-anim-toast)'
export const ANIM_TOOLTIP = 'var(--iris-anim-tooltip)'

const ANIMATION_CSS = `
:root {
  --iris-anim-dialog: iris-dialog-in 150ms ease-out;
  --iris-anim-popover: iris-popover-in 150ms ease-out;
  --iris-anim-toast: iris-toast-in 200ms ease-out;
  --iris-anim-tooltip: iris-tooltip-in 120ms ease-out;
}
/* Fade-only keyframes preserve Floating UI's inline translate3d position. */
@keyframes iris-dialog-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes iris-popover-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes iris-toast-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes iris-tooltip-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  :root {
    --iris-anim-dialog: none;
    --iris-anim-popover: none;
    --iris-anim-toast: none;
    --iris-anim-tooltip: none;
  }
}
[data-iris-tabs-trigger]:focus-visible,
[data-iris-switch]:focus-visible,
[data-iris-checkbox]:focus-visible,
[data-iris-select-trigger]:focus-visible,
[data-iris-segmented-item]:focus-visible,
[data-iris-menu-item]:focus-visible,
[data-iris-nav-menu-item]:focus-visible {
  outline: 2px solid var(--iris-primary);
  outline-offset: 2px;
}
`

export function installFloatingAnimations(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = ANIMATION_CSS
  document.head.appendChild(style)
}
