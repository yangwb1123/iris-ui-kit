/** Framework-agnostic cell-span projection for grid body renderers. */

/** Coordinates supplied to a table's span callback. */
export interface GridSpanMethodParams {
  readonly rowIndex: number
  readonly columnIndex: number
}

/** A span callback's authored result. */
export interface GridSpan {
  readonly rowspan?: number
  readonly colspan?: number
}

export type GridSpanMethod = (params: GridSpanMethodParams) => GridSpan | null | undefined

/** A resolved span with the same lower-case fields used by table APIs. */
export interface ResolvedGridSpan {
  readonly rowspan: number
  readonly colspan: number
}

function normalizeSpanSize(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 1) return 1
  return Math.floor(value)
}

/**
 * Resolve one cell and update the pass-local occupancy set. A covered cell is
 * returned as `null`; otherwise the callback is called exactly once and its
 * authored dimensions are returned. The set is supplied by the adapter so a
 * renderer can keep its existing render-pass lifetime and virtual-column
 * visibility policy.
 */
export function resolveGridSpan(
  occupied: Set<string>,
  rowIndex: number,
  columnIndex: number,
  method?: GridSpanMethod,
): ResolvedGridSpan | null {
  if (!method) return { rowspan: 1, colspan: 1 }
  const key = `${rowIndex}:${columnIndex}`
  if (occupied.has(key)) return null

  const span = method({ rowIndex, columnIndex })
  const rowspan = normalizeSpanSize(span?.rowspan)
  const colspan = normalizeSpanSize(span?.colspan)
  if (rowspan > 1) {
    for (let row = 1; row < rowspan; row += 1) {
      occupied.add(`${rowIndex + row}:${columnIndex}`)
    }
  }
  if (Number.isFinite(colspan) && colspan > 1) {
    for (let column = 1; column < colspan; column += 1) {
      occupied.add(`${rowIndex}:${columnIndex + column}`)
    }
  }
  return { rowspan, colspan }
}

export interface GridSpanPlan {
  readonly occupied: Set<string>
  readonly spans: Map<string, ResolvedGridSpan>
}

/**
 * Build a complete row-major span plan. Covered cells are not passed to the
 * callback, matching the incremental renderer contract. This is useful for
 * adapters whose reactive render pass needs a stable plan before producing
 * keyed/virtual DOM.
 */
export function computeGridSpanPlan(
  rowCount: number,
  columnCount: number,
  method: GridSpanMethod,
): GridSpanPlan {
  const occupied = new Set<string>()
  const spans = new Map<string, ResolvedGridSpan>()
  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const key = `${row}:${column}`
      const span = resolveGridSpan(occupied, row, column, method)
      if (span === null) continue
      if (span.rowspan > 1 || span.colspan > 1) spans.set(key, span)
    }
  }
  return { occupied, spans }
}
