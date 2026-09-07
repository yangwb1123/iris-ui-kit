/** Framework-agnostic column width material used by Grid adapters. */

/** Minimal column shape needed for declared-width resolution. */
export interface ColumnWidthLike {
  readonly key: string
  readonly width?: number | string
}

/** Default pixel approximation for non-numeric CSS widths. */
export const DEFAULT_COLUMN_WIDTH = 140

/** Default lower bound used by interactive column resizing. */
export const DEFAULT_COLUMN_MIN_WIDTH = 60

/** Keyboard increment used by interactive column resizing. */
export const COLUMN_RESIZE_STEP = 16

/** Whether a value is safe to use as a numeric pixel width. */
export function isValidColumnWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

/** Clamp an interactive resize result while preserving the adapter's rounding policy. */
export function clampColumnWidth(
  width: number,
  minWidth = DEFAULT_COLUMN_MIN_WIDTH,
  maxWidth = Infinity,
  round = true,
): number {
  const safeMin = isValidColumnWidth(minWidth) ? minWidth : DEFAULT_COLUMN_MIN_WIDTH
  const safeMax = maxWidth === Infinity || isValidColumnWidth(maxWidth) ? maxWidth : Infinity
  const shouldRound = round !== false
  const candidate = isValidColumnWidth(width)
    ? shouldRound
      ? Math.round(width)
      : width
    : DEFAULT_COLUMN_WIDTH
  return Math.max(safeMin, Math.min(safeMax, candidate))
}

/**
 * Resolve a declared column width to a numeric pixel approximation.
 * Numeric widths are kept verbatim; simple `px` values are parsed so the
 * result is usable by virtualization, responsive fitting, and sticky offsets.
 */
export function resolveInitialWidth<C extends ColumnWidthLike>(
  column: C,
  fallback = DEFAULT_COLUMN_WIDTH,
): number {
  if (isValidColumnWidth(column.width)) return column.width
  if (typeof column.width === 'string') {
    const match = column.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (match) {
      const parsed = Number(match[1])
      if (isValidColumnWidth(parsed)) return parsed
    }
  }
  return isValidColumnWidth(fallback) ? fallback : DEFAULT_COLUMN_WIDTH
}

/**
 * Resolve the effective numeric width used by layout math.
 * Invalid/absent overrides fall back to a valid numeric declaration and then
 * to the supplied default. CSS keywords such as `auto` intentionally use the
 * numeric approximation because this path feeds math rather than CSS tracks.
 */
export function resolveColumnWidth<C extends ColumnWidthLike>(
  column: C,
  overrides: Readonly<Record<string, number>> | undefined,
  fallback = DEFAULT_COLUMN_WIDTH,
): number {
  const override = overrides && hasOwn(overrides, column.key) ? overrides[column.key] : undefined
  if (isValidColumnWidth(override)) return override
  const declared = resolveInitialWidth(column, fallback)
  return isValidColumnWidth(declared) ? declared : fallback
}

/**
 * Resolve the CSS grid track for a column while keeping the authored CSS
 * declaration intact. Numeric overrides/declarations become pixel tracks;
 * keywords and other CSS lengths remain authored, and the unset path keeps
 * the table's flexible fallback track.
 */
export function resolveColumnTrack<C extends ColumnWidthLike>(
  column: C,
  overrides: Readonly<Record<string, number>> | undefined,
): string {
  const override = overrides && hasOwn(overrides, column.key) ? overrides[column.key] : undefined
  if (isValidColumnWidth(override)) return `${override}px`
  if (isValidColumnWidth(column.width)) return `${column.width}px`
  if (column.width === 'auto') return 'minmax(max-content, max-content)'
  if (typeof column.width === 'string') return column.width
  return 'minmax(0, 1fr)'
}

/** Resolve a flat sequence to CSS grid tracks in source order. */
export function resolveColumnTracks<C extends ColumnWidthLike>(
  columns: readonly C[],
  overrides: Readonly<Record<string, number>> | undefined,
): string[] {
  return columns.map((column) => resolveColumnTrack(column, overrides))
}

/** Resolve a flat column sequence to effective numeric pixel widths. */
export function resolveColumnWidths<C extends ColumnWidthLike>(
  columns: readonly C[],
  overrides: Readonly<Record<string, number>> | undefined,
  fallback = DEFAULT_COLUMN_WIDTH,
): number[] {
  return columns.map((column) => resolveColumnWidth(column, overrides, fallback))
}
