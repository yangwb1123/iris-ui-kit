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

/* Batch AZ cell annotations (iris 独有 — vxe has no cell-note concept): the
   6px corner badge rendered inside a noted body cell (data-iris-cell-note).
   Absolute top-right (logical inset-inline-end mirrors in RTL); the host
   cell gains position: relative from the render (note case only), so the
   badge anchors to the cell box — inside a pinned (position: sticky) cell
   the sticky box is the containing block and the badge positions against it
   (pinnedStyle's sticky overrides the relative, which is exactly what we
   want). Warning token with primary fallback (the codebase's existing
   token-with-fallback pattern). */
export const CELL_NOTE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  insetInlineEnd: 0,
  width: 6,
  height: 6,
  background: 'var(--iris-warning, var(--iris-primary))',
}

/* Batch BD collaborative presence (iris 独有 — vxe has no cursor sharing):
   the tiny corner name label rendered inside a presence cell
   (data-iris-presence). Anchors top-left (logical inset-inline-start mirrors
   in RTL); the host cell gains position: relative + a 2px outline (the
   entry's color verbatim — a data color, not a token) from the render.
   Type/size/spacing are token-driven; the background is the entry's color
   verbatim (data exception — batch BD fiat 4), the text uses the foreground
   token with the codebase's existing fallback pattern. Labels are
   pointer-transparent so they never intercept cell clicks. */
export const PRESENCE_LABEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  insetInlineStart: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '0 var(--iris-space-xxs, 4px)',
  fontSize: 'var(--iris-font-size-xs, 12px)',
  lineHeight: 1.4,
  color: 'var(--iris-primary-foreground, #fff)',
  pointerEvents: 'none',
}
/* Batch BU table watermark (iris 独有 — vxe has no watermark concept): the
   rotated tiled text layer rendered INSIDE the table root when `watermark` is
   set. DOM shape mirrors the standalone IrisWatermark primitive (wrapper
   `data-iris-watermark` → overlay `data-iris-watermark-overlay` → tiles
   `data-iris-watermark-tile`) so a global `[data-iris-watermark]` selector
   matches one element shape everywhere. The table variant is embedded in the
   scroll container itself, so the wrapper is a STICKY FIRST CHILD (the root
   is the scroll container): at the content top its normal position is the
   scrollport top, so `top: 0; left: 0; height: 100%` pins it to the scroll
   viewport from scroll 0 — the watermark stays put while rows scroll beneath
   (absolute inset-0 on the scroll container root — or sticky rendered after
   the rows — would scroll away with the content). Plain stacking
   (positioned z-auto) keeps it above static rows / footer / pager but BELOW
   the sticky header (z 2), pinned columns (z 1) and floating panels.
   Token-driven: muted color, space-xl gap, font-size-lg tiles.
   pointer-events/user-select none + aria-hidden make it a pure display layer
   that never intercepts input or a11y. */
export const WATERMARK_WRAPPER_STYLE: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  left: 0,
  height: '100%',
  pointerEvents: 'none',
  userSelect: 'none',
}
export const WATERMARK_OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  userSelect: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  alignContent: 'flex-start',
  gap: 'var(--iris-space-xl, 24px)',
  opacity: 0.15,
}
export const WATERMARK_TILE_STYLE: React.CSSProperties = {
  transform: 'rotate(-22deg)',
  fontSize: 'var(--iris-font-size-lg, 16px)',
  color: 'var(--iris-muted)',
  whiteSpace: 'nowrap',
  lineHeight: 1,
}
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
/* Compare view (batch AU, iris 独有 — vxe has no compare): added / removed /
   changed rows tint the FULL row (the background shows through the transparent
   cells) and feed the shared --iris-cell-bg var for the gutter cells — the
   same highlight mechanism as hover/selected. Token-only: changed →
   --iris-surface-selected; added → success tint; removed → danger tint, both
   via color-mix over the background token (no magic rgba — engines without
   color-mix fall back to the inherited row background, documented). */
[data-iris-row-changed="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
  background: var(--iris-surface-selected);
}
[data-iris-row-added="true"] {
  --iris-cell-bg: color-mix(in srgb, var(--iris-success) 12%, var(--iris-background));
  background: color-mix(in srgb, var(--iris-success) 12%, var(--iris-background));
}
[data-iris-row-removed="true"] {
  --iris-cell-bg: color-mix(in srgb, var(--iris-danger) 12%, var(--iris-background));
  background: color-mix(in srgb, var(--iris-danger) 12%, var(--iris-background));
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
