export const TABLE_STYLES = `
[data-iris-table] [role="row"]:hover {
  --iris-row-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
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
  --iris-row-bg: color-mix(in srgb, var(--iris-primary) 18%, var(--iris-background));
  background: color-mix(in srgb, var(--iris-primary) 18%, var(--iris-background));
}
`
