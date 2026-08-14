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
  padding: 'var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)',
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export const borderStyle = (bordered: boolean): string =>
  bordered ? '1px solid var(--iris-border)' : 'none'

/* Range-stats panel (batch AJ, iris 独有): rendered INSIDE the floating bar
   container (which is position:absolute via useFloating, so an absolutely
   positioned child anchors to it) and dropped BELOW the bar with a small
   gap. Mini table — a header row + one row per range column — so the shared
   header/row/cell styles are kept here next to the other table styles. */
export const RANGE_STATS_PANEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + var(--iris-space-xxs, 4px))',
  left: 0,
  minWidth: '100%',
  background: 'var(--iris-surface-floating, var(--iris-surface))',
  color: 'var(--iris-foreground)',
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  boxShadow: 'var(--iris-shadow-lg)',
  padding: 'var(--iris-space-xxs, 4px)',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  whiteSpace: 'nowrap',
}

export const RANGE_STATS_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--iris-space-sm, 12px)',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
}

export const RANGE_STATS_HEADER_STYLE: React.CSSProperties = {
  ...RANGE_STATS_ROW_STYLE,
  color: 'var(--iris-muted)',
  fontWeight: 600,
}

export const RANGE_STATS_ROW_DIVIDER_STYLE: React.CSSProperties = {
  ...RANGE_STATS_ROW_STYLE,
  borderTop: '1px solid var(--iris-border)',
}

export const RANGE_STATS_LABEL_STYLE: React.CSSProperties = {
  minWidth: 96,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export const RANGE_STATS_VALUE_STYLE: React.CSSProperties = {
  minWidth: 64,
  textAlign: 'right',
}

/* Batch AQ drag fill (iris 独有 — vxe has no fill parity): the 6px primary
   square rendered inside the range's bottom-right cell (data-iris-range-fill).
   Positioned right/bottom with a small offset per the batch AQ fiat; the host
   cell gains position: relative + zIndex 2 so the handle anchors to it and
   stays above pinned sticky cells (zIndex 1). Pointer-dragging it DOWN/RIGHT
   cyclically fills the target rectangle and extends the range. */
export const RANGE_FILL_HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 2,
  bottom: 2,
  width: 6,
  height: 6,
  background: 'var(--iris-primary)',
  cursor: 'crosshair',
  zIndex: 3,
}

/* Batch AQ: cells between the range edge and the drag end (excluding the
   source range) while the handle is being dragged — token-driven only. */
export const RANGE_FILL_TARGET_BG = 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
export const TABLE_ROW_CSS = `
[data-iris-table]:not([data-iris-no-hover]) [role="row"]:hover {
  --iris-cell-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
[data-iris-row-current="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
[data-iris-col-current="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
/* Fixed height (batch N): the root becomes the scroll container; the header
   row (flat AND grouped variants both carry data-iris-table-row="header") stays
   visible with a sticky position. z-index 2 keeps it above pinned body cells
   (zIndex 1 via pinnedStyle). */
[data-iris-table-fixed-height] [data-iris-table-row="header"] {
  position: sticky;
  top: 0;
  z-index: 2;
}
/* Size presets (vxe-grid size parity: medium / small / mini). */
[data-iris-table][data-size="small"] {
  --iris-cell-pad-y: 4px;
  font-size: var(--iris-font-size-sm, 13px);
}
[data-iris-table][data-size="mini"] {
  --iris-cell-pad-y: 2px;
  font-size: var(--iris-font-size-xs, 12px);
}
/* Dirty-cell dot (batch Q, vxe editDirtyConfig parity): a small primary dot
   at the cell's inline-end corner marks a committed cell whose value differs
   from its pre-edit original; the cell itself gets position: relative from
   the render so the dot anchors to it. Logical inset-inline-end mirrors the
   dot in RTL instead of pinning it to the physical right edge. */
[data-iris-cell-dirty]::after {
  content: '';
  position: absolute;
  top: 4px;
  inset-inline-end: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--iris-primary);
}
/* Thin scrollbars (batch Q, vxe scrollbarConfig parity): 6px webkit
   scrollbars + Firefox scrollbar-width; covers the root scroller and the
   virtual-scroll descendant. */
[data-iris-scrollbar-thin="true"],
[data-iris-scrollbar-thin="true"] [data-iris-virtual-scroll] {
  scrollbar-width: thin;
  scrollbar-color: var(--iris-border) transparent;
}
[data-iris-scrollbar-thin="true"]::-webkit-scrollbar,
[data-iris-scrollbar-thin="true"] [data-iris-virtual-scroll]::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
[data-iris-scrollbar-thin="true"]::-webkit-scrollbar-thumb,
[data-iris-scrollbar-thin="true"] [data-iris-virtual-scroll]::-webkit-scrollbar-thumb {
  background: var(--iris-border);
}
[data-iris-scrollbar-thin="true"]::-webkit-scrollbar-thumb:hover,
[data-iris-scrollbar-thin="true"] [data-iris-virtual-scroll]::-webkit-scrollbar-thumb:hover {
  background: var(--iris-primary);
}
`
