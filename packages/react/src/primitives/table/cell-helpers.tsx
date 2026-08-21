import * as React from 'react'
import { chartDomain } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableEditDirtyConfig, IrisTablePresenceEntry } from './types'
import {
  CELL_NOTE_STYLE,
  PRESENCE_LABEL_STYLE,
  WATERMARK_OVERLAY_STYLE,
  WATERMARK_TILE_STYLE,
  WATERMARK_WRAPPER_STYLE,
} from './styles'

/** Map a vxe-style cell alignment to a flex `justifyContent` value. */
export const justifyFor = (
  align: 'left' | 'center' | 'right' | undefined,
  fallback: 'left' | 'right' = 'left',
): 'flex-start' | 'center' | 'flex-end' => {
  const resolved = align ?? fallback
  return resolved === 'right' ? 'flex-end' : resolved === 'center' ? 'center' : 'flex-start'
}

/** Dirty-map key (batch Q): `${rowKeyVal}::${colKey}` — the same `::`
 * delimiter as `cellId` so keys/colKeys containing `:` cannot collide
 * (`a:b`/`c` vs `a`/`b:c`). */
export const dirtyKey = (rowIdent: string | number, colKey: string): string =>
  `${rowIdent}::${colKey}`

/** Per-cell dirty render state (batch Q, vxe editDirtyConfig parity): a
 * committed cell whose value differs from its pre-edit original is dirty
 * (tracked in the dirty map, keyed `${rowKeyVal}::${colKey}`). `indicator:
 * false` suppresses the dot + relative positioning but keeps tracking;
 * `className: true` adds an `iris-table-cell-dirty` class regardless.
 * Module-level so the cell render's cyclomatic complexity stays flat (a
 * call costs 0). */
export const dirtyCellState = (
  config: IrisTableEditDirtyConfig | undefined,
  map: ReadonlyMap<string, { original: unknown; current: unknown }> | null,
  k: string | number | null,
  colKey: string,
): {
  attr: string | undefined
  dirtyClass: string | undefined
  posStyle: React.CSSProperties | null
} => {
  if (config === undefined || k == null) {
    return { attr: undefined, dirtyClass: undefined, posStyle: null }
  }
  const tracked = map !== null && map.has(dirtyKey(k, colKey))
  const showDirty = tracked && config.indicator !== false
  const withClass = tracked && config.className === true
  return {
    attr: showDirty ? 'true' : undefined,
    dirtyClass: withClass ? 'iris-table-cell-dirty' : undefined,
    posStyle: showDirty ? { position: 'relative' } : null,
  }
}

/** Batch AZ cell annotation (iris 独有 — vxe has no cell-note concept): the
 * dynamic `cellNote` callback wins over the static `annotations` map, keyed
 * `${rowKeyVal}::${colKey}` — the same `::` delimiter as `cellId` (so the
 * lookup is exactly `annotations[cellId(k, col.key)]`). A null/'' note
 * renders nothing (no badge, no attr, no title). Module-level so the cell
 * render's cyclomatic complexity stays flat (a call costs 0). */
export const cellNoteOf = <Row extends Record<string, unknown>>(
  annotations: Record<string, string> | undefined,
  cellNote: ((row: Row, column: IrisTableColumn<Row>) => string | null) | undefined,
  row: Row,
  col: IrisTableColumn<Row>,
  k: string | number | null,
): string | null => {
  if (cellNote) {
    const dynamic = cellNote(row, col)
    if (dynamic != null && dynamic !== '') return dynamic
  }
  if (k == null || annotations == null) return null
  return annotations[`${k}::${col.key}`] ?? null
}

/** Batch AZ: the per-cell render state derived from the note — attr, the
 * relative-position style the badge needs, and the note itself (so the cell
 * arrow's title/attr/badge reads stay complexity-free — one call costs 0). */
export const cellNoteState = <Row extends Record<string, unknown>>(
  annotations: Record<string, string> | undefined,
  cellNote: ((row: Row, column: IrisTableColumn<Row>) => string | null) | undefined,
  row: Row,
  col: IrisTableColumn<Row>,
  k: string | number | null,
): { note: string | null; attr: string | undefined; posStyle: React.CSSProperties | null } => {
  const note = cellNoteOf(annotations, cellNote, row, col, k)
  return {
    note,
    attr: note ? 'true' : undefined,
    posStyle: note ? { position: 'relative' } : null,
  }
}

/** Batch AZ: the 6px corner badge — zero nodes when there is no note (so
 * noted cells are the only ones carrying the span; same pattern as the range
 * fill handle). */
export function renderCellNoteBadge(note: string | null): React.ReactNode {
  if (!note) return null
  return <span aria-hidden="true" data-iris-cell-note-badge="" style={CELL_NOTE_STYLE} />
}

