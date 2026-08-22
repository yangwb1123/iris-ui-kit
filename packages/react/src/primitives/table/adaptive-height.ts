import * as React from 'react'

/** Batch EC (iris 独有 — vxe autoHeight fills rows to the VIEWPORT, only this
 * feature releases the one-line clamp so DATA rows grow to their content):
 * the `data-iris-table-row` values that are NOT data rows — the reserved
 * roles sharing the attribute namespace with row keys. The CSS wrap rule
 * applies the SAME exclusion (a colliding key stays single-line). */
const ADAPTIVE_ROW_ATTR_SKIP = new Set(['header', 'summary', 'loading', 'empty', 'error'])

/** Batch EC: the inline height for a data row under `adaptiveRowHeight` — the
 * measured natural height from `measureAdaptiveRowHeights`, keyed by the SAME
 * identity `data-iris-table-row` carries. undefined when off / unmeasured /
 * skipped — natural content height (a pinned 0 would collapse it). `rowStyle`
 * (spread after) stays the per-row escape hatch. */
export const adaptiveHeightStyleOf = (
  key: string | number,
  heights: ReadonlyMap<string, number> | null | undefined,
): React.CSSProperties | undefined => {
  if (!heights) return undefined
  const h = heights.get(String(key))
  return h == null || h <= 0 ? undefined : { height: h }
}

/** Batch EC: walk a table root's DATA rows (same reserved-role exclusion as
 * the CSS wrap rule), read each rendered row's NATURAL `offsetHeight`, and
 * produce the next height map. Rows measuring `≤ 0` (jsdom/SSR/hidden) are
 * SKIPPED — never pinned at 0, natural height instead of a 0px collapse.
 * Same-as-previous → `previous` BY IDENTITY (caller bails — zero re-render
 * noise); otherwise a fresh map (stale keys from departed rows dropped).
 *
 * Clamp-feedback trap (review): reading a PINNED row's `offsetHeight` only
 * reads the pin back — later growth is clipped by the cells' inline
 * `overflow: hidden` and the row never shrinks, so every re-measure bails
 * and the row is frozen. Fix: clear the inline height (`'auto'`) BEFORE the
 * read so `offsetHeight` resolves the natural content height. Clears and
 * reads run in two passes so the whole scan costs ONE forced layout, and
 * pins are restored in place afterward — sibling layout effects in the same
 * commit still see the height map they expect. */
export const measureAdaptiveRowHeights = (
  root: HTMLElement,
  previous: ReadonlyMap<string, number> | null,
): ReadonlyMap<string, number> | null => {
  const rows: HTMLElement[] = []
  const pinned: [HTMLElement, string][] = []
  for (const row of root.querySelectorAll<HTMLElement>('[role="row"]')) {
    const value = row.getAttribute('data-iris-table-row')
    if (value == null || ADAPTIVE_ROW_ATTR_SKIP.has(value) || value.startsWith('footer-')) {
      continue
    }
    rows.push(row)
    // Only PINNED rows are trapped: they are already at natural height.
    const inline = row.style.height
    if (inline) {
      pinned.push([row, inline])
      row.style.height = 'auto'
    }
  }
  const next = new Map<string, number>()
  for (const row of rows) {
    const h = row.offsetHeight
    if (h <= 0) continue
    next.set(row.getAttribute('data-iris-table-row')!, h)
  }
  for (const [row, inline] of pinned) row.style.height = inline
  if (previous !== null && previous.size === next.size) {
    let same = true
    for (const [key, h] of next) {
      if (previous.get(key) !== h) {
        same = false
        break
      }
    }
    if (same) return previous
  }
  return next
}
