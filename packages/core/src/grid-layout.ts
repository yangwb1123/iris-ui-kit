import { resolveColumnTrack, type ColumnWidthLike } from './column-width'

/** Framework-agnostic grid track placement helpers. */

/** Optional leading tracks rendered before the leaf-column tracks. */
export interface GridLeadingTrackOptions {
  readonly rowDrag?: boolean
  readonly sequence?: boolean
  readonly detail?: boolean
  readonly selection?: boolean
}

/** Utility tracks in the deterministic leading-track order. */
export type GridLeadingTrack = 'rowDrag' | 'sequence' | 'detail' | 'selection'

/** A CSS grid track authored as a number of pixels or an existing string. */
export type GridTrack = number | string

/** Options for resolving a complete table grid-template-columns string. */
export interface GridTemplateOptions<C extends ColumnWidthLike> {
  /** Utility tracks rendered before the leaf-column tracks. */
  readonly leadingTracks?: readonly GridTrack[]
  /** Predicate for an in-flight collapsed column (for example a fade). */
  readonly isCollapsed?: (column: C, index: number) => boolean
  /** Track emitted while a column remains mounted but visually collapses. */
  readonly collapsedTrack?: string
  /** Optional adapter-specific track projection; defaults to authored Core tracks. */
  readonly trackOf?: (column: C, index: number) => string
}

/** Count utility tracks that precede the first data-column track. */
export function countLeadingGridTracks(options: GridLeadingTrackOptions = {}): number {
  return (
    (options.rowDrag ? 1 : 0) +
    (options.sequence ? 1 : 0) +
    (options.detail ? 1 : 0) +
    (options.selection ? 1 : 0)
  )
}

/**
 * Return the one-based CSS-grid track for an enabled utility column. Disabled
 * utilities return `null`, allowing renderers to call this helper only inside
 * their existing conditional branches without inventing placeholder tracks.
 */
export function leadingGridTrack(
  track: GridLeadingTrack,
  options: GridLeadingTrackOptions = {},
): number | null {
  const enabled: readonly [GridLeadingTrack, boolean][] = [
    ['rowDrag', options.rowDrag === true],
    ['sequence', options.sequence === true],
    ['detail', options.detail === true],
    ['selection', options.selection === true],
  ]
  let position = 1
  for (const [candidate, isEnabled] of enabled) {
    if (candidate === track) return isEnabled ? position : null
    if (isEnabled) position += 1
  }
  return null
}

/** Return the 1-based CSS-grid track for a zero-based leaf-column index. */
export function columnGridTrack(columnIndex: number, leadingTrackCount: number): number {
  return leadingTrackCount + columnIndex + 1
}

/**
 * Resolve utility and leaf tracks into one deterministic CSS grid template.
 * Numeric utility tracks are converted to pixels; leaf tracks preserve the
 * authored CSS declaration through `resolveColumnTrack` unless a caller
 * supplies a framework-specific `trackOf` projection. The optional collapsed
 * path keeps a mounted column at a zero-width track without mutating columns.
 */
export function resolveGridTemplateColumns<C extends ColumnWidthLike>(
  columns: readonly C[],
  overrides: Readonly<Record<string, number>> | undefined,
  options: GridTemplateOptions<C> = {},
): string {
  const parts = (options.leadingTracks ?? []).map((track) =>
    typeof track === 'number' ? `${track}px` : track,
  )
  const collapsedTrack = options.collapsedTrack ?? '0px'
  const trackOf = options.trackOf ?? ((column: C) => resolveColumnTrack(column, overrides))
  columns.forEach((column, index) => {
    parts.push(options.isCollapsed?.(column, index) ? collapsedTrack : trackOf(column, index))
  })
  return parts.join(' ')
}
