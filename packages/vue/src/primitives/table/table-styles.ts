const TABLE_STYLE_ID = 'iris-table-row-styles'
const TABLE_FADE_STYLE_ID = 'iris-table-column-fade-styles-vue'

const TABLE_STYLES = `
[data-iris-table] [role="row"]:hover {
  --iris-cell-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
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
`

const TABLE_FADE_STYLES = `
[data-iris-column-fade-active] [data-iris-column-fade] {
  transition: opacity var(--iris-duration-md, 200ms) ease;
}
[data-iris-column-fade-active] [role="row"],
[data-iris-column-fade-active][role="row"] {
  transition: grid-template-columns var(--iris-duration-md, 200ms) ease;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-column-fade-active] [data-iris-column-fade],
  [data-iris-column-fade-active][data-iris-column-fade],
  [data-iris-column-fade-active] [role="row"],
  [data-iris-column-fade-active][role="row"] {
    transition: none !important;
  }
}
`

export function ensureTableStyles(includeFade = false): void {
  if (typeof document === 'undefined') return
  if (!document.getElementById(TABLE_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = TABLE_STYLE_ID
    style.textContent = TABLE_STYLES
    document.head.appendChild(style)
  }
  if (!includeFade) return
  // Keep the fade rules independent from the shared base style id. Another
  // adapter may have inserted that id first in an application document.
  if (!document.getElementById(TABLE_FADE_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = TABLE_FADE_STYLE_ID
    style.textContent = TABLE_FADE_STYLES
    document.head.appendChild(style)
  }
}
