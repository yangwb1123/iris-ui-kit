/**
 * Framework-agnostic roving-focus index math — the C-layer **material** behind
 * keyboard navigation in List, Menu, Select, Combobox, Tree, ToggleGroup, the
 * admin NavMenu/Tabs, etc. (today the same next-enabled-index-with-wrap loop is
 * re-implemented per component per framework). These are pure: they compute
 * which index to focus; the actual `element.focus()` stays in the adapter.
 */

/**
 * Step `delta` positions from `current`, skipping disabled items, optionally
 * wrapping around the ends. Returns the next focusable index, or `current` if
 * none is focusable.
 */
export function nextEnabledIndex(
  current: number,
  delta: number,
  count: number,
  isEnabled: (index: number) => boolean = () => true,
  loop = true,
): number {
  if (count <= 0) return -1
  const step = delta === 0 ? 1 : delta > 0 ? 1 : -1
  let index = current
  for (let i = 0; i < count; i += 1) {
    index += step
    if (index < 0) {
      if (!loop) return firstEnabledIndex(count, isEnabled)
      index = count - 1
    } else if (index >= count) {
      if (!loop) return lastEnabledIndex(count, isEnabled)
      index = 0
    }
    if (isEnabled(index)) return index
  }
  return current
}

/** First focusable index, or -1. */
export function firstEnabledIndex(
  count: number,
  isEnabled: (index: number) => boolean = () => true,
): number {
  for (let i = 0; i < count; i += 1) if (isEnabled(i)) return i
  return -1
}

/** Last focusable index, or -1. */
export function lastEnabledIndex(
  count: number,
  isEnabled: (index: number) => boolean = () => true,
): number {
  for (let i = count - 1; i >= 0; i -= 1) if (isEnabled(i)) return i
  return -1
}

/** A focused cell in a 2D grid (row + column, both 0-based). */
export interface GridCell {
  row: number
  col: number
}

/** Keys that move focus in a `role="grid"` (WAI-ARIA grid pattern). */
export type GridNavKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'

export interface GridNavOptions {
  rowCount: number
  colCount: number
  /** Whether a cell can receive focus. Default: all enabled. */
  isEnabled?: (cell: GridCell) => boolean
  /** Wrap within a row on ArrowLeft/Right at its ends. Default `false`. */
  loop?: boolean
  /** Rows to jump for PageUp/PageDown. Default `1`. */
  pageSize?: number
}

/**
 * Framework-agnostic 2D roving-focus math — the C-layer material behind grid
 * keyboard navigation (`role="grid"` Table/DataGrid). Given the focused cell and
 * a nav key, returns the next cell, skipping disabled cells along the travel
 * direction. Left/Right stay in the row (optionally wrapping); Up/Down stay in
 * the column; Home/End jump to the row's first/last enabled cell; Page Up/Down
 * jump `pageSize` rows and land on the nearest enabled cell in the same column.
 * Returns the current cell unchanged when no enabled target exists. The actual
 * `element.focus()` stays in the adapter.
 */
export function nextGridCell(
  current: GridCell,
  key: GridNavKey,
  options: GridNavOptions,
): GridCell {
  const { rowCount, colCount, isEnabled = () => true, loop = false, pageSize = 1 } = options
  if (rowCount <= 0 || colCount <= 0) return current
  const inRow = (r: number): boolean => r >= 0 && r < rowCount
  const inCol = (c: number): boolean => c >= 0 && c < colCount
  const clampRow = (r: number): number => Math.max(0, Math.min(rowCount - 1, r))

  // Vary the column within `row`, skipping disabled, optionally wrapping.
  const scanRow = (row: number, fromCol: number, step: number): GridCell => {
    let c = fromCol
    for (let i = 0; i < colCount; i += 1) {
      c += step
      if (c < 0) {
        if (!loop) break
        c = colCount - 1
      } else if (c >= colCount) {
        if (!loop) break
        c = 0
      }
      if (isEnabled({ row, col: c })) return { row, col: c }
    }
    return current
  }
  // Vary the row within `col`, skipping disabled (no wrap across the top/bottom).
  const scanCol = (col: number, fromRow: number, step: number): GridCell => {
    let r = fromRow
    for (let i = 0; i < rowCount; i += 1) {
      r += step
      if (!inRow(r)) break
      if (isEnabled({ row: r, col })) return { row: r, col }
    }
    return current
  }
  // Nearest enabled cell in `row`, searching outward from `col`.
  const nearestInRow = (row: number, col: number): GridCell => {
    if (isEnabled({ row, col })) return { row, col }
    for (let d = 1; d < colCount; d += 1) {
      if (inCol(col - d) && isEnabled({ row, col: col - d })) return { row, col: col - d }
      if (inCol(col + d) && isEnabled({ row, col: col + d })) return { row, col: col + d }
    }
    return current
  }

  switch (key) {
    case 'ArrowLeft':
      return scanRow(current.row, current.col, -1)
    case 'ArrowRight':
      return scanRow(current.row, current.col, 1)
    case 'ArrowUp':
      return scanCol(current.col, current.row, -1)
    case 'ArrowDown':
      return scanCol(current.col, current.row, 1)
    case 'Home':
      return nearestInRow(current.row, 0)
    case 'End':
      return nearestInRow(current.row, colCount - 1)
    case 'PageUp':
      return nearestInRow(clampRow(current.row - pageSize), current.col)
    case 'PageDown':
      return nearestInRow(clampRow(current.row + pageSize), current.col)
  }
}

/**
 * Typeahead match for menu / listbox keyboard navigation (the WAI-ARIA pattern):
 * the index of the first item whose label starts with `query` (case-insensitive),
 * searching cyclically from AFTER `fromIndex`, then wrapping to include
 * `fromIndex` itself. Returns -1 if nothing matches. The caller buffers the typed
 * characters (resetting on a ~500ms pause) and passes the running buffer — so a
 * repeated single char cycles through same-initial items, and a typed string
 * jumps to the best match. `disabled` items are skipped.
 */
export function matchTypeahead(
  labels: readonly string[],
  query: string,
  fromIndex: number,
  isDisabled?: (index: number) => boolean,
): number {
  const q = query.trim().toLowerCase()
  if (!q || labels.length === 0) return -1
  const n = labels.length
  const start = fromIndex < 0 || fromIndex >= n ? -1 : fromIndex
  for (let step = 1; step <= n; step += 1) {
    const idx = (((start + step) % n) + n) % n
    if (isDisabled?.(idx)) continue
    if ((labels[idx] ?? '').trim().toLowerCase().startsWith(q)) return idx
  }
  return -1
}
