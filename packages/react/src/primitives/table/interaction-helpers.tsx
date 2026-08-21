import * as React from 'react'
import type { CellRange, SortableRect } from '@iris-ui-kit/core'
import type { IrisTableDensity } from './props'
import type { IrisTableColumn } from './types'
import type { RangeStatsEntry } from './RangeToolbar'
import {
  CHAR_COUNT_HANDLE_SHIFT_STYLE,
  CHAR_COUNT_STYLE,
  COPY_FLASH_BG,
  RANGE_FILL_HANDLE_STYLE,
  RANGE_FILL_TARGET_BG,
  RANGE_MOVE_STYLE,
} from './styles'

/* Batch AQ drag-fill helpers (module scope): the per-cell fill logic stays
   OUT of the row-render arrow so the eslint complexity budget on that hot
   callback is untouched. Each helper is a pure function of its inputs. */

/** True when this cell is the range's bottom-right cell hosting the handle. */
export function isRangeFillHandleCell(
  rangeFill: boolean,
  range: { end: { row: number; col: number } } | null,
  idx: number,
  ci: number,
): boolean {
  return rangeFill && range !== null && range.end.row === idx && range.end.col === ci
}

/** The data-iris-range-fill-target attr value (undefined hides it). */
export function rangeFillTargetAttr(isTarget: boolean): string | undefined {
  return isTarget ? 'true' : undefined
}

/** Batch CL expand-animation attr value (undefined hides it — fail-closed). */
export function expandAnimAttr(on: boolean): string | undefined {
  return on ? 'true' : undefined
}

/** Batch CM summary-sticky attr value (undefined hides it — fail-closed). */
export function summaryStickyAttr(on: boolean): string | undefined {
  return on ? 'true' : undefined
}

/** Whether a cell has enough layout information to decide that its content
 * overflows.  jsdom (and SSR) report zero dimensions, so those environments
 * deliberately fail open and keep the native title.  In a real layout the
 * base cell style is single-line/ellipsis, making horizontal overflow the
 * relevant signal for `tooltipConfig.showAll=false`. */
export function cellContentIsTruncated(element: HTMLElement): boolean {
  const width = element.clientWidth
  if (!Number.isFinite(width) || width <= 0) return true
  return element.scrollWidth > width
}

export function sameStringSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) if (!b.has(value)) return false
  return true
}

// One virtual body slot (batch AE + CS): a `detail` entry occupies a single
// itemHeight slot — content taller than the slot scrolls INSIDE the detail
// cell, so the virtualized body stays uniform-height. Hoisted to module scope
// (was a component-local alias) so the batch-CS anchor helper
// (`virtualItemKeyOf`) can share the shape with the plan constructor without
// a local/global split.
export type BodyPlanEntry<Row extends Record<string, unknown>> =
  | { kind: 'group-header'; groupKey: string; count: number; depth?: number; value?: string }
  | { kind: 'row'; row: Row; rowIndex: number }
  | { kind: 'group-summary'; groupKey: string; rows: Row[] }
  | { kind: 'detail'; row: Row; rowIndex: number }

/** Batch CS: stable identity for a body-plan entry — mirrors the keyOf passed
 * to IrisVirtualScroll, so the recorded content anchor can be re-located in a
 * NEW plan after an expansion commit (single source of truth for both sites). */
export function virtualItemKeyOf<Row extends Record<string, unknown>>(
  item: BodyPlanEntry<Row>,
  rowKeyOf: (row: Row, rowIndex?: number) => string | number,
): string {
  if (item.kind === 'group-header') return `group:${item.groupKey}`
  if (item.kind === 'group-summary') return `group-summary:${item.groupKey}`
  if (item.kind === 'detail') return `${String(rowKeyOf(item.row, item.rowIndex))}::detail`
  return String(rowKeyOf(item.row, item.rowIndex))
}