/** Batch BM: the note-popover handlers for a noted cell — null when the
 * feature is off or the cell has no note (zero cost: no handlers, no
 * popover). Module-level so the cell render's cyclomatic complexity stays
 * flat (a call costs 0); the `::` cell key is the same canonical delimiter
 * as `cellId` / the `annotations` map. mouseleave closes (native-title
 * semantics); the popover is pointer-events none so it never blocks the
 * leave. */
export const notePopoverCellHandlers = (
  notePopover: boolean | undefined,
  note: string | null,
  k: string | number,
  colKey: string,
  onEnter: (cellKey: string, text: string, el: HTMLElement) => void,
  onLeave: () => void,
): { onMouseEnter: (e: React.MouseEvent) => void; onMouseLeave: () => void } | null => {
  if (!notePopover || !note) return null
  const cellKey = `${k}::${colKey}`
  return {
    onMouseEnter: (e: React.MouseEvent) => onEnter(cellKey, note, e.currentTarget as HTMLElement),
    onMouseLeave: onLeave,
  }
}

/** Batch BN: the inline row height for the NON-virtual render path — fixed
 * form = uniform height, fn form = per-bodyData-index height; undefined when
 * unset (rows keep their natural content height, byte-identical with the
 * pre-batch behavior). Module-level so renderBodyEntry's complexity stays
 * flat; `rowStyle` (merged AFTER extraStyle) remains the per-row escape
 * hatch. Virtual mode never calls this — slots fill via `height: '100%'`. */
export const rowHeightStyleOf = (
  rowHeight: number | ((index: number) => number) | undefined,
  idx: number,
): React.CSSProperties | undefined =>
  rowHeight == null
    ? undefined
    : { height: typeof rowHeight === 'number' ? rowHeight : rowHeight(idx) }

/** Batch BD collaborative presence (iris 独有 — vxe has no cursor sharing):
 * the entries whose `cellKey` (the canonical `${rowKeyVal}::${colKey}`
 * delimiter) matches this cell — one Map lookup per visible cell, undefined
 * when there is no presence at all. Module-level so the cell render's
 * cyclomatic complexity stays flat (a call costs 0). */
export const presenceOf = (
  byCell: ReadonlyMap<string, IrisTablePresenceEntry[]> | null,
  k: string | number | null,
  colKey: string,
): IrisTablePresenceEntry[] | undefined => {
  if (byCell === null || k == null) return undefined
  return byCell.get(`${k}::${colKey}`)
}

/** Batch BD: the cell-level render state — a 2px outline in the FIRST
 * entry's color (same-cell stacking: first wins) + relative positioning for
 * the corner labels; null when this cell has no presence (zero nodes). */
export const presenceStyle = (
  entries: IrisTablePresenceEntry[] | undefined,
): { outline: string; position: 'relative' } | null =>
  entries && entries.length > 0
    ? { outline: `2px solid ${entries[0].color}`, position: 'relative' }
    : null

/** Batch BD: the corner name labels — one span per entry, cascaded below
 * each other when several share a cell (first entry on top); zero nodes when
 * there is no presence on this cell (same pattern as the range fill handle).
 * Pure display: the label carries the id/name attrs for tests and tooling. */
export function renderPresenceLabels(
  entries: IrisTablePresenceEntry[] | undefined,
): React.ReactNode {
  if (!entries || entries.length === 0) return null
  return entries.map((e, i) => (
    <span
      key={e.id}
      aria-hidden="true"
      data-iris-presence-label=""
      data-iris-presence-id={e.id}
      data-iris-presence-name={e.name}
      style={{ ...PRESENCE_LABEL_STYLE, top: i * 14, background: e.color }}
    >
      {e.name}
    </span>
  ))
}

// ── Batch BU table watermark (iris 独有 — vxe has no watermark) ────────
// A rotated, tiled text layer rendered INSIDE the table root (not wrapping
// it — a wrapper would break the fixed-height scroll container and sticky
// header). DOM shape mirrors the standalone IrisWatermark primitive
// (data-iris-watermark wrapper → data-iris-watermark-overlay → tiles) so a
// global [data-iris-watermark] selector matches one element shape everywhere.
// The wrapper is the FIRST child of the root AND sticky: the root is the
// scroll container itself, so a normal-position sticky at the content top
// with `top: 0; height: 100%` pins the layer to the scroll viewport while
// rows scroll beneath (absolute inset-0 — or sticky placed after the rows —
// would scroll away with the content). Positioned z-auto paints it above
// static rows / footer / pager but below the sticky header (z 2) and pinned
// columns (z 1). Presence-gated at the call site: no prop / empty string →
// zero nodes.
const WATERMARK_TILE_COUNT = 72

