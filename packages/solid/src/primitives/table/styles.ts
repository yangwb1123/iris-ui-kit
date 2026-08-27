import type { JSX } from 'solid-js'

export const DEFAULT_COL_WIDTH = 140
export const DEFAULT_MIN_WIDTH = 60
export const RESIZE_STEP = 16

/** Shared style for full-width empty / loading / error state rows. */
export const STATE_ROW_STYLE: JSX.CSSProperties = {
  padding: '32px 12px',
  'text-align': 'center',
  color: 'var(--iris-muted)',
}

export const BASE_CELL_STYLE: JSX.CSSProperties = {
  padding: '8px 12px',
  display: 'flex',
  'align-items': 'center',
  'min-width': 0,
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
}

const TABLE_STYLE_ID = 'iris-table-row-styles'
const TABLE_FADE_STYLE_ID = 'iris-table-column-fade-styles-solid'

const TABLE_STYLES = `
[data-iris-table] [role="row"]:hover {
  --iris-row-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-row-bg: var(--iris-surface-selected);
}
/* Row edit mode (vxe editConfig.mode parity): the row whose editors are
   open gets the same token-driven highlight as the selected row. */
[data-iris-table-row][data-iris-row-editing="true"] {
  --iris-row-bg: var(--iris-surface-selected);
}
@media print { [data-iris-table-tabs], [data-iris-table-toolbar], [data-iris-table-form], [data-iris-scroll-hint] { display: none !important; } [data-iris-table][data-printable="true"] { border: none !important; box-shadow: var(--iris-shadow-none, none) !important; } }
[data-iris-table][data-density="compact"] [data-iris-table-cell],
[data-iris-table][data-density="compact"] [data-iris-table-header],
[data-iris-table][data-density="compact"] [data-iris-table-summary-cell],
[data-iris-table][data-density="compact"] [data-iris-table-footer-cell] { padding-block: 6px !important; }
[data-iris-table][data-density="cozy"] [data-iris-table-cell],
[data-iris-table][data-density="cozy"] [data-iris-table-header],
[data-iris-table][data-density="cozy"] [data-iris-table-summary-cell],
[data-iris-table][data-density="cozy"] [data-iris-table-footer-cell] { padding-block: 4px !important; }
[data-iris-row-target="true"] {
  --iris-cell-bg: color-mix(in srgb, var(--iris-primary) 18%, var(--iris-background));
  background: color-mix(in srgb, var(--iris-primary) 18%, var(--iris-background));
}
/* Lazy tree loading caret (vxe lazyLoad parity, batch J): keyframes can't
   be inline, so they live in the singleton stylesheet; opacity + spin use
   token-driven values. */
@keyframes iris-table-caret-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
[data-iris-table-tree-toggle][data-iris-tree-loading] {
  opacity: 0.55;
  animation: iris-table-caret-spin 900ms linear infinite;
}
[data-iris-table-context-menu] [role="menuitem"]:hover:not(:disabled) {
  background: var(--iris-surface-hover);
}
`

/** CSS-only part of the column fade; the data attribute keeps it inert when off. */
const COLUMN_FADE_CSS = `
[data-iris-column-fade-active] [data-iris-column-fade] {
  transition: opacity var(--iris-duration-md, 200ms) ease;
}
[data-iris-column-fade-active] [role="row"],
[data-iris-column-fade-active][role="row"] {
  transition: grid-template-columns var(--iris-duration-md, 200ms) ease;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-column-fade-active] [data-iris-column-fade],
  [data-iris-column-fade-active] [role="row"],
  [data-iris-column-fade-active][role="row"] {
    transition: none !important;
  }
}
`

/** Install Solid's base table styles and its independent optional fade sheet. */
export function ensureTableStyles(includeFade = false): void {
  if (typeof document === 'undefined') return
  if (!document.getElementById(TABLE_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = TABLE_STYLE_ID
    style.textContent = TABLE_STYLES
    document.head.appendChild(style)
  }
  if (!includeFade || document.getElementById(TABLE_FADE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = TABLE_FADE_STYLE_ID
  style.textContent = COLUMN_FADE_CSS
  document.head.appendChild(style)
}