/** Batch CS: the single key that differs between two expansion key lists — or
 * null when they are identical / differ by multiple keys. The discriminator
 * between a single-key toggle (exact anchor math) and a full-set restore
 * (`expandAll` / `persistState` replay → the virtualizer's re-clamp handles
 * it, documented fiat). */
export function singleKeyDiff(prev: readonly string[], next: readonly string[]): string | null {
  if (prev === next) return null
  const prevSet = new Set(prev)
  const nextSet = new Set(next)
  const added = next.filter((k) => !prevSet.has(k))
  const removed = prev.filter((k) => !nextSet.has(k))
  if (added.length + removed.length !== 1) return null
  return added[0] ?? removed[0] ?? null
}

/** Batch CP density-cycle helper (module scope): the toolbar toggle cycles
 * comfortable → compact → cozy → comfortable (zoom toggle precedent). */
export function nextDensity(d: IrisTableDensity): IrisTableDensity {
  return d === 'comfortable' ? 'compact' : d === 'compact' ? 'cozy' : 'comfortable'
}

/** Extra cell style for the fill-handle host (relative + above pinned) and
 * the drag-target highlight (token-driven background). */
export function rangeFillCellStyle(handleCell: boolean, targetCell: boolean): React.CSSProperties {
  return {
    ...(handleCell ? { position: 'relative', zIndex: 2 } : null),
    ...(targetCell ? { background: RANGE_FILL_TARGET_BG } : null),
  }
}

/** Batch CE copy flash: is (row, col) inside the copied-range SNAPSHOT? Kept
 * at module scope so the row-render arrow's eslint complexity budget stays
 * untouched (same discipline as the fill helpers above). */
export function inCopyFlashRange(range: CellRange | null, row: number, col: number): boolean {
  if (range === null) return false
  return (
    row >= range.start.row && row <= range.end.row && col >= range.start.col && col <= range.end.col
  )
}

/** The data-iris-copy-flash attr value (undefined hides it). */
export function copyFlashCellAttr(
  range: CellRange | null,
  row: number,
  col: number,
): string | undefined {
  return inCopyFlashRange(range, row, col) ? 'true' : undefined
}

/** Batch CH (iris 独有 — vxe has no drag-out pin): a column-drag release
 * outside the table's LEFT edge triggers the drag-out pin (with
 * `columnPinMenu`); releases at/inside the left edge keep the plain reorder
 * path. Pure + DOM-free, so the root pointerup handler and the window
 * pointerup listener resolve through the SAME check. */
export function isColDragOutLeft(x: number, rootLeft: number): boolean {
  return x < rootLeft
}

/** Batch DC (iris 独有 — vxe has no frozen-zone-aware reorder): clamp a
 * column drag's drop index into the dragged column's OWN pin zone — the
 * zone span currently held by same-zone columns (`zoneOf` returns the same
 * `pinOf` throat as pinnedOffsets; a pinned column's zone is 'left'/'right',
 * an unpinned column's 'free'). Same-zone drops pass through index as-is
 * (zero-pin tables stay byte-identical); drops over-before the zone clamp
 * to its start, drops over-after to its end. Invariant: a column drag never
 * changes a column's pin zone — the `[left][free][right]` partition holds
 * (gapped states included, per batch CV's documented gap handling). Pure +
 * DOM-free; resolveColDrag wires it (the pinned-reorder tests exercise it
 * through the full drag pipeline). */
export function clampReorderZone<Row extends Record<string, unknown>>(
  cols: readonly IrisTableColumn<Row>[],
  from: number,
  to: number,
  zoneOf: (col: IrisTableColumn<Row>) => 'left' | 'right' | 'free',
): number {
  const zone = zoneOf(cols[from]!)
  let start = from
  let end = from
  for (let i = 0; i < cols.length; i++) {
    if (i !== from && zoneOf(cols[i]!) === zone) {
      if (i < start) start = i
      if (i > end) end = i
    }
  }
  if (to < start) return start
  if (to > end) return end
  return to
}

