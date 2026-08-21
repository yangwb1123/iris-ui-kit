import type { GridCell, ParsedTableQuery } from '@iris-ui-kit/core'

/**
 * Batch I: fold the checked filter sets into the query filter map as
 * comma-joined strings (vxe filter-multiple remote serialization parity).
 * Keys with an empty checked set are left untouched.
 */
export function mergeFilterValues(
  filters: Record<string, string>,
  filterValues: Record<string, string[]>,
): Record<string, string> {
  const next: Record<string, string> = { ...filters }
  for (const [key, values] of Object.entries(filterValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

/**
 * Batch AI: fold a parsed query's substring (`=`/`contains`) and `in` channels
 * into a filter map — `in` lists comma-join exactly like checked filter sets
 * (vxe filter-multiple remote serialization parity). Typed relational rules
 * have no text serialization and stay local-only (documented).
 */
export function mergeQueryIntoFilters(
  filters: Record<string, string>,
  parsed: ParsedTableQuery,
): Record<string, string> {
  const next: Record<string, string> = { ...filters }
  for (const [key, value] of Object.entries(parsed.filters)) {
    if (value !== '') next[key] = value
  }
  for (const [key, values] of Object.entries(parsed.inValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

/**
 * Batch AV: row-major Tab navigation (spreadsheet parity). From `current`,
 * step ±1 cell in row-major order (`(r, c)` → `(r, c+1)` → `(r+1, 0)` …),
 * stopping at the grid bounds — NO wrap, so Tab from the last cell stays put
 * instead of silently moving focus off the table (fiat F1). Shared by
 * Tab / Shift+Tab in the grid keyboard handler.
 */
export function nextRowMajorCell(
  current: GridCell,
  dir: 1 | -1,
  rowCount: number,
  colCount: number,
): GridCell {
  const index = current.row * colCount + current.col + dir
  if (index < 0 || index >= rowCount * colCount) return current
  return { row: Math.floor(index / colCount), col: index % colCount }
}
