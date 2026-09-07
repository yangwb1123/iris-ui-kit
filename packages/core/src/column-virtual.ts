import { computeVirtualRange } from './virtual'

/** Framework-agnostic inputs for a horizontally virtualized column window. */
export interface ColumnVirtualizationOptions<Column> {
  /** Columns in their rendered order. */
  readonly columns: readonly Column[]
  /** Horizontal scroll offset in pixels. */
  readonly scrollOffset: number
  /** Width of the horizontal viewport in pixels. */
  readonly viewportSize: number
  /** Numeric width estimate for a column. */
  readonly itemSize: (column: Column, index: number) => number
  /** Columns that must remain mounted outside the calculated window. */
  readonly isAlwaysVisible?: (column: Column, index: number) => boolean
  /** Extra columns rendered on either side of the viewport. Defaults to 2. */
  readonly buffer?: number
}

/**
 * Compute the leaf-column indices that should remain mounted.
 *
 * The result is `null` when the feature is disabled, otherwise it contains the
 * virtual range (with overscan) plus any pinned/fading columns supplied by the
 * caller. Invalid size estimates fail closed to the full column set so a
 * malformed width cannot poison the cumulative virtual offsets with
 * `NaN`/`Infinity` or hide an arbitrary column.
 */
export function computeVisibleColumnIndices<Column>(
  enabled: boolean,
  options: ColumnVirtualizationOptions<Column>,
): Set<number> | null {
  if (!enabled) return null

  const { columns, scrollOffset, viewportSize, itemSize, isAlwaysVisible, buffer = 2 } = options
  const sizes = columns.map((column, index) => itemSize(column, index))
  if (sizes.some((size) => !Number.isFinite(size) || size < 0)) {
    return new Set(columns.map((_, index) => index))
  }
  const window = computeVirtualRange({
    itemCount: columns.length,
    scrollTop: scrollOffset,
    viewportSize,
    itemSize: (index) => sizes[index]!,
    buffer,
  })
  const visible = new Set<number>()
  for (let index = window.startIndex; index <= window.endIndex; index += 1) {
    visible.add(index)
  }
  if (isAlwaysVisible) {
    columns.forEach((column, index) => {
      if (isAlwaysVisible(column, index)) visible.add(index)
    })
  }
  return visible
}