/** Batch CW import preview (iris 独有): the preview table's column headers
 * come from the FIRST parsed row's keys — every row is built by the same
 * `Object.fromEntries(header.map(...))`, so key order is stable across rows.
 * Null/empty → zero columns (header-only CSV still opens the preview). */
export function previewColumnsFromRows(rows: Record<string, unknown>[] | null): string[] {
  if (!rows || rows.length === 0) return []
  return Object.keys(rows[0])
}

/** Batch CZ (iris 独有 — vxe has no locate flash): locate a row's DOM node
 * by key via the same data attribute the row-drag path uses (flat, tree,
 * grouped and virtual rows all carry it). The selector is escaped for
 * attribute values (a raw `"` in a key would otherwise make querySelector
 * throw); jsdom lacks CSS.escape, so fall back to attribute iteration
 * there. Shared by scrollToRow and goToRow (extracted from the former). */
export function findTableRowEl(root: HTMLElement, key: string | number): HTMLElement | null {
  const keyStr = String(key)
  return typeof CSS !== 'undefined' && CSS.escape
    ? root.querySelector<HTMLElement>(`[data-iris-table-row="${CSS.escape(keyStr)}"]`)
    : (Array.from(root.querySelectorAll<HTMLElement>('[data-iris-table-row]')).find(
        (n) => n.getAttribute('data-iris-table-row') === keyStr,
      ) ?? null)
}

/** The copy-flash background — empty object outside the flashed rect so the
 * spread adds nothing (no operators in the hot arrow). */
export function copyFlashCellStyle(
  range: CellRange | null,
  row: number,
  col: number,
): React.CSSProperties {
  if (!inCopyFlashRange(range, row, col)) return {}
  return { backgroundColor: COPY_FLASH_BG }
}

/** The 6px fill handle (data-iris-range-fill), rendered only in the range's
 * bottom-right cell; pointerdown starts the drag (and stops the cell click). */
export function renderRangeFillHandle(
  handleCell: boolean,
  row: number,
  col: number,
  onPointerDown: (e: React.PointerEvent, row: number, col: number) => void,
): React.ReactNode {
  if (!handleCell) return null
  return (
    <span
      data-iris-range-fill=""
      onPointerDown={(e) => onPointerDown(e, row, col)}
      style={RANGE_FILL_HANDLE_STYLE}
    />
  )
}

/* Batch CN cell drag-move helpers (module scope): same discipline as the
   Batch AQ fill helpers — the per-cell move-grip logic stays OUT of the
   row-render arrow so the eslint complexity budget on that hot callback is
   untouched. Each helper is a pure function of its inputs. */

/** True when this cell is the range's top-left cell hosting the move grip. */
export function isRangeMoveGripCell(
  cellDrag: boolean,
  range: { start: { row: number; col: number } } | null,
  idx: number,
  ci: number,
): boolean {
  return cellDrag && range !== null && range.start.row === idx && range.start.col === ci
}

/** Host style for the move-grip cell: relative + above pinned sticky cells
 * (zIndex 2 — the same anchor the fill-handle host uses; both styles spread
 * relative, which is idempotent). */
export function rangeMoveCellStyle(gripCell: boolean): React.CSSProperties {
  return gripCell ? { position: 'relative', zIndex: 2 } : {}
}

/** The 12×4 move grip (data-iris-range-move) on the range's top edge,
 * rendered only in the range's top-left cell; pointerdown starts the drag
 * (and stops the cell click, fill-handle precedent). */
export function renderRangeMoveGrip(
  gripCell: boolean,
  row: number,
  col: number,
  onPointerDown: (e: React.PointerEvent, row: number, col: number) => void,
): React.ReactNode {
  if (!gripCell) return null
  return (
    <span
      data-iris-range-move=""
      onPointerDown={(e) => onPointerDown(e, row, col)}
      style={RANGE_MOVE_STYLE}
    />
  )
}

