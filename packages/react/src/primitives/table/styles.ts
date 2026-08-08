import type React from 'react'

export const SELECTION_COL_WIDTH = 40
export const EXPAND_COL_WIDTH = 40
export const DEFAULT_PINNED_WIDTH = 140

/** Shared style for full-width empty / loading / error state rows. */
export const STATE_ROW_STYLE: React.CSSProperties = {
  padding: '32px 12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
}

export const BASE_CELL_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export const borderStyle = (bordered: boolean): string =>
  bordered ? '1px solid var(--iris-border)' : 'none'
export const TABLE_ROW_CSS = `
[data-iris-table] [role="row"]:hover {
  --iris-cell-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
`
