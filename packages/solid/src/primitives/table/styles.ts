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