/* Batch CG charCount (iris 独有 — vxe has no equivalent): the selection badge
   lives at the range's bottom-right cell — the same corner as the fill handle
   — and is a pure reduction over the EXISTING rangeStatsData memo (the same
   material the stats panel consumes): count = Σ column non-null counts, sum =
   Σ numeric column sums (null when NO column in the range has numeric data).
   Returns null when there is nothing to show (no range / no entries). */
export function rangeCharCount(
  entries: RangeStatsEntry[] | null,
): { count: number; sum: number | null } | null {
  if (!entries || entries.length === 0) return null
  let count = 0
  let sum = 0
  let hasNumeric = false
  for (const entry of entries) {
    count += entry.stats.count
    if (entry.stats.sum !== null) {
      hasNumeric = true
      sum += entry.stats.sum
    }
  }
  return { count, sum: hasNumeric ? sum : null }
}

/** Batch CG: is this cell the selection badge host (the range's bottom-right
 *  cell)? The same corner the fill handle occupies, hence the collision
 *  handling in the badge render. Feature-gated on `charCount` (fail-closed). */
export function isRangeCharCountHost(
  charCount: boolean | undefined,
  range: { end: { row: number; col: number } } | null,
  idx: number,
  ci: number,
): boolean {
  return charCount === true && range !== null && range.end.row === idx && range.end.col === ci
}

/** Batch CG: the selection badge at the range's bottom-right cell — count (+ sum
 *  when the range has numeric data), the sum rounded via the SAME
 *  aggregateAccuracy gate as the summary row / selection summary. Shifts up
 *  (bottom 10px) when the cell is also the fill-handle host so the 6px handle
 *  stays usable. Rendered inside the cell div (the host cell gains position:
 *  relative from charCountCellStyle, so the chip anchors to the cell box). */
export function renderRangeCharCountBadge(
  charCount: boolean | undefined,
  activeRange: { end: { row: number; col: number } } | null,
  rangeStatsData: RangeStatsEntry[] | null,
  aggregateAccuracy: number | undefined,
  idx: number,
  ci: number,
  fillHandleCell: boolean,
  t: (key: string, params?: Record<string, string | number>) => string,
): React.ReactNode {
  if (!isRangeCharCountHost(charCount, activeRange, idx, ci)) return null
  const stats = rangeCharCount(rangeStatsData)
  if (stats === null) return null
  const accuracy =
    aggregateAccuracy !== undefined && aggregateAccuracy >= 0 && aggregateAccuracy <= 100
      ? aggregateAccuracy
      : undefined
  const sumText =
    stats.sum !== null && accuracy !== undefined
      ? String(Number(stats.sum.toFixed(accuracy)))
      : stats.sum !== null
        ? String(stats.sum)
        : null
  return (
    <span
      data-iris-char-count=""
      data-iris-char-count-range=""
      style={fillHandleCell ? CHAR_COUNT_HANDLE_SHIFT_STYLE : CHAR_COUNT_STYLE}
    >
      {t('table.charCount.range', { count: String(stats.count) })}
      {sumText !== null ? ` · ${t('table.charCount.rangeSum', { sum: sumText })}` : null}
    </span>
  )
}

/** Batch CG: the charCount corner badge anchors to a RELATIVE cell — the
 *  editing cell (badge inside the editor surface) and the selection badge host
 *  (the range's bottom-right cell). Empty object when nothing renders so the
 *  spread adds nothing to the hot row arrow; `editing && charCount` gates the
 *  editing case (fail-closed: an open editor without the prop shows nothing). */
export function charCountCellStyle(
  editing: boolean,
  charCount: boolean | undefined,
  activeRange: { end: { row: number; col: number } } | null,
  idx: number,
  ci: number,
): React.CSSProperties {
  if (!charCount) return {}
  if (editing || isRangeCharCountHost(charCount, activeRange, idx, ci)) {
    return { position: 'relative' }
  }
  return {}
}