export function renderTableWatermark(text: string): React.ReactNode {
  return (
    <div data-iris-watermark="" style={WATERMARK_WRAPPER_STYLE}>
      <div data-iris-watermark-overlay="" aria-hidden="true" style={WATERMARK_OVERLAY_STYLE}>
        {Array.from({ length: WATERMARK_TILE_COUNT }, (_, i) => (
          <span key={i} data-iris-watermark-tile="" style={WATERMARK_TILE_STYLE}>
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Batch BI column sparkline (iris 独有 — vxe has no sparkline) ───────
// SVG geometry in viewBox units — 20×8, pure structured JSX (no SVG
// strings, no dangerouslySetInnerHTML), stroke from the primary token
// (ChartPanel precedent). The series is PER-PREFIX: the cell at filteredData
// index i charts the column's values over [0..i] INCLUSIVE (the current
// value is the final point).
const SPARK_W = 20
const SPARK_H = 8
const SPARK_PAD = 1

/** Batch BI render memo shape: filteredData row-identity index + per-column
 * RAW value arrays (values[i] = the i-th filteredData row's cell value). */
export interface SparklineData<Row extends Record<string, unknown>> {
  rowIndexOf: Map<Row, number>
  valuesByKey: Map<string, unknown[]>
}

/** x of the i-th point (0-based) over `count` points. */
export function sparkX(i: number, count: number): number {
  if (count <= 1) return SPARK_W / 2
  return SPARK_PAD + (i / (count - 1)) * (SPARK_W - 2 * SPARK_PAD)
}

/** y of value `v` within the padded [min, max] domain (never a zero span). */
export function sparkY(v: number, min: number, max: number): number {
  const span = max - min
  return SPARK_H - SPARK_PAD - ((v - min) / span) * (SPARK_H - 2 * SPARK_PAD)
}

/** Contiguous runs of finite points → polyline segments (a null point breaks
 * the line; each run renders its own polyline — ChartPanel parity). */
export function sparkSegments(
  points: ReadonlyArray<number | null>,
  min: number,
  max: number,
): Array<Array<[number, number]>> {
  const segments: Array<Array<[number, number]>> = []
  let current: Array<[number, number]> | null = null
  points.forEach((p, i) => {
    if (p === null) {
      current = null
      return
    }
    if (current === null) {
      current = []
      segments.push(current)
    }
    current.push([sparkX(i, points.length), sparkY(p, min, max)])
  })
  return segments
}

/** Batch BI: the per-prefix series for one cell — the sparkline column's
 * values over filteredData[0..i] INCLUSIVE (current value = final point),
 * with null/undefined/non-finite values as gaps (buildChartData parity).
 * null when the memo is off or the row is not in filteredData (fail-inert). */
export function sparklineSeries<Row extends Record<string, unknown>>(
  memo: SparklineData<Row> | null,
  row: Row,
  col: IrisTableColumn<Row>,
): Array<number | null> | null {
  if (memo === null) return null
  const index = memo.rowIndexOf.get(row)
  if (index === undefined) return null
  const values = memo.valuesByKey.get(col.key)
  if (!values) return null
  return values.slice(0, index + 1).map((raw) => {
    // buildChartData parity: `Number` coercion — a numeric string charts
    // as a point, null/non-finite becomes a gap.
    const value = raw == null ? Number.NaN : Number(raw)
    return Number.isFinite(value) ? value : null
  })
}

/** Batch BI: whether this cell renders a sparkline — the per-cell numeric
 * gate (raw value must be a finite JS number); the same condition the cell
 * title uses. Module-level so the cell render's cyclomatic complexity stays
 * flat (a call costs 0). */
export function sparklineCell<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
  raw: unknown,
): boolean {
  return col.sparkline === true && typeof raw === 'number' && Number.isFinite(raw)
}

/** Batch BI: the 20×8 sparkline SVG for a series — polyline segments (gaps
 * break the line, ChartPanel parity), a circle dot for a single-point
 * prefix; stroke `var(--iris-primary)` strokeWidth 1.5 (token — ChartPanel
 * precedent). `role="img"` + aria-label = the series (the same string the
 * cell title shows). Zero nodes for a null/empty series. */
export function renderSparkline(
  series: Array<number | null> | null,
  colKey: string,
): React.ReactNode {
  if (!series || series.length === 0) return null
  const { min, max } = chartDomain(series)
  const segments = sparkSegments(series, min, max)
  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      width={SPARK_W}
      height={SPARK_H}
      role="img"
      aria-label={series.map((p) => (p === null ? '' : String(p))).join(', ')}
      data-iris-sparkline={colKey}
      style={{ display: 'block', pointerEvents: 'none' }}
    >
      {segments.map((seg, s) => (
        <polyline
          key={s}
          points={seg.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="var(--iris-primary)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {series.length === 1 && series[0] !== null ? (
        <circle
          cx={sparkX(0, 1)}
          cy={sparkY(series[0], min, max)}
          r={1.5}
          fill="var(--iris-primary)"
        />
      ) : null}
    </svg>
  )
}
