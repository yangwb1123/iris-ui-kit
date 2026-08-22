/** Batch BE: the 45° stripe background-image marking a locked cell — ONE
 * source shared by the injected stylesheet rule (interpolated into
 * TABLE_ROW_CSS below) and the inline cell style. The base cell path uses
 * background-COLOR longhands (fnrCellStyle), so the image survives; the
 * inline re-assertion (spread last in the render) additionally protects
 * against user/conditional `background` shorthands. Token-driven
 * (--iris-muted-subtle exists in both themes). */
export const LOCKED_CELL_STRIPE =
  'repeating-linear-gradient(45deg, var(--iris-muted-subtle) 0, var(--iris-muted-subtle) 6px, transparent 6px, transparent 12px)'

/** Batch BJ: the dotted 8pt-grid texture marking a permission-readonly cell —
 * visually distinct from locked's 45° stripes (dynamic permission vs static
 * declaration). Same background-image + inline re-assertion pattern as
 * LOCKED_CELL_STRIPE (a `background` shorthand resets background-image).
 * Token-driven (--iris-muted-subtle exists in both themes). */
export const READONLY_CELL_DOTS =
  'radial-gradient(var(--iris-muted-subtle) 1px, transparent 1px) 0 0 / 8px 8px'

export const TABLE_ROW_CSS = `
[data-iris-table]:not([data-iris-no-hover]) [role="row"]:hover {
  --iris-cell-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
/* Row edit mode (batch K): the row whose editors are open gets the same
   token-driven highlight as the selected/current row. */
[data-iris-table-row][data-iris-row-editing="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
[data-iris-table-context-menu] [role="menuitem"]:hover:not(:disabled) {
  background: var(--iris-surface-hover);
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
/* Batch CM summary sticky (iris 独有 — vxe has no summary sticky parity):
   with summaryRowStyle = 'sticky' the GLOBAL summary row sticks to the
   scroll container's bottom edge. Gated by fixed-height (the root is the
   scroll container); z-index 1 mirrors pinned columns (below the sticky
   header's z2). The row already carries an opaque --iris-surface background
   + 2px top border, so no inline style changes are needed. */
[data-iris-table-fixed-height] [data-iris-summary-sticky="true"] {
  position: sticky;
  bottom: 0;
  z-index: 1;
}
/* Lazy tree loading caret (batch J): keyframes can't be inline, so they live
   in the singleton stylesheet; opacity + spin use token-driven values. */
@keyframes iris-table-caret-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
[data-iris-table-tree-toggle][data-iris-tree-loading] {
  opacity: 0.55;
  animation: iris-table-caret-spin 900ms linear infinite;
}
/* Batch CL expand animation (iris 独有 — vxe has no expand animation): the
   detail panel / tree row plays a max-height + opacity ENTER transition on
   expand. Both endpoints force overflow hidden so content is never
   permanently clipped — the animation ends back at the base state. Cap and
   duration are token-driven with fallbacks (motion token precedent). */
@keyframes iris-table-expand-enter {
  from { max-height: 0; opacity: 0; overflow: hidden; }
  to { max-height: var(--iris-table-expand-max, 512px); opacity: 1; overflow: hidden; }
}
[data-iris-expand-anim="true"] {
  animation: iris-table-expand-enter var(--iris-duration-md, 200ms) ease-out;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-expand-anim="true"] {
    animation: none;
  }
}
@media print {
  [data-iris-table-tabs] {
    display: none !important;
  }
  [data-iris-table-toolbar] {
    display: none !important;
  }
  [data-iris-table-form] {
    display: none !important;
  }
  [data-iris-table][data-printable="true"] {
    border: none !important;
    box-shadow: var(--iris-shadow-none, none) !important;
  }
  [data-iris-scroll-hint] {
    display: none !important;
  }
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
/* Locked cells (batch BE, iris 独有 — vxe has no cell-lock concept): 45°
   diagonal stripes over the muted-subtle token (both themes define it) mark
   a read-only cell; the render additionally drops the cursor to not-allowed
   and sets data-iris-cell-locked. Background-IMAGE, so hover/selected row
   backgrounds (background-color) still show through, and the dirty dot /
   note badges (::after, absolute) stay visible on top. The render ALSO
   re-asserts the image inline, spread AFTER every background shorthand
   (see LOCKED_CELL_STRIPE). */
[data-iris-cell-locked="true"] {
  background-image: ${LOCKED_CELL_STRIPE};
}
/* Readonly cells (batch BJ, iris 独有): dotted 8pt texture — DYNAMIC
   permission (re-evaluated per render) vs locked's static 45° stripes; a
   cell that is both locked and readonly shows locked (locked wins). Same
   background-image + inline re-assertion pattern as the locked rule. */
[data-iris-cell-readonly="true"] {
  background-image: ${READONLY_CELL_DOTS};
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
/* Custom scrollbar thumb (batch DP): keep native scrolling/keyboard access but
   restyle the draggable thumb as a slim rounded token affordance. At rest the
   thumb is translucent primary (color-mix over the token — no hardcoded
   colors); hovering or dragging ramps it to full primary, the spec's hover
   color enhancement. Covers the root scroller and the virtual-scroll
   descendant. */
[data-iris-scrollbar-thumb="true"],
[data-iris-scrollbar-thumb="true"] [data-iris-virtual-scroll] {
  scrollbar-color: var(--iris-primary) transparent;
}
[data-iris-scrollbar-thumb="true"]::-webkit-scrollbar,
[data-iris-scrollbar-thumb="true"] [data-iris-virtual-scroll]::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
[data-iris-scrollbar-thumb="true"]::-webkit-scrollbar-thumb,
[data-iris-scrollbar-thumb="true"] [data-iris-virtual-scroll]::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--iris-primary) 60%, transparent);
  border-radius: var(--iris-radius-sm, 4px);
}
[data-iris-scrollbar-thumb="true"]::-webkit-scrollbar-thumb:hover,
[data-iris-scrollbar-thumb="true"] [data-iris-virtual-scroll]::-webkit-scrollbar-thumb:hover {
  background: var(--iris-primary);
}
/* Zoom overlay (batch U, vxe toolbar zoom parity): position: fixed pins
   the root as a fullscreen overlay — viewport inset, popover z-index,
   surface background, its own scroll. The root itself is a plain block
   (each ROW is its own CSS grid), so the internal grid layout is untouched
   — the rows keep their shared gridTemplateColumns and the sticky-header /
   scroll machinery engages via the inline height: 100%. Caveats: the
   form/toolbar/pager sections are fragment siblings OUTSIDE the root and
   stay in place; while zoomed the toolbar is lifted above the overlay
   (position relative + popover z-index + 1 inline, so its ✕ exit stays
   reachable — vxe keeps its toolbar inside the zoomed root, same effect),
   and position: fixed + height: 100% are forced inline so a caller-supplied
   style or zIndex prop cannot unpin the overlay. */
[data-iris-table][data-iris-table-zoomed] {
  position: fixed;
  inset: 0;
  z-index: var(--iris-z-popover, 1000);
  background: var(--iris-surface);
  overflow: auto;
}
/* Density presets (batch CP, iris 独有 — vxe has no density concept): a
   SIBLING of the size presets — both write the same --iris-cell-pad-y, so a
   density tier stacks ON TOP of the size tier (same specificity; where both
   live in one sheet the density rules come later and win). comfortable is
   the default and declares nothing (byte-identical to a bare table). */
[data-iris-table][data-density="compact"] {
  --iris-cell-pad-y: 6px;
}
[data-iris-table][data-density="cozy"] {
  --iris-cell-pad-y: 4px;
}
/* Batch DY column fade (iris 独有 — vxe has no show/hide transition): while a
   column show/hide fade is in flight the ROOT carries
   data-iris-column-fade-active, so (1) fading cells (data-iris-column-fade=
   "in|out") transition opacity and (2) every row's grid-template-columns
   transitions — the collapsing/expanding track animates instead of jumping
   (the rows all share the same gridTemplateColumns string). Both use the
   motion token with the 200ms fallback (batch-CL precedent). Scoping the
   grid-template transition to the in-flight window keeps LATER width changes
   (drag-resize / auto-fit) instantaneous — the gradient never lingers; the
   inline opacity: 0 rides ON the fading cell, so the attr alone is inert.
   The reduced-motion media block is a CSS backstop ON TOP of the JS skip
   (columnFade forces the machine off under prefers-reduced-motion). */
[data-iris-column-fade-active] [data-iris-column-fade] {
  transition: opacity var(--iris-duration-md, 200ms) ease;
}
[data-iris-column-fade-active] [role="row"] {
  transition: grid-template-columns var(--iris-duration-md, 200ms) ease;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-column-fade-active] [data-iris-column-fade],
  [data-iris-column-fade-active] [role="row"] {
    transition: none !important;
  }
}
`