/**
 * Batch CD row-drag insertion indicator (iris 独有 — vxe has no drop line):
 * the ONE pure source of truth shared by the move handler (draws the 1px
 * line between rows) and the up handler (commits the drop) so the row
 * always lands exactly where the line was drawn. Side = the pointer vs. the
 * over row's vertical midpoint (dnd-kit style): at/above the center the
 * line sits ABOVE the over row, strictly below it sits BELOW. Returns null
 * when there is nothing to draw (no target / the active row itself / a
 * non-row target such as the header), and the insert index is expressed in
 * the ORIGINAL array space (pre-removal), matching the commit's
 * `splice(from,1); splice(to,0)` — so a net-zero move (`from ===
 * insertIndex`) is detectable by the caller.
 */
export interface RowDragDropResolve {
  /** Which edge of the over row the insertion line sits on. */
  side: 'above' | 'below'
  /** Index in the ORIGINAL rows array the dragged row lands at. */
  insertIndex: number
}

export function resolveRowDragDrop<Row>(
  pointerY: number,
  activeId: string,
  overId: string,
  overRect: SortableRect,
  rows: readonly Row[],
  idOf: (row: Row, index: number) => string,
): RowDragDropResolve | null {
  if (activeId === overId) return null
  const overIndex = rows.findIndex((row, index) => idOf(row, index) === overId)
  if (overIndex < 0) return null
  const side: RowDragDropResolve['side'] =
    pointerY <= overRect.top + overRect.height / 2 ? 'above' : 'below'
  return { side, insertIndex: overIndex + (side === 'below' ? 1 : 0) }
}

/**
 * Light audit diff (batch AT): compare the PREVIOUS row list against the
 * NEXT and resolve the FIRST changed row + FIRST changed cell, so each
 * mutation commit records exactly ONE audit entry (keeps the trail readable
 * and the complexity budget flat).
 *
 * Simplifications (documented): the walk is index-based — a reorder reads as
 * a structural change at the first index whose keys differ; a row that moved
 * but kept its key reads as a change at its old slot; only the first changed
 * row/cell is kept, not a full cell-level patch. Structural changes (rows
 * added/removed at the index, or key-mismatched rows) carry ONLY the rowKey
 * (no column/old→new — the panel renders those as partial-context rows);
 * same-key rows walk the union of own enumerable fields and record the first
 * differing cell.
 */
export function auditDiff<Row extends Record<string, unknown>>(
  prev: readonly Row[],
  next: readonly Row[],
  resolveKey: (row: Row, index: number) => string | number,
):
  | { rowKey?: string | number; column?: string; oldValue?: unknown; newValue?: unknown }
  | undefined {
  const len = Math.max(prev.length, next.length)
  for (let i = 0; i < len; i += 1) {
    const a = prev[i]
    const b = next[i]
    if (a === b) continue
    if (!a || !b) return { rowKey: a ? resolveKey(a, i) : resolveKey(b!, i) }
    const ka = resolveKey(a, i)
    const kb = resolveKey(b, i)
    if (ka !== kb) {
      // Structural at this index: prefer the key from the side that shrank
      // (removed row) / grew (inserted row) — index-0 inserts report the
      // shifted occupant instead (documented simplification).
      return { rowKey: prev.length > next.length ? ka : kb }
    }
    // Same row — first differing cell across the union of fields.
    const fields = new Set<string>()
    Object.keys(a).forEach((f) => fields.add(f))
    Object.keys(b).forEach((f) => fields.add(f))
    for (const f of fields) {
      if (a[f] !== b[f]) {
        return { rowKey: ka, column: f, oldValue: a[f], newValue: b[f] }
      }
    }
  }
  return undefined
}
