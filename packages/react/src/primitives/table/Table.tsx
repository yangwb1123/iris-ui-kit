import * as React from 'react'
import {
  aggregate,
  buildFormValues,
  buildHeaderMatrix,
  chartDomain,
  computeVirtualRange,
  compareValues,
  createCellRange,
  createExpansion,
  createSelectionModel,
  createUndoStack,
  createAuditLog,
  createPerfStats,
  createVersionHistory,
  createRecentFilters,
  detectAutoLink,
  flattenLeafColumns,
  flattenTree,
  formatClock,
  groupRows,
  mergeFormFilters,
  matchesRule,
  parseTableQuery,
  seedFormValues,
  withSortedChildren,
  nextGridCell,
  nowMs,
  rangeStats,
  type CellRange,
  type CellRangeController,
  type ExpansionModel,
  type GridCell,
  type GridNavKey,
  type ParsedTableQuery,
  type PerfStats,
  type SelectionModel,
  type TreeRow,
  type UndoStack,
  type AuditLog,
  type AuditLogType,
  type VersionHistory,
  type RecentFilterEntry,
  type RecentFilters,
  diffRows,
  type RowDiff,
  type RowDiffCellChange,
  matchConditionalStyles,
  splitSearchHits,
} from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { IrisInput } from '../input/Input'
import { IrisSelect } from '../select/Select'
import { IrisFormField } from '../form-field/FormField'
import { IrisButton } from '../button/Button'
import { useStore } from '../../useStore'
import {
  applyColumnPreset,
  cloneRowInList,
  columnLetter,
  copyText,
  createCellEdit,
  createRemoteTableSource,
  createSortable,
  insertRowInList,
  matchTableKey,
  memoizedFormulaValue,
  normalizeKeymap,
  type IrisTableKeymap,
  parseCsv,
  removeRowFromList,
  setCellValue,
  toCsv,
  toHtml,
  updateRowInList,
  validateEditRulesAsync,
  type CellEdit,
  type FormulaTables,
  type RemoteTableSource,
  type RemoteTableSourceState,
  type SortableRect,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import { IrisPagination } from '../pagination'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type { IrisTableEmptyState, IrisTableProps, IrisTableProxyConfig } from './props'
import type { IrisTableHandle } from './types'
import { downloadCsv, exportCsv, applyCellMask } from './exportCsv'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { TableChartPanel } from './ChartPanel'
import { TableAuditPanel } from './AuditPanel'
import { TableVersionHistoryPanel } from './VersionHistoryPanel'
import { TablePerfPanel } from './PerfPanel'
import { TableShortcutHintsPanel } from './ShortcutHintsPanel'
import {
  CELL_NOTE_STYLE,
  CHAR_COUNT_HANDLE_SHIFT_STYLE,
  CHAR_COUNT_STYLE,
  COPY_FLASH_BG,
  PRESENCE_LABEL_STYLE,
  RANGE_FILL_HANDLE_STYLE,
  RANGE_FILL_TARGET_BG,
  SEARCH_HIT_STYLE,
  WATERMARK_WRAPPER_STYLE,
  WATERMARK_OVERLAY_STYLE,
  WATERMARK_TILE_STYLE,
} from './styles'

/* Batch AQ drag-fill helpers (module scope): the per-cell fill logic stays
   OUT of the row-render arrow so the eslint complexity budget on that hot
   callback is untouched. Each helper is a pure function of its inputs. */

/** True when this cell is the range's bottom-right cell hosting the handle. */
function isRangeFillHandleCell(
  rangeFill: boolean,
  range: { end: { row: number; col: number } } | null,
  idx: number,
  ci: number,
): boolean {
  return rangeFill && range !== null && range.end.row === idx && range.end.col === ci
}

/** The data-iris-range-fill-target attr value (undefined hides it). */
function rangeFillTargetAttr(isTarget: boolean): string | undefined {
  return isTarget ? 'true' : undefined
}

/** Extra cell style for the fill-handle host (relative + above pinned) and
 * the drag-target highlight (token-driven background). */
function rangeFillCellStyle(handleCell: boolean, targetCell: boolean): React.CSSProperties {
  return {
    ...(handleCell ? { position: 'relative', zIndex: 2 } : null),
    ...(targetCell ? { background: RANGE_FILL_TARGET_BG } : null),
  }
}

/** Batch CE copy flash: is (row, col) inside the copied-range SNAPSHOT? Kept
 * at module scope so the row-render arrow's eslint complexity budget stays
 * untouched (same discipline as the fill helpers above). */
function inCopyFlashRange(range: CellRange | null, row: number, col: number): boolean {
  if (range === null) return false
  return (
    row >= range.start.row && row <= range.end.row && col >= range.start.col && col <= range.end.col
  )
}

/** The data-iris-copy-flash attr value (undefined hides it). */
function copyFlashCellAttr(range: CellRange | null, row: number, col: number): string | undefined {
  return inCopyFlashRange(range, row, col) ? 'true' : undefined
}

/** Batch CH (iris 独有 — vxe has no drag-out pin): a column-drag release
 * outside the table's LEFT edge triggers the drag-out pin (with
 * `columnPinMenu`); releases at/inside the left edge keep the plain reorder
 * path. Pure + DOM-free, so the root pointerup handler and the window
 * pointerup listener resolve through the SAME check. */
function isColDragOutLeft(x: number, rootLeft: number): boolean {
  return x < rootLeft
}

/** The copy-flash background — empty object outside the flashed rect so the
 * spread adds nothing (no operators in the hot arrow). */
function copyFlashCellStyle(
  range: CellRange | null,
  row: number,
  col: number,
): React.CSSProperties {
  if (!inCopyFlashRange(range, row, col)) return {}
  return { backgroundColor: COPY_FLASH_BG }
}

/** The 6px fill handle (data-iris-range-fill), rendered only in the range's
 * bottom-right cell; pointerdown starts the drag (and stops the cell click). */
function renderRangeFillHandle(
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

/* Batch CG charCount (iris 独有 — vxe has no equivalent): the selection badge
   lives at the range's bottom-right cell — the same corner as the fill handle
   — and is a pure reduction over the EXISTING rangeStatsData memo (the same
   material the stats panel consumes): count = Σ column non-null counts, sum =
   Σ numeric column sums (null when NO column in the range has numeric data).
   Returns null when there is nothing to show (no range / no entries). */
function rangeCharCount(
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
function isRangeCharCountHost(
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
function renderRangeCharCountBadge(
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
function charCountCellStyle(
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
interface RowDragDropResolve {
  /** Which edge of the over row the insertion line sits on. */
  side: 'above' | 'below'
  /** Index in the ORIGINAL rows array the dragged row lands at. */
  insertIndex: number
}

function resolveRowDragDrop<Row>(
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
function auditDiff<Row extends Record<string, unknown>>(
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

/** Batch BE: the 45° stripe background-image marking a locked cell — ONE
 * source shared by the injected stylesheet rule (interpolated into
 * TABLE_ROW_CSS below) and the inline cell style. The base cell path uses
 * background-COLOR longhands (fnrCellStyle), so the image survives; the
 * inline re-assertion (spread last in the render) additionally protects
 * against user/conditional `background` shorthands. Token-driven
 * (--iris-muted-subtle exists in both themes). */
const LOCKED_CELL_STRIPE =
  'repeating-linear-gradient(45deg, var(--iris-muted-subtle) 0, var(--iris-muted-subtle) 6px, transparent 6px, transparent 12px)'

/** Batch BJ: the dotted 8pt-grid texture marking a permission-readonly cell —
 * visually distinct from locked's 45° stripes (dynamic permission vs static
 * declaration). Same background-image + inline re-assertion pattern as
 * LOCKED_CELL_STRIPE (a `background` shorthand resets background-image).
 * Token-driven (--iris-muted-subtle exists in both themes). */
const READONLY_CELL_DOTS =
  'radial-gradient(var(--iris-muted-subtle) 1px, transparent 1px) 0 0 / 8px 8px'

const TABLE_ROW_CSS = `
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
@media print {
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
`
import { useTableSort } from './useTableSort'
import { usePersistState } from './usePersistState'
import { useTableViews } from './useTableViews'
import { TableContextMenu } from './ContextMenu'
import { TableFilterPanel } from './FilterPanel'
import { TableDistributionPanel } from './DistributionPanel'
import { TableSummaryPanel } from './SummaryPanel'
import { TableViews } from './TableViews'
import { RangeToolbar, type RangeStatsEntry } from './RangeToolbar'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableConditionalStyle,
  IrisTableContextMenuParams,
  IrisTableEditDirtyConfig,
  IrisTablePresenceEntry,
  IrisTableSortDirection,
  IrisTableFilterValues,
  IrisTablePersistPiece,
  IrisTablePersistedState,
  IrisTableSortState,
} from './types'

/** Map a vxe-style cell alignment to a flex `justifyContent` value. */
const justifyFor = (
  align: 'left' | 'center' | 'right' | undefined,
  fallback: 'left' | 'right' = 'left',
): 'flex-start' | 'center' | 'flex-end' => {
  const resolved = align ?? fallback
  return resolved === 'right' ? 'flex-end' : resolved === 'center' ? 'center' : 'flex-start'
}

/** Dirty-map key (batch Q): `${rowKeyVal}::${colKey}` — the same `::`
 * delimiter as `cellId` so keys/colKeys containing `:` cannot collide
 * (`a:b`/`c` vs `a`/`b:c`). */
const dirtyKey = (rowIdent: string | number, colKey: string): string => `${rowIdent}::${colKey}`

/** Per-cell dirty render state (batch Q, vxe editDirtyConfig parity): a
 * committed cell whose value differs from its pre-edit original is dirty
 * (tracked in the dirty map, keyed `${rowKeyVal}::${colKey}`). `indicator:
 * false` suppresses the dot + relative positioning but keeps tracking;
 * `className: true` adds an `iris-table-cell-dirty` class regardless.
 * Module-level so the cell render's cyclomatic complexity stays flat (a
 * call costs 0). */
const dirtyCellState = (
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
const cellNoteOf = <Row extends Record<string, unknown>>(
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
const cellNoteState = <Row extends Record<string, unknown>>(
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
function renderCellNoteBadge(note: string | null): React.ReactNode {
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
const notePopoverCellHandlers = (
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
const rowHeightStyleOf = (
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
const presenceOf = (
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
const presenceStyle = (
  entries: IrisTablePresenceEntry[] | undefined,
): { outline: string; position: 'relative' } | null =>
  entries && entries.length > 0
    ? { outline: `2px solid ${entries[0].color}`, position: 'relative' }
    : null

/** Batch BD: the corner name labels — one span per entry, cascaded below
 * each other when several share a cell (first entry on top); zero nodes when
 * there is no presence on this cell (same pattern as the range fill handle).
 * Pure display: the label carries the id/name attrs for tests and tooling. */
function renderPresenceLabels(entries: IrisTablePresenceEntry[] | undefined): React.ReactNode {
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

export type { IrisTableProps, IrisTableProxyConfig } from './props'

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

function renderTableWatermark(text: string): React.ReactNode {
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
interface SparklineData<Row extends Record<string, unknown>> {
  rowIndexOf: Map<Row, number>
  valuesByKey: Map<string, unknown[]>
}

/** x of the i-th point (0-based) over `count` points. */
function sparkX(i: number, count: number): number {
  if (count <= 1) return SPARK_W / 2
  return SPARK_PAD + (i / (count - 1)) * (SPARK_W - 2 * SPARK_PAD)
}

/** y of value `v` within the padded [min, max] domain (never a zero span). */
function sparkY(v: number, min: number, max: number): number {
  const span = max - min
  return SPARK_H - SPARK_PAD - ((v - min) / span) * (SPARK_H - 2 * SPARK_PAD)
}

/** Contiguous runs of finite points → polyline segments (a null point breaks
 * the line; each run renders its own polyline — ChartPanel parity). */
function sparkSegments(
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
function sparklineSeries<Row extends Record<string, unknown>>(
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
function sparklineCell<Row extends Record<string, unknown>>(
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
function renderSparkline(series: Array<number | null> | null, colKey: string): React.ReactNode {
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

interface EditorSurfaceProps<Row extends Record<string, unknown>> {
  /** The edit session driving this editor (cell mode: the singleton; row
   *  mode: that column's own session). */
  session: CellEdit
  col: IrisTableColumn<Row>
  /** aria-describedby id of the validation error message. */
  errorId: string
  /** validConfig.showMessage !== false — skip only the message element. */
  showError: boolean
  /** Callback ref so the parent can focus the editor (stable per column). */
  registerRef: (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => void
  onTab: (e: React.KeyboardEvent, dir: 1 | -1) => void
  onCommit: () => void
  onCancel: () => void
  /** Row edit mode: bumped to (re)focus this editor; cell mode focuses via
   *  the singleton editingTarget effect instead (always 0 here). */
  focusToken: number
  /** Row edit mode: fired when the session goes idle (committed) so the
   *  parent can close just this column's editor. */
  onSessionIdle?: () => void
  /** Per-column native datalist options (batch AM, iris 独有): a map of
   *  column key → suggestion strings, computed by the parent over the body
   *  data so this surface stays free of it. Only the text editor consumes it. */
  suggestOptions?: ReadonlyMap<string, string[]>
  /** Batch CC (iris 独有): auto-height textarea editor — grows with content
   *  (1 row start, 6-row cap), sized via scrollHeight on input. Off by
   *  default (fail-closed; batch I's rows=3 stays). */
  editAutoHeight?: boolean
  /** Batch CG (iris 独有): show a live character count in the cell's
   *  bottom-right corner — `String(draft).length`, recomputed per keystroke
   *  via the existing session-store subscription (zero new state). */
  charCount?: boolean
  /** i18n translator (the parent's useI18n instance — same `t` the table uses). */
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Shared inline-editor surface for cell AND row edit modes (batch K).
 * Subscribes to the session's core store so draft/error changes re-render
 * just the editor; the three editor branches (text/number input, select,
 * textarea) are the pre-batch-K UI, just parameterized by the session. Enter
 * commits THAT column (per-cell commit), Escape cancels (the whole row in
 * row mode), blur commits the column, Tab moves between editable columns.
 */
function EditorSurface<Row extends Record<string, unknown>>({
  session,
  col,
  errorId,
  showError,
  registerRef,
  onTab,
  onCommit,
  onCancel,
  focusToken,
  onSessionIdle,
  suggestOptions,
  editAutoHeight,
  charCount,
  t,
}: EditorSurfaceProps<Row>): React.ReactElement {
  const state = useStore(session.store)
  const ref = React.useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null)
  React.useEffect(() => {
    if (focusToken > 0) ref.current?.focus()
  }, [focusToken])
  // A committed session goes idle (editing cleared) — close this column's
  // editor (row mode keeps the rest of the row's editors open).
  React.useEffect(() => {
    if (state.editing === null) onSessionIdle?.()
  }, [state.editing, onSessionIdle])
  // Batch CC: on open, size the auto-height textarea from its pre-filled
  // draft (scrollHeight) — multi-line values arrive already sized; growth /
  // shrink while typing is handled by onInput below (no setState, no
  // re-render loop — the surface re-renders per keystroke anyway via the
  // session store, but the inline height is written straight to the DOM).
  React.useEffect(() => {
    if (!editAutoHeight) return
    const el = ref.current
    if (!el || el.tagName !== 'TEXTAREA') return
    applyEditorAutoHeight(el as HTMLTextAreaElement)
  }, [editAutoHeight])
  const setRef = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null): void => {
    ref.current = el
    registerRef(el)
  }
  // Const bindings let TS keep the select/options narrowing inside the nested
  // JSX callbacks (a mutable `col` would lose it). A select editor with no
  // editOptions falls back to the text input.
  const isSelectEditor = col.editor === 'select' && col.editOptions !== undefined
  const selectOptions = isSelectEditor ? col.editOptions : undefined
  const draft = String(state.draft ?? '')
  const error = state.error
  // Batch AM: a text editor with suggestions renders a native <datalist>
  // (`data-iris-edit-suggest`) linked via `list`; the id comes from useId (the
  // repo's SSR-stable pattern). Only while editing — the surface mounts per session.
  const suggestId = React.useId()
  const suggestList = suggestOptions?.get(col.key)
  // Text editor only: the shared text/number input is the only branch that
  // consumes the datalist — select (with options) and textarea ignore it.
  const showSuggest =
    col.editor !== 'number' &&
    !(isSelectEditor && selectOptions !== undefined) &&
    col.editor !== 'textarea' &&
    suggestList !== undefined &&
    suggestList.length > 0
  return (
    <>
      {isSelectEditor && selectOptions ? (
        // vxe edit-render select parity (batch H): a native <select> commits
        // the option's TYPED value (numbers stay numbers). Value matches
        // options by String(value); when the current draft matches NO option,
        // a synthetic option preserves it so a plain blur never silently
        // replaces the cell value with the first option.
        <select
          ref={setRef}
          value={draft}
          data-iris-table-editor=""
          data-iris-table-editor-select=""
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && showError ? errorId : undefined}
          onChange={(e) => {
            const opt = selectOptions.find((o) => String(o.value) === e.target.value)
            session.setDraft(opt ? opt.value : e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              onTab(e, e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={() => onCommit()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
            font: 'inherit',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            outline: 'none',
          }}
        >
          {!selectOptions.some((o) => String(o.value) === draft) ? (
            <option value={draft}>{draft}</option>
          ) : null}
          {selectOptions.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      ) : col.editor === 'textarea' ? (
        // vxe edit-render textarea parity (batch I): Enter commits, Shift+Enter
        // inserts a newline, Escape cancels — same commit/aria surface.
        // Batch CC: editAutoHeight starts at 1 row and grows with content
        // (6-row cap) via scrollHeight measured on input.
        <textarea
          ref={setRef}
          rows={editAutoHeight ? 1 : 3}
          value={draft}
          data-iris-table-editor=""
          data-iris-table-editor-textarea=""
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && showError ? errorId : undefined}
          onChange={(e) => session.setDraft(e.target.value)}
          onInput={(e) => {
            if (editAutoHeight) applyEditorAutoHeight(e.currentTarget)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              onTab(e, e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={() => onCommit()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
            font: 'inherit',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            outline: 'none',
            resize: 'none',
          }}
        />
      ) : (
        <input
          ref={setRef}
          type={col.editor === 'number' ? 'number' : 'text'}
          value={draft}
          data-iris-table-editor=""
          list={showSuggest ? suggestId : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && showError ? errorId : undefined}
          onChange={(e) => session.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              onTab(e, e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={() => onCommit()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
            font: 'inherit',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            outline: 'none',
          }}
        />
      )}
      {/* Batch AM: native suggestions for the text editor — a datalist with the
      column's distinct values (or the explicit array form), id-linked to the
      input's `list`. Rendered next to the input (datalists are invisible). */}
      {showSuggest ? (
        <datalist id={suggestId} data-iris-edit-suggest="">
          {suggestList.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      ) : null}
      {/* validConfig.showMessage=false: validation still blocks the commit and
      aria-invalid stays — only the message element is skipped (vxe ValidConfig
      parity). */}
      {error && showError ? (
        <div
          id={errorId}
          role="alert"
          data-iris-table-editor-error=""
          style={{
            marginTop: 'var(--iris-space-xxs, 4px)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            color: 'var(--iris-danger)',
          }}
        >
          {error}
        </div>
      ) : null}
      {/* Batch CG (iris 独有): live character count at the cell's bottom-right
      corner — String(draft).length recomputed per keystroke through the
      session-store subscription above (zero new state). The host cell gains
      position: relative from charCountCellStyle so the chip anchors to the
      cell box; pointer-transparent so typing is never intercepted. */}
      {charCount ? (
        <span data-iris-char-count="" data-iris-char-count-edit="" style={CHAR_COUNT_STYLE}>
          {t('table.charCount', { count: String(draft.length) })}
        </span>
      ) : null}
    </>
  )
}

/** Batch CC (iris 独有): the auto-height textarea editor grows with content,
 *  capped at this many rows (spec: max 6). */
const EDITOR_AUTO_MAX_ROWS = 6
/** Batch CC: line-height fallback when getComputedStyle reports 'normal' /
 *  an empty string (jsdom has no layout) or an absurd unitless value. */
const EDITOR_AUTO_FALLBACK_LINE_HEIGHT = 16

/**
 * Batch CC (iris 独有): pure size mapping for the auto-height textarea — from
 * the measured scrollHeight (and the session's line height) to the inline
 * `height` / `maxHeight` / `overflowY` trio. `height` grows with content
 * (floor = one line, cap = EDITOR_AUTO_MAX_ROWS lines) so shrinking content
 * shrinks the editor too; `overflowY` is `auto` only when content STRICTLY
 * exceeds the cap — exactly 6 rows has no scrollbar. Exported for unit tests
 * (the math lives here, not in jsdom's zero-layout DOM).
 */
export function autoHeightSize(
  scrollHeight: number,
  lineHeight: number,
): { height: number; maxHeight: number; overflowY: 'auto' | 'hidden' } {
  const maxHeight = EDITOR_AUTO_MAX_ROWS * lineHeight
  return {
    height: Math.max(lineHeight, Math.min(scrollHeight, maxHeight)),
    maxHeight,
    overflowY: scrollHeight > maxHeight ? 'auto' : 'hidden',
  }
}

/** Batch CC: the editor's line height, measured once per session (module-level
 *  cache — the surface re-measures nothing per keystroke). */
let editorAutoLineHeight: number | null = null

/** Batch CC: read + cache the textarea's line height; 'normal'/empty/absurd
 *  values (jsdom) fall back to EDITOR_AUTO_FALLBACK_LINE_HEIGHT. */
function measureEditorLineHeight(el: HTMLTextAreaElement): number {
  if (editorAutoLineHeight !== null) return editorAutoLineHeight
  let lh = EDITOR_AUTO_FALLBACK_LINE_HEIGHT
  if (typeof window !== 'undefined') {
    const cs = window.getComputedStyle(el).lineHeight
    const parsed = cs && cs !== 'normal' ? Number.parseFloat(cs) : NaN
    if (Number.isFinite(parsed) && parsed >= 8) lh = parsed
  }
  editorAutoLineHeight = lh
  return lh
}

/** Batch CC: measure + apply the auto-height trio (height/maxHeight/overflowY)
 *  to a textarea editor from its current scrollHeight. */
function applyEditorAutoHeight(el: HTMLTextAreaElement): void {
  const size = autoHeightSize(el.scrollHeight, measureEditorLineHeight(el))
  el.style.height = `${size.height}px`
  el.style.maxHeight = `${size.maxHeight}px`
  el.style.overflowY = size.overflowY
}

const RESIZE_STEP = 16
const SELECTION_COL_WIDTH = 40
const EXPAND_COL_WIDTH = 40
const SEQ_COL_WIDTH = 60
const DRAG_COL_WIDTH = 40
const DEFAULT_PINNED_WIDTH = 140
/* Batch CE copy feedback (iris 独有): how long the copied-range highlight
   stays after a SUCCESSFUL range copy before it clears. Re-copy restarts
   the clock; unmount cleanup below. */
const COPY_FLASH_MS = 600
/** Reserved context-menu key for the built-in value-distribution item (batch
 * AM): the table intercepts it at the onSelect wiring, so a user item with
 * the same key is deduped and the user callback never sees it. */
const DISTRIBUTION_MENU_KEY = '__iris_distribution'
/** Reserved context-menu key for the built-in NL-summary item (batch AW):
 * appended AFTER the distribution item when `nlSummary` is set; the table
 * intercepts it at the onSelect wiring, so a user item with the same key is
 * deduped and the user callback never sees it. */
const SUMMARY_MENU_KEY = '__iris-summary'
/** Reserved context-menu key for the built-in annotate-ADD item (batch BB):
 * the table intercepts it at the onSelect wiring, so a user item with the
 * same key is deduped and the user callback never sees it. */
const ANNOTATE_MENU_KEY = '__iris-annotate'
/** Reserved context-menu key for the built-in annotate-EDIT item (batch BB):
 * shown alongside the remove item when the clicked cell already has a note. */
const ANNOTATE_EDIT_MENU_KEY = '__iris-annotate-edit'
/** Reserved context-menu key for the built-in annotate-REMOVE item (batch
 * BB): deletes the cell's annotation directly through `onAnnotationsChange`. */
const ANNOTATE_REMOVE_MENU_KEY = '__iris-annotate-remove'
/** Reserved context-menu key for the built-in COPY-VALUE quick action (batch
 * BW): unconditionally appended on every context menu BEFORE the annotate
 * items; the table intercepts it at the onSelect wiring, so a user item
 * with the same key is deduped and the user callback never sees it. */
const COPY_VALUE_MENU_KEY = '__iris-copy-value'
/** Reserved context-menu key for the built-in CLEAR-CELL quick action (batch
 * BW): unconditionally appended on every context menu BEFORE the annotate
 * items; the table intercepts it at the onSelect wiring, so a user item
 * with the same key is deduped and the user callback never sees it. */
const CLEAR_CELL_MENU_KEY = '__iris-clear-cell'
/** Reserved menu key for the built-in PIN-LEFT item of the column header pin
 * menu (batch BX, iris 独有 — vxe has no header pin menu): the table
 * intercepts it at the onSelect wiring, so a user item with the same key is
 * deduped and the user callback never sees it. */
const PIN_LEFT_MENU_KEY = '__iris-pin-left'
/** Reserved menu key for the built-in UNPIN item of the column header pin
 * menu (batch BX, iris 独有): shown instead of 固定左 when the column is
 * already pinned (left OR right) — the two items are mutually exclusive
 * (spec has no pin-right action). */
const UNPIN_MENU_KEY = '__iris-unpin'

/** Shared style for the full-width empty / loading / error state rows. */
const STATE_ROW_STYLE: React.CSSProperties = {
  padding: '32px 12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
}

/** Inline style for the empty-state action button (batch CF, iris 独有 — vxe
 * has no empty-state action): mirrors the error-row retry button token for
 * token — all `--iris-*` tokens, zero magic values. */
const EMPTY_ACTION_STYLE: React.CSSProperties = {
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-surface)',
  color: 'var(--iris-foreground)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  cursor: 'pointer',
}

/** Discriminator guard: a plain object (not null, not an array, not a React
 * element, not a React-internal marker like portals) is the
 * `IrisTableEmptyState` descriptor; every other ReactNode (strings, elements,
 * fragments, portals, iterables) stays on the node path. */
function isEmptyStateObject(
  state: React.ReactNode | IrisTableEmptyState,
): state is IrisTableEmptyState {
  return (
    typeof state === 'object' &&
    state !== null &&
    !Array.isArray(state) &&
    !React.isValidElement(state) &&
    // React portals carry `$$typeof: REACT_PORTAL_TYPE`, which isValidElement
    // misses; any `$$typeof` marker is React-internal, never a descriptor.
    !('$$typeof' in state)
  )
}

/** Empty-state text: descriptor `.text` (or the localized fallback) vs node. */
function emptyTextOf(
  state: React.ReactNode | IrisTableEmptyState,
  fallback: string,
): React.ReactNode {
  return isEmptyStateObject(state) ? (state.text ?? fallback) : (state ?? fallback)
}

/** Empty-state action button descriptor: `.action` only, null otherwise. */
function emptyActionOf(
  state: React.ReactNode | IrisTableEmptyState,
): { label: string; onClick: () => void } | null {
  return isEmptyStateObject(state) ? (state.action ?? null) : null
}

/** Empty row content: node path renders untouched (zero wrapper — existing
 * ReactNode `emptyState` behaves byte-identically); descriptor path renders
 * the text span (12px `marginInlineEnd` when an action follows — error-row
 * retry precedent, RTL-safe) plus the action button on the same centered row. */
function renderEmptyState(
  state: React.ReactNode | IrisTableEmptyState,
  fallback: string,
): React.ReactNode {
  if (!isEmptyStateObject(state)) return state ?? fallback
  const action = emptyActionOf(state)
  return (
    <>
      <span
        style={{
          marginInlineEnd: action ? 'var(--iris-space-sm, 12px)' : 0,
        }}
      >
        {emptyTextOf(state, fallback)}
      </span>
      {action ? (
        <button
          type="button"
          data-iris-empty-action=""
          onClick={action.onClick}
          style={EMPTY_ACTION_STYLE}
        >
          {action.label}
        </button>
      ) : null}
    </>
  )
}

/** Empty parse result shared by the query bar (STABLE reference). */
const EMPTY_QUERY_PARSE: ParsedTableQuery = {
  filters: {},
  inValues: {},
  rules: [],
  sort: null,
  error: null,
}

/** Null-proxy snapshot for useSyncExternalStore (a STABLE reference is required). */
const EMPTY_PROXY_STATE: RemoteTableSourceState<never> = {
  data: [],
  total: 0,
  loading: false,
  error: null,
  params: { page: 1, pageSize: 10, sort: null, filters: {} },
}
const noopProxySubscribe = (): (() => void) => () => {}

/**
 * Focusable resize grip at a column header's trailing edge. Pointer drag (via
 * `useDrag`) or Arrow-Left/Right adjusts the column's pixel width. `role=
 * "separator"` + `aria-orientation` follow the WAI-ARIA window-splitter pattern.
 */
function ColumnResizeHandle({
  colKey,
  label,
  width,
  minWidth,
  maxWidth,
  onResize,
}: {
  colKey: string
  label: string
  width: number | undefined
  minWidth: number
  maxWidth: number
  onResize: (key: string, width: number) => void
}): React.ReactElement {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const startRef = React.useRef(0)
  const clamp = (w: number): number => Math.max(minWidth, Math.min(maxWidth, Math.round(w)))
  // Prefer the explicit override; fall back to the rendered header width.
  const measure = (): number =>
    width ?? ref.current?.parentElement?.getBoundingClientRect().width ?? minWidth

  useDrag({
    handle: ref,
    onStart: () => {
      startRef.current = measure()
    },
    onDrag: ({ dx }) => onResize(colKey, clamp(startRef.current + dx)),
  })

  return (
    <span
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      tabIndex={0}
      data-iris-table-resize-handle=""
      data-column-key={colKey}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          onResize(colKey, clamp(measure() - RESIZE_STEP))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          onResize(colKey, clamp(measure() + RESIZE_STEP))
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 8,
        cursor: 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
      }}
    />
  )
}

function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  // Batch AO formula columns: every data consumer (render, filter, groupBy,
  // suggest, range stats, summary, tooltips, clipboard, distribution) funnels
  // through this choke point — the COMPUTED value propagates everywhere.
  // memoizedFormulaValue caches per (row, formula) under the table's
  // documented immutable-row contract (new row reference = recompute).
  // Batch BC: cross-table refs (`=other!col`) read the render-scoped
  // currentFormulaTables slot — React's synchronous render walk assigns it
  // before any consumer runs, so multi-table pages stay isolated; the
  // mount-time CSV export handles pass an explicit argument instead.
  if (column.formula) return memoizedFormulaValue(column.formula, row, currentFormulaTables)
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

// Batch BC: external tables for cross-table formula refs. Module slot, NOT a
// closure — getCellValue is a module-level function shared by ~30 render-time
// call sites + the querySortedData comparator. Assigned at the top of every
// IrisTable render (before any useMemo body runs) and read only from
// synchronous render/effect paths; the on-demand CSV export handles use the
// formulaTablesRef mirror with an explicit argument (dual-channel, see below).
let currentFormulaTables: FormulaTables | undefined

/** Batch AO: a formula column is DISPLAY-ONLY even when `editable` — every
 * editing entry point (inline, row mode, batch panel, data-editable attr,
 * cursor) reads this same condition. */
function isEditableColumn<Row extends Record<string, unknown>>(col: IrisTableColumn<Row>): boolean {
  return !!col.editable && !col.formula
}

/** Batch BE: a cell is locked when the column says so — `true` locks the
 * whole column, a predicate locks per-row (a predicate ignoring its column
 * argument is a row-level lock). Module-level so EVERY editing entry point
 * (inline, row mode, batch panel, paste/fill/clear/FNR/Delete funnels) and
 * the cell render (attr + cursor) read the same condition — one truth. */
function isCellLocked<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
): boolean {
  return typeof col.locked === 'function' ? col.locked(row, col) : col.locked === true
}

/** Batch BJ: a cell is permission-readonly when the column predicate says so —
 * `'readonly'` locks editing, absent/`'editable'` → editable (default).
 * DYNAMIC: unlike `locked` (a static declaration), the predicate re-evaluates
 * on every render, so permission follows the current row/column state without
 * a re-mount. Same single-throat contract as isCellLocked — every editing
 * entry point reads this condition. */
function isCellReadonly<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
): boolean {
  return col.cellPermission?.(row, col) === 'readonly'
}

/** Batch BR (iris 独有): does the column participate in the validation-
 *  summary ledger? Only declarative `editRules` columns count (legacy
 *  `validate` columns, paste/fill/FNR/batch bypasses and Escape cancels
 *  never reach it). Single truth shared by the cell and row commit wrappers. */
function hasEditRules<Row extends Record<string, unknown>>(col: IrisTableColumn<Row>): boolean {
  return !!col.editRules && col.editRules.length > 0
}

/** Batch BE+BJ: locked/readonly cell render material — the data attrs + the
 * dropped cursor, extracted so renderRow stays under the complexity budget.
 * Locked wins visually when both (stripes + not-allowed, no readonly attr);
 * readonly falls back to the dotted texture + not-allowed (only when the
 * column is editable — a non-editable readonly cell keeps the default).
 * Range cells keep the default cursor. */
function cellPermissionRender(
  locked: boolean,
  readonly: boolean,
  editable: boolean,
  hasRange: boolean,
): {
  lockedAttr: 'true' | undefined
  readonlyAttr: 'true' | undefined
  cursor: string | undefined
  style: React.CSSProperties
} {
  if (locked) {
    return {
      lockedAttr: 'true',
      readonlyAttr: undefined,
      cursor: 'not-allowed',
      // Spread LAST in the cell style so the stripes survive every
      // background shorthand (range-fill/conditional/user cellStyle) —
      // background-color highlights still show through the transparent gaps.
      style: { backgroundImage: LOCKED_CELL_STRIPE },
    }
  }
  if (readonly) {
    return {
      lockedAttr: undefined,
      readonlyAttr: 'true',
      cursor: editable ? 'not-allowed' : hasRange ? 'default' : undefined,
      style: { backgroundImage: READONLY_CELL_DOTS },
    }
  }
  return {
    lockedAttr: undefined,
    readonlyAttr: undefined,
    cursor: editable ? 'cell' : hasRange ? 'default' : undefined,
    style: {},
  }
}

/** CSV export shadow rows (batch AO): core `toCsv` reads `row[dataIndex]`
 * directly, so formula columns materialize their computed value onto a
 * shallow copy (original rows untouched — immutable contract). No formula
 * columns → the input array is returned as-is (reference-preserving). */
function withComputedFormulaCells<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
  formulaTables?: FormulaTables,
): Row[] {
  const formulaCols = columns.filter((c) => c.formula)
  if (formulaCols.length === 0) return rows as Row[]
  return rows.map((row) => {
    let shadow: Row | null = null
    for (const col of formulaCols) {
      const key = (col.dataIndex ?? col.key) as keyof Row
      const next: Row = shadow ?? { ...row }
      ;(next as Record<string, unknown>)[key as string] = memoizedFormulaValue(
        col.formula!,
        row,
        formulaTables,
      )
      shadow = next
    }
    return shadow as Row
  })
}

/** Batch AL: structural equality for undo snapshots — same length + same row
 *  references (the table never mutates rows, so content equality reduces to
 *  reference equality on the row objects). Skips no-op pushes (re-commits of
 *  an identical list, and the rowId fallback path where setCellValue cannot
 *  locate the row) so dead undo steps never accumulate. */
function sameRowList<Row extends Record<string, unknown>>(a: Row[], b: Row[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// ── Clipboard batch O (clipConfig): TSV serialization + safe clipboard ──
// Cell text for the copy TSV: null → '', numbers verbatim (a typed number
// cannot carry a formula payload), everything else gets the same OWASP
// formula neutralization as core `toCsv` (a leading = + - @ tab CR is quoted
// so spreadsheets import it as literal text). Cell text containing \t or \n
// is a documented limitation of the newline/tab-delimited TSV shape.
const TSV_FORMULA_LEAD = /^[=+\-@\t\r]/
function tsvCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return text
  return TSV_FORMULA_LEAD.test(text) ? `'${text}` : text
}

// Range CSV export (batch AH): RFC-4180 field quoting + the same OWASP
// formula neutralization as `tsvCell` / core `toCsv` (a leading = + - @ tab CR
// is prefixed with a quote so spreadsheets import it as literal text). The
// range export is HEADERLESS by design — a range is a rectangle of cells, not
// a table view (baseline fiat).
const CSV_FORMULA_LEAD = /^[=+\-@\t\r]/
function csvRangeCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return text
  const safe = CSV_FORMULA_LEAD.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

// ── Compare-diff export (batch BV, iris 独有) ───────────────────────────
// The reserved key of the marker column prefixed to every exported diff row:
// the English literal added/removed/changed (machine-readable), headed by the
// i18n `table.compare.diff` title (en `Diff` / zh `差异`).
const COMPARISON_DIFF_KEY = '__iris_diff'

/**
 * Build the compare-diff CSV (batch BV, iris 独有 — vxe has no compare
 * capability, let alone its export): current-view rows whose status is
 * `removed`/`changed` in VIEW order (the same `filteredData` source as
 * `exportCurrentViewCsv`), then `compareWith`-only `added` rows at the tail
 * in SNAPSHOT order (no render slot, batch AU documented). Every row is
 * prefixed with a marker column (`__iris_diff`) and unchanged rows are
 * excluded. Changed cells export a `maskedOld → maskedNew` composite — mask
 * BEFORE composition (the batch AY default mask must never leak a bare value
 * through the composite; `exportRaw` keeps both sides bare); formula columns
 * do NOT self-composite (batch AU documented — their own cell diffs are not
 * reported; the referenced field cells are, and formulas still materialize
 * from PRISTINE data so a changed input can never leak its composite into a
 * dependent formula). Serialization shape = `exportCsv`'s: formula columns
 * materialized on shadow rows, batch AY masks applied, hidden columns
 * excluded (the caller passes `viewColumnsRef`), RFC-4180 quoting + OWASP
 * neutralization via core `toCsv`. Feature-off is NOT this function's
 * concern — the handle gates on the render memo being null.
 */
function buildComparisonCsv<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  snapshot: readonly Row[],
  rowKeyField: string,
  diff: RowDiff,
  columns: readonly IrisTableColumn<Row>[],
  formulaTables: FormulaTables | undefined,
  markerTitle: string,
): string {
  // Diff row list: view-order removed/changed + snapshot-order added. Marker
  // lands on a shadow row (original rows untouched — immutable contract).
  const out: Row[] = []
  for (const row of rows) {
    const key = row[rowKeyField] as string | number | null | undefined
    if (key == null) continue
    const kind = diff.status.get(key)
    if (kind !== 'removed' && kind !== 'changed') continue
    out.push({ ...row, [COMPARISON_DIFF_KEY]: kind } as Row)
  }
  const snapshotByKey = new Map<string | number, Row>()
  for (const r of snapshot) {
    const k = r[rowKeyField] as string | number | null | undefined
    if (k == null) continue
    snapshotByKey.set(k, r)
  }
  for (const key of diff.added) {
    const row = snapshotByKey.get(key)
    if (row) out.push({ ...row, [COMPARISON_DIFF_KEY]: 'added' } as Row)
  }
  // Formula columns materialize from PRISTINE rows (the composite pass below
  // overwrites only non-formula changed cells, so no composite ever feeds a
  // formula). `withComputedFormulaCells` spreads rows, marker preserved.
  let materialized = withComputedFormulaCells(out, columns, formulaTables)
  // Batch AY default mask: every masked column (unless `exportRaw`) exports
  // the masked value. Runs BEFORE the composite pass — a changed cell's
  // composite then overwrites this field, so the composite is masked-before-
  // composition and never re-masked by this pass.
  const maskedCols = columns.filter((c) => c.mask && !c.exportRaw)
  if (maskedCols.length > 0) {
    materialized = materialized.map((row) => {
      let shadow: Row | null = null
      for (const col of maskedCols) {
        const key = (typeof col.dataIndex === 'string' ? col.dataIndex : col.key) as keyof Row
        const next: Row = shadow ?? { ...row }
        ;(next as Record<string, unknown>)[key as string] = applyCellMask(
          (row as Record<string, unknown>)[key as string],
          col,
        )
        shadow = next
      }
      return shadow as Row
    })
  }
  // Composite pass: changed cells of non-formula columns export
  // `maskedOld → maskedNew` (`exportRaw` keeps both sides bare). Overwrites
  // the masked raw value above — the composite itself is never re-masked.
  const withComposite = materialized.map((row) => {
    const kind = (row as Record<string, unknown>)[COMPARISON_DIFF_KEY]
    if (kind !== 'changed') return row
    const key = (row as Record<string, unknown>)[rowKeyField] as string | number | null | undefined
    const changes = key == null ? undefined : diff.cellChanges.get(key)
    if (!changes) return row
    let shadow: Row | null = null
    for (const col of columns) {
      if (col.formula) continue
      const cellKey = (col.dataIndex ?? col.key) as keyof Row
      const change = changes.get(cellKey as string)
      if (!change) continue
      const oldSide = col.exportRaw ? change.oldValue : applyCellMask(change.oldValue, col)
      const newSide = col.exportRaw ? change.newValue : applyCellMask(change.newValue, col)
      const next: Row = shadow ?? { ...row }
      ;(next as Record<string, unknown>)[cellKey as string] = `${String(oldSide ?? '')} → ${String(
        newSide ?? '',
      )}`
      shadow = next
    }
    return (shadow ?? row) as Row
  })
  return toCsv(withComposite as readonly Record<string, unknown>[], [
    { key: COMPARISON_DIFF_KEY, title: markerTitle, dataIndex: COMPARISON_DIFF_KEY },
    ...columns.map((c) => ({
      key: c.key,
      title: c.title,
      dataIndex: typeof c.dataIndex === 'string' ? c.dataIndex : undefined,
    })),
  ])
}

/** Read clipboard text; null when unavailable or denied (jsdom: no-op). */
async function readClipboardText(): Promise<string | null> {
  const nav = navigator as Navigator & { clipboard?: { readText?: () => Promise<string> } }
  if (!nav.clipboard?.readText) return null
  try {
    return await nav.clipboard.readText()
  } catch {
    return null
  }
}

/**
 * Batch BW: the display text of a context-menu cell — `applyCellMask` mask
 * first, formatter second, `String` coercion (null/undefined → '') — the
 * SAME display chain as the cell body and `cellTooltip`, so the 复制值 quick
 * action copies exactly what the user sees.
 */
function contextCellText<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
): string {
  const displayValue = applyCellMask(getCellValue(row, col), col)
  if (col.formatter) {
    const formatted = col.formatter(displayValue, row)
    if (typeof formatted === 'string') return formatted
  }
  return String(displayValue ?? '')
}

/**
 * Batch CA (iris 独有 — vxe has no auto-link): the `autoLink` cell body —
 * the same display chain as `contextCellText` (mask → formatter ?? raw) —
 * renders an `<a data-iris-auto-link>` only when the final text is a string
 * that core `detectAutoLink` matches (whole-text URL/email, _blank +
 * noreferrer, click does not bubble into row/range handlers). Non-matching
 * text falls through to the formatter/raw branches byte-identically (a
 * non-string formatter result or non-string raw value returns it as-is, so
 * this branch is a drop-in replacement for the plain path).
 */
function renderAutoLinkCell<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
): React.ReactNode {
  const displayValue = applyCellMask(getCellValue(row, col), col)
  let detected: string | null = null
  let text: string | null = null
  if (col.formatter) {
    const formatted = col.formatter(displayValue, row)
    if (typeof formatted !== 'string') return formatted
    text = formatted
  } else if (typeof displayValue === 'string') {
    text = displayValue
  } else {
    return displayValue as React.ReactNode
  }
  detected = detectAutoLink(text)
  if (!detected) return text
  return (
    <a
      data-iris-auto-link=""
      href={detected}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </a>
  )
}

/**
 * Batch CK (iris 独有 — vxe has no inline search highlight): the
 * `searchHighlight` cell body — the same display chain as the plain
 * formatter/raw branches (mask → formatter ?? raw, exactly what autoLink
 * consumes) — renders a `<mark data-iris-search-hit>` around every
 * case-insensitive literal occurrence of the query (core `splitSearchHits`,
 * odd segment indices are hits). Non-string nodes and null segments (empty
 * query / empty text / no match) pass through untouched, so this branch is
 * a drop-in replacement for the plain path — byte-identical without the
 * prop (fail-closed).
 */
function applySearchHighlight(node: React.ReactNode, query: string | undefined): React.ReactNode {
  if (!query || typeof node !== 'string') return node
  const segments = splitSearchHits(node, query)
  if (!segments) return node
  return segments.map((seg, i) =>
    i % 2 === 1 ? (
      <mark key={i} data-iris-search-hit="" style={SEARCH_HIT_STYLE}>
        {seg}
      </mark>
    ) : (
      seg
    ),
  )
}

/**
 * Write clipboard text — best-effort, ordered: registered host handler
 * (core `copyText`) → `navigator.clipboard.writeText` → hidden-textarea
 * `execCommand('copy')` fallback. In test environments without a clipboard
 * stub every step no-ops safely (never throws). Returns `true` when at
 * least one channel actually took the copy — the batch-CE copy-feedback
 * highlight gates on this (spec: “复制成功后”).
 */
async function writeClipboardText(text: string): Promise<boolean> {
  if (await copyText(text)) return true
  const nav = navigator as Navigator & { clipboard?: { writeText?: (t: string) => Promise<void> } }
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text)
      return true
    } catch {
      /* permission denied — fall through to the legacy path */
    }
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    /* no-op */
  }
  ta.remove()
  return copied
}

/** Case-insensitive replace of every occurrence (fnr replace / replace-all). */
function replaceAllOccurrences(text: string, query: string, replacement: string): string {
  if (query === '') return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Function replacement keeps `$` patterns in the replacement literal.
  return text.replace(new RegExp(escaped, 'gi'), () => replacement)
}

/**
 * Cell background/color for fnr highlighting, folded into the cell style:
 * active match → primary fill, any match → surface-selected, otherwise the
 * pre-existing range/striped logic. Token-driven only (no raw colors).
 * BACKGROUND-COLOR longhand (batch BE): the `background` shorthand would
 * reset background-image — silently killing the locked-cell stripes and
 * tripping React's shorthand/longhand mixing warning on rerender.
 */
function fnrCellStyle(
  fnrActive: boolean,
  fnrMatched: boolean,
  rangeSelected: boolean,
  stripedRow: boolean,
): React.CSSProperties {
  return {
    backgroundColor: fnrActive
      ? 'var(--iris-primary, #6366f1)'
      : fnrMatched || rangeSelected
        ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
        : stripedRow
          ? 'var(--iris-surface)'
          : 'transparent',
    ...(fnrActive ? { color: 'var(--iris-primary-foreground, #fff)' } : null),
  }
}

/**
 * Batch AX conditional formatting: fold the ordered rule list into the body
 * cell's inline style — rules evaluate in array order and later matches win
 * (the same spread-order latitude `cellStyle` already has). The `value` is
 * the raw cell value (getCellValue: dataIndex ?? key, formula computed).
 * Early-returns null when no rules are set; inline per-cell evaluation with
 * cost = visibleCells × rules (no memo — virtual scroll bounds the cell
 * count and callers memoize the rules array).
 */
function conditionalCellStyle<Row extends Record<string, unknown>>(
  rules: readonly IrisTableConditionalStyle<Row>[] | undefined,
  row: Row,
  columnKey: string,
  value: unknown,
): React.CSSProperties | null {
  if (!rules || rules.length === 0) return null
  const merged = matchConditionalStyles(rules, row, columnKey, value)
  return Object.keys(merged).length > 0 ? merged : null
}

/** Shared inline style for the fnr bar buttons (token-driven only). */
const FNR_BUTTON_STYLE: React.CSSProperties = {
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  background: 'var(--iris-surface)',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  fontFamily: 'inherit',
}

/** Shared style for the annotate panel action buttons (token-only, batch BB). */
const ANNOTATE_ACTION_STYLE: React.CSSProperties = {
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  background: 'var(--iris-surface)',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  fontFamily: 'inherit',
}

/**
 * Batch I: fold the checked filter sets into the query filter map as
 * comma-joined strings (vxe filter-multiple remote serialization parity).
 * Keys with an empty checked set are left untouched.
 */
function mergeFilterValues(
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
function mergeQueryIntoFilters(
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
function nextRowMajorCell(
  current: GridCell,
  dir: 1 | -1,
  rowCount: number,
  colCount: number,
): GridCell {
  const index = current.row * colCount + current.col + dir
  if (index < 0 || index >= rowCount * colCount) return current
  return { row: Math.floor(index / colCount), col: index % colCount }
}

/**
 * Floating annotation editor (batch BB, iris 独有 — vxe has no note
 * editing). Opens from the context menu's built-in `__iris-annotate` /
 * `__iris-annotate-edit` items and rides the SAME virtual cursor anchor the
 * menu used, so it appears exactly where the user right-clicked. Built with
 * the same building blocks as `TableContextMenu` — `useFloating` +
 * `useDismiss` + portal — with the same dismissal set (Escape / outside
 * pointer-down / any scroll).
 *
 * The textarea is seeded from `annotations[cellKey]` (`current`); 保存 with
 * empty text removes the key, non-empty sets it — both routed to the table's
 * `onAnnotationsChange` channel via `onSave`/`onRemove`. 删除 renders only
 * when a note exists. Without `onAnnotationsChange` the buttons are inert
 * (documented — the table never calls them). Every color is a `--iris-*`
 * token.
 */
function TableAnnotatePanel({
  open,
  anchorRef,
  cellKey,
  current,
  onSave,
  onRemove,
  onClose,
  t,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  cellKey: string
  current: string | undefined
  onSave: (text: string) => void
  onRemove: () => void
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [text, setText] = React.useState(current ?? '')

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-start',
    flip: false,
    shift: false,
  })

  useDismiss({
    enabled: open,
    exclude: [panelRef],
    onDismiss: onClose,
  })

  // Scroll anywhere closes the panel (capture phase — nested scrollers count).
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onScroll = (): void => onCloseRef.current()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [open])

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={current ? t('table.annotate.edit') : t('table.annotate')}
      data-iris-annotate-panel=""
      data-iris-annotate-cell={cellKey}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-xs, 8px)',
        minWidth: 220,
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <textarea
        data-iris-annotate-input=""
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label={current ? t('table.annotate.edit') : t('table.annotate')}
        style={{
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-sm, 4px)',
          padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
          font: 'inherit',
          resize: 'vertical',
          minHeight: 64,
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--iris-space-xs, 8px)',
        }}
      >
        {current ? (
          <button
            type="button"
            data-iris-annotate-remove=""
            onClick={onRemove}
            style={{ ...ANNOTATE_ACTION_STYLE, color: 'var(--iris-danger)' }}
          >
            {t('table.annotate.remove')}
          </button>
        ) : null}
        <button
          type="button"
          data-iris-annotate-save=""
          onClick={() => onSave(text)}
          style={ANNOTATE_ACTION_STYLE}
        >
          {t('table.annotate.save')}
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

/**
 * Floating note preview (batch BM, iris 独有 — vxe has no cell-note concept,
 * and its tooltip can only show the cell value). Hovering a noted cell with
 * `notePopover` replaces the native `title` on that cell with this popover:
 * a pure-display tooltip (`role="tooltip"`, pointer-events none so it never
 * steals hover) anchored to the cell's badge corner via the same virtual
 * anchor pattern as `TableContextMenu` — useFloating (placement top, offset
 * 8, flip/shift on) + useDismiss (Escape / outside pointer-down) + capture
 * scroll close + portal. Content-only: no i18n (the note text is user data).
 *
 * No sequence token (unlike the panels): the popover holds no internal state
 * to re-seed, and cell-to-cell hover moves close-then-reopen through
 * mouseleave/mouseenter (the popover is pointer-events none, so the pointer
 * physically leaves the old cell before entering the new one) — autoUpdate
 * re-runs on the fresh mount.
 */
function TableNotePopover({
  open,
  anchorRef,
  cellKey,
  text,
  onClose,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  cellKey: string
  text: string
  onClose: () => void
}): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'top',
    offset: 8,
    flip: true,
    shift: true,
  })

  useDismiss({
    enabled: open,
    exclude: [panelRef],
    onDismiss: onClose,
  })

  // Scroll anywhere closes the popover (capture phase — nested scrollers count).
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onScroll = (): void => onCloseRef.current()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [open])

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="tooltip"
      data-iris-note-popover=""
      data-iris-note-cell={cellKey}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-xs, 8px)',
        maxWidth: 280,
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
        fontSize: 'var(--iris-font-size-sm, 13px)',
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

/**
 * Data-driven table. Renders as a CSS-grid layout (no native `<table>`) so it
 * can support future virtual scroll / column resize uniformly. Wires ARIA
 * roles (`table` / `row` / `columnheader` / `cell`) for screen readers.
 *
 * Sortable columns cycle `none → asc → desc → none` on click.
 */
export function IrisTable<Row extends Record<string, unknown>>({
  columns,
  data,
  rowKey = 'id',
  selectable = 'none',
  selection: selectionProp,
  defaultSelection,
  onSelectionChange,
  sort: sortProp,
  defaultSort,
  onSortChange,
  multiSort = false,
  multiSortState: multiSortStateProp,
  defaultMultiSort,
  onMultiSortChange,
  striped = false,
  size,
  seqStartIndex = 1,
  seqMethod,
  currentRowKey,
  onCurrentRowChange,
  beforeCurrentRowChange,
  currentColumnKey,
  onCurrentColumnChange,
  beforeCurrentColumnChange,
  onHeaderClick,
  showHeader = true,
  footerData,
  footerMethod,
  footerSpanMethod,
  headerAlign,
  footerAlign,
  aggregateAccuracy,
  highlightHoverRow = true,
  showHeaderOverflow = true,
  showFooterOverflow = true,
  watermark,
  height,
  minHeight,
  maxHeight,
  scrollbarConfig,
  editDirtyConfig,
  autoResize = false,
  syncResize = false,
  keepSource = false,
  zIndex,
  rowId,
  mergeFooterItems,
  rowClassName,
  cellClassName,
  headerCellClassName,
  footerCellClassName,
  rowStyle,
  cellStyle,
  conditionalStyles,
  headerCellStyle,
  footerCellStyle,
  onCellClick,
  onCellDblClick,
  bordered = true,
  round = false,
  padding,
  resizableColumns = false,
  columnWidths: columnWidthsProp,
  defaultColumnWidths,
  onColumnWidthsChange,
  columnWidthsReset,
  columnPinMenu,
  pinnedColumns,
  onColumnPinnedChange,
  onRowClick,
  onRowDblClick,
  onCellEdit,
  onEditStart,
  onEditClosed,
  editAutosave,
  onAutosave,
  editAutoHeight,
  charCount,
  shortcutHints,
  onSelectAllChange,
  onScroll,
  tableRef,
  onDataChange,
  checkMethod,
  pagerConfig,
  editConfig,
  validConfig,
  rowDrag,
  columnDrag,
  columnVisibility,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  filters,
  onFiltersChange,
  filterValues,
  onFilterValuesChange,
  formConfig,
  toolbar,
  zoomConfig,
  layouts,
  tooltipConfig,
  annotations,
  cellNote,
  notePopover,
  annotationEditing,
  onAnnotationsChange,
  presence,
  headerTooltipConfig,
  footerTooltipConfig,
  contextMenu,
  valueDistribution,
  nlSummary,
  chartPreview,
  autoRefresh,
  freshness,
  validationSummary,
  auditLog,
  perfStats,
  versionHistory,
  compareWith,
  autoLink = false,
  recentFilters = false,
  formulaTables,
  printable = false,
  seq = false,
  spanMethod,
  mergeHeaderCells,
  renderDetail,
  rowExpandable,
  defaultExpandedRowKeys,
  expandAll = false,
  onExpandedRowsChange,
  onExpandChange,
  onTreeExpandChange,
  getSubRows,
  lazyLoad,
  keyboardNavigation = false,
  tableShortcuts = false,
  keymap,
  groupBy,
  groupCollapsed,
  defaultGroupCollapsed,
  onGroupCollapseChange,
  cellRange = false,
  rangeFill = false,
  clipConfig,
  fnr = false,
  searchHighlight,
  undo = false,
  checkboxRange = false,
  selectionDrag = false,
  virtualScroll,
  rowHeight,
  persistState,
  views,
  onActiveViewChange,
  query,
  onQueryChange,
  columnVirtualization = false,
  emptyState,
  loading = false,
  error = false,
  loadingState,
  errorState,
  onRetry,
  proxyConfig,
  showCellRefs = false,
  selectionSummary = false,
  style,
  className,
  ...rest
}: IrisTableProps<Row>): React.ReactElement {
  // Batch BN (iris 独有): ONE throat for per-row heights — `rowHeight` wins
  // over `virtualScroll.itemHeight`; unset = existing behavior byte-identical
  // (virtual mode falls back to the virtualizer's itemHeight, non-virtual
  // rows keep natural content height). Consumers: renderBodyEntry (inline
  // height), IrisVirtualScroll (slot height source) and PageUp/PageDown
  // (paging step) — all three read this same resolved source.
  const effectiveRowHeight = rowHeight ?? virtualScroll?.itemHeight
  // Batch BC: scope the external tables for this render — every getCellValue
  // / querySortedData evaluation below runs synchronously during THIS render,
  // and React's render walk is atomic per component (assigned before any
  // useMemo body executes; a StrictMode double-render re-assigns idempotently).
  // On-demand handle calls (CSV export) bypass this slot via formulaTablesRef.
  currentFormulaTables = formulaTables
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('iris-table-row-styles')) return
    const style = document.createElement('style')
    style.id = 'iris-table-row-styles'
    style.textContent = TABLE_ROW_CSS
    document.head.appendChild(style)
  }, [])

  const { t } = useI18n()
  // Batch BL perf sampling: render-top mark — `nowMs()` (performance.now
  // with a Date.now fallback for SSR/jsdom). The dependency-less
  // useLayoutEffect below (after bodyData resolves) measures render + layout
  // duration from this mark after EVERY commit. Off = zero cost (the effect
  // gate skips the push; the mark itself is one number store).
  const perfStartRef = React.useRef(0)
  perfStartRef.current = nowMs()
  // Batch AO cell references: `showCellRefs` adds Excel-style A/B/C letter
  // badges + a leading row-number column. When `seq` is on the seq column IS
  // the row number — one leading number column either way.
  const showRowNumbers = seq || showCellRefs
  // Defensive: null/undefined columns → empty array
  const safeColumns = React.useMemo(() => columns ?? [], [columns])
  // Column visibility (vxe columnConfig.visible parity): filter hidden
  // columns out of every render path (header, body, summary).
  //
  // Column order (vxe customConfig parity, batch S): a controlled key list
  // that reorders the rendered stack. Keys not named in the order keep their
  // relative position AFTER the ordered ones; unknown order keys are
  // ignored. Reference-preserving: without the prop the result IS
  // `safeColumns` (byte-identical with the pre-order render path). Grouped
  // tables address top-level columns only.
  const columnOrderIndex = React.useMemo(() => {
    const map = new Map<string, number>()
    columnOrder?.forEach((key, i) => {
      if (!map.has(key)) map.set(key, i)
    })
    return map
  }, [columnOrder])

  // Batch AN column presets (iris 独有): a column with `preset` gets the
  // preset's display defaults merged in by the core factory — defined-fields-
  // only, user fields win (a plain spread would let `align: undefined` kill
  // the default). Recursive over `children` so grouped headers' leaves
  // inherit; when no column in the tree uses a preset the result IS
  // `safeColumns` (reference-preserving, byte-identical with the pre-preset
  // render path). `orderedColumns` (and everything downstream) consumes this.
  const presetColumns = React.useMemo(() => {
    const hasPreset = (cols: readonly IrisTableColumn<Row>[]): boolean =>
      cols.some((c) => c.preset !== undefined || (c.children ? hasPreset(c.children) : false))
    const applyPreset = (col: IrisTableColumn<Row>): IrisTableColumn<Row> => {
      const resolved = col.preset ? applyColumnPreset(col, col.preset) : col
      if (resolved.children && resolved.children.length > 0) {
        return { ...resolved, children: resolved.children.map(applyPreset) }
      }
      return resolved
    }
    return hasPreset(safeColumns) ? safeColumns.map(applyPreset) : safeColumns
  }, [safeColumns])

  const orderedColumns = React.useMemo(() => {
    if (!columnOrder || columnOrder.length === 0) return presetColumns
    const ordered = presetColumns.filter((c) => columnOrderIndex.has(c.key))
    const rest = presetColumns.filter((c) => !columnOrderIndex.has(c.key))
    ordered.sort((a, b) => columnOrderIndex.get(a.key)! - columnOrderIndex.get(b.key)!)
    return [...ordered, ...rest]
  }, [presetColumns, columnOrder, columnOrderIndex])

  const displayColumns = React.useMemo(() => {
    let cols = orderedColumns
    if (columnVisibility) cols = cols.filter((c) => columnVisibility[c.key] !== false)
    // Batch U (vxe column visibleMethod parity): a per-column no-arg
    // predicate evaluated in this memo — at most once per render. `false`
    // HIDES the column and WINS over `columnVisibility: true` (a column
    // whose own predicate vetoes itself must not render); absent / `true`
    // keeps it. Filtering is reference-preserving when nothing uses it.
    if (cols.some((c) => c.visibleMethod)) {
      cols = cols.filter((c) => (c.visibleMethod ? c.visibleMethod() !== false : true))
    }
    return cols
  }, [orderedColumns, columnVisibility])

  // Multi-level (grouped) headers: a column with `children` forms a header group. The BODY always renders the leaf columns; only the header gains extra rows.

  // When nothing is grouped, `leafColumns` is the original `safeColumns` (same
  // reference) so the flat path is byte-identical.
  const grouped = React.useMemo(
    () => safeColumns.some((c) => c.children && c.children.length > 0),
    [safeColumns],
  )
  const leafColumns = React.useMemo(
    () => (grouped ? flattenLeafColumns(displayColumns) : displayColumns),
    [grouped, displayColumns],
  )
  // Batch W: the view handle methods (getFilteredData / exportCurrentViewCsv)
  // run against the mount-time handle, so mirror the latest visible LEAF
  // columns per render (same pattern as liveDataRef / displaySelectionRef
  // below). In flat mode leafColumns is reference-identical to
  // displayColumns; in grouped mode it carries the data-bearing leaves.
  const viewColumnsRef = React.useRef(leafColumns)
  viewColumnsRef.current = leafColumns
  const headerMatrix = React.useMemo(
    () => (grouped ? buildHeaderMatrix(displayColumns) : null),
    [grouped, displayColumns],
  )

  // ── Batch AI: natural-language query (iris 独有, controlled-only) ────────
  // The query string is parsed by the core parseTableQuery grammar against the
  // leaf column keys (case-insensitive; the matched canonical key = the column
  // key). Parse on every change; on a parse error the LAST VALID parse is kept
  // (ref — same pattern as filteredDataRef) so the table keeps filtering by the
  // previous query while the input shows the error hint below it.
  const queryParsedRef = React.useRef<ParsedTableQuery>(EMPTY_QUERY_PARSE)
  const [queryParsed, queryError] = React.useMemo(() => {
    const fresh = parseTableQuery(query ?? '', { fields: leafColumns.map((c) => c.key) })
    if (fresh.error === null) queryParsedRef.current = fresh
    return [queryParsedRef.current, fresh.error] as const
  }, [query, leafColumns])

  // ── Server-side proxy (vxe-grid proxyConfig parity, query slice) ────────
  // The controller lives in a ref and is created once; the unified core data
  // engine inside it owns paging / latest-wins / dedupe. The bridge only maps
  // state → props and routes sort / filter / page events back to setParams.
  const remoteSort = proxyConfig?.remoteSort === true
  const remoteFilter = proxyConfig?.remoteFilter === true
  const proxyQueryRef = React.useRef<IrisTableProxyConfig<Row>['query'] | undefined>(undefined)
  proxyQueryRef.current = proxyConfig?.query
  const createProxySource = (): RemoteTableSource<Row> =>
    createRemoteTableSource<Row>({
      // The latest query closure is read at request time, so a parent that
      // swaps the query never leaves a stale closure behind.
      query: (params) => proxyQueryRef.current!(params),
      // Kicked from an effect below — never fire a fetch during render.
      autoLoad: false,
      initialParams: {
        page: proxyConfig?.defaultPage ?? 1,
        pageSize: proxyConfig?.pageSize ?? 10,
        sort: remoteSort ? ((sortProp !== undefined ? sortProp : defaultSort) ?? null) : null,
        sorts: remoteSort && multiSort ? (multiSortStateProp ?? defaultMultiSort ?? []) : undefined,
        // Batch AI: the parsed query's substring/in channels join the FIRST
        // remote request so a mounted query does not double-fetch (the
        // remoteFilter effect below covers subsequent changes).
        filters: remoteFilter
          ? mergeQueryIntoFilters(mergeFilterValues(filters ?? {}, filterValues ?? {}), queryParsed)
          : {},
      },
    })
  const proxyRef = React.useRef<RemoteTableSource<Row> | null>(null)
  if (proxyConfig && proxyRef.current === null) {
    proxyRef.current = createProxySource()
  }
  // A proxyConfig-less render never exposes a (possibly destroyed) stale
  // controller: rows/loading/pager all fall back to the null proxy.
  const proxy = proxyConfig ? proxyRef.current : null
  const proxyState = React.useSyncExternalStore(
    proxy ? proxy.subscribe : noopProxySubscribe,
    proxy ? proxy.getState : ((() => EMPTY_PROXY_STATE) as () => RemoteTableSourceState<Row>),
    proxy ? proxy.getState : ((() => EMPTY_PROXY_STATE) as () => RemoteTableSourceState<Row>),
  )
  // Proxy mode drives the table's loading/error UI from the controller state
  // (reusing the existing loading/error props rendering below).
  const tableLoading = proxy ? proxyState.loading : loading
  const tableError = proxy ? proxyState.error !== null : error
  const handleRetry = React.useCallback(() => {
    void proxyRef.current?.refetch()
    onRetry?.()
  }, [onRetry])
  const retry = proxy ? handleRetry : onRetry

  // autoLoad parity: kick the first request from an effect (never during the
  // render phase); tear the controller down when the proxy is removed or the
  // table unmounts so a late response never writes back to a dead instance.
  // Keyed on proxy PRESENCE (not identity): a proxyConfig that arrives after
  // the first render still auto-loads + registers cleanup, and an inline-object
  // proxyConfig doesn't destroy/recreate the controller on every render. If a
  // previous cleanup tore the controller down (removal / StrictMode remount),
  // recreate it here and force a re-render so useSyncExternalStore subscribes
  // to the fresh instance.
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0)
  const hasProxy = proxyConfig !== undefined
  // Batch AG (persistState): the restored pageSize hooks in HERE — BEFORE the
  // first request. The mount restore effect runs after this effect, so without
  // this the first query would fire with the default pageSize (double fetch).
  // `persistParsedRef` is mirrored from the usePersistState call below during
  // the same render pass (see the persist block); the one-shot flag is reset
  // on cleanup so a StrictMode remount / proxy re-add restores again.
  const persistParsedRef = React.useRef<IrisTablePersistedState | null>(null)
  const persistPageSizeAppliedRef = React.useRef(false)
  React.useEffect(() => {
    let ctrl = proxyRef.current
    if (!ctrl && hasProxy) {
      ctrl = createProxySource()
      proxyRef.current = ctrl
      forceRender()
    }
    if (ctrl) {
      // persistState pageSize (batch AG): apply the restored size + notify
      // BEFORE the default first query. request(partial) applies the params
      // and fires exactly ONE query — setParams alone would re-request on
      // its own, double-fetching with the request below. Skipped without
      // proxyConfig.onPageChange (documented: pageSize is only meaningful
      // with it) and when nothing was persisted.
      if (!persistPageSizeAppliedRef.current) {
        persistPageSizeAppliedRef.current = true
        const size = persistParsedRef.current?.pageSize
        if (typeof size === 'number' && size > 0 && proxyConfig?.onPageChange) {
          proxyConfig.onPageChange(1, size)
          void ctrl.request({ pageSize: size, page: 1 })
        } else if (proxyConfig?.autoLoad !== false) {
          void ctrl.request()
        }
      } else if (proxyConfig?.autoLoad !== false) {
        void ctrl.request()
      }
    }
    return () => {
      if (proxyRef.current === ctrl) proxyRef.current = null
      ctrl?.destroy()
      persistPageSizeAppliedRef.current = false
    }
  }, [hasProxy])

  // Batch AS (iris 独有): auto-refresh — proxy mode only, keyed on the SCALAR
  // intervalMs + proxy presence (an inline autoRefresh object must not reset
  // the timer on every render). Each tick runs the SAME refetch as the built-in
  // ↻ button: the standard refetch path flips `loading` true for the request
  // duration (the core source has no silent option — documented behavior, not
  // suppressed). intervalMs ≤ 0 is fail-closed (no timer). Cleanup on unmount
  // and on intervalMs change; the lifecycle cleanup above nulls proxyRef
  // before this cleanup runs, so a late tick can never hit a destroyed source.
  const intervalMs = autoRefresh?.intervalMs ?? 0
  React.useEffect(() => {
    // Number.isFinite first: NaN/Infinity fail the `<= 0` guard (`NaN <= 0`
    // is false), and setInterval(cb, NaN) ≈ 0 ms — a refetch storm.
    if (!hasProxy || !Number.isFinite(intervalMs) || intervalMs <= 0) return
    const id = window.setInterval(() => {
      void proxyRef.current?.refetch()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [hasProxy, intervalMs])

  // Editable write-back (vxe-grid parity): the table owns a live copy of the
  // data so committed edits survive WITHOUT the parent re-feeding `data`.
  // External `data` reference changes still win (controlled mode); in proxy
  // mode the source of truth is the proxy's loaded page — liveData holds
  // local edit write-backs until the next refetch replaces them.
  // keepSource (batch R, vxe-grid keepSource parity): seed liveData with a
  // COPY of `data` so mutating the original array after mount cannot change
  // the table. The table is immutable either way — it never mutates the rows
  // it receives; keepSource just decouples the initial seed from the prop
  // reference. Later controlled re-feeds (new `data` reference) keep the
  // hand-off below unchanged.
  const [liveData, setLiveData] = React.useState<Row[]>(
    keepSource ? [...(data ?? [])] : (data ?? []),
  )
  const externalDataRef = React.useRef(data)
  // Latest live row list (batch K): row-edit sessions resolve the CURRENT row
  // object by key at commit time, so editing several columns of one row never
  // writes a stale row back (column A's commit updates the row, column B's
  // commit must see it).
  const liveDataRef = React.useRef<Row[]>(liveData)
  liveDataRef.current = liveData
  // ── Built-in undo/redo (iris 独有, batch AL) ──────────────────────────
  // A core createUndoStack stores full row-list snapshots. The stack holds
  // POST-change states (the core convention — undo() returns the state
  // before the last mutation, redo() the state after it), so recordUndo
  // receives the row list that WILL become current: commitRowList passes its
  // `next`, commitValue passes the setCellValue-computed list (cell/row
  // edits write back through setLiveData directly and never reach
  // commitRowList — the second funnel). undo/redo replay through a dedicated
  // path that flips restoringRef so the replay's commitRowList never
  // re-pushes (no undo-of-undo). vxe undoRedoHistory parity: external data
  // re-feeds re-baseline the stack ONLY while it is untouched (no user
  // mutation yet); once the user has mutated, history stays
  // interaction-scoped.
  const undoRef = React.useRef(undo)
  undoRef.current = undo
  const restoringRef = React.useRef(false)
  const undoStackRef = React.useRef<UndoStack<Row[]> | null>(null)
  if (undoStackRef.current === null) {
    undoStackRef.current = createUndoStack<Row[]>({
      maxHistory: 100,
      initial: [...(data ?? [])],
      equals: sameRowList,
    })
  }
  const undoStack = undoStackRef.current
  // The stack is a plain controller (no observable store) — every
  // push/undo/redo bumps this tick so the toolbar buttons re-render and
  // re-read canUndo/canRedo. Every mutation also re-renders via setLiveData,
  // so the tick is belt-and-braces for no-op pushes / undos at the tip.
  const [, setUndoTick] = React.useState(0)
  const bumpUndoTick = React.useCallback(() => setUndoTick((n) => n + 1), [])
  const recordUndo = React.useCallback(
    (next: Row[]): void => {
      if (!undoRef.current || restoringRef.current) return
      undoStack.push([...(next ?? [])])
      bumpUndoTick()
    },
    [undoStack, bumpUndoTick],
  )
  // Reference of the LAST data the parent actually fed us (updated only by
  // this effect). Internal write-backs (edit commit / row ops) update
  // `externalDataRef` but NOT this, so the effect can distinguish "parent fed
  // new data" from "we mutated our own live copy" and never clobber edits.
  const lastExternalRef = React.useRef(data)
  React.useEffect(() => {
    const next = proxy ? proxyState.data : data
    if (next !== lastExternalRef.current) {
      lastExternalRef.current = next
      externalDataRef.current = next
      setLiveData(next ?? [])
      // Batch AL: an external re-feed re-baselines the undo stack only while
      // it is untouched (no user mutation yet) — vxe undoRedoHistory parity.
      // Once the user has mutated, history stays interaction-scoped.
      if (undoRef.current && !undoStack.canUndo() && !undoStack.canRedo()) {
        undoStack.clear()
        undoStack.push([...(next ?? [])])
      }
      // Batch K (M2): a NEW data source reference means the parent re-fed the
      // data (or the proxy page changed) — cached lazy-tree children belong to
      // the previous rows. Drop the cache AND the in-flight loading set so
      // fresh `getSubRows` children render and lazy keys reload on the next
      // expand. Internal write-backs (edit commits / row ops) never reach this
      // effect (lastExternalRef only moves here), so they keep the cache.
      // The epoch bump invalidates any in-flight lazyLoad callback (review fix).
      lazyChildrenRef.current = new Map()
      setLazyLoading(new Set())
      lazyEpochRef.current += 1
    }
  }, [proxy, proxyState, data])

  // Batch AS (iris 独有): freshness stamp — every liveData change (initial
  // arrival via the sync effect above, refetch, edit commits, row ops / paste
  // / batch / range clear via commitRowList, undo/redo via applyUndoSnapshot)
  // re-stamps Date.now(); the toolbar renders it through formatClock. The
  // effect ALSO runs on mount, so the very first data arrival stamps too (in
  // proxy mode liveData is empty at mount → the stamp stays hidden until rows
  // exist).
  const [freshnessAt, setFreshnessAt] = React.useState(0)
  React.useEffect(() => {
    if (!freshness) return
    setFreshnessAt(Date.now())
  }, [freshness, liveData])

  // ── Built-in audit log (iris 独有, batch AT) ───────────────────────────
  // A core createAuditLog keeps a bounded (200) ring of ONE entry per
  // mutation commit. Both write-back funnels record: commitRowList (row ops,
  // paste, fill, range clear, fnr, batch edit, undo/redo replay) diffs the
  // PREVIOUS row list (auditRowsRef) against `next` via the module-scope
  // auditDiff helper and pushes the first changed row/cell; commitValue
  // (inline cell/row edits that bypass commitRowList) pushes the same diff
  // over its computed nextList. undo/redo replay records type 'undo'/'redo'
  // — the replay IS a user-visible change and belongs in the trail. The
  // controller is created once (ref-once, mirroring undoStackRef) and stays
  // inert unless the `auditLog` prop is on (auditEnabledRef gate).
  const auditEnabledRef = React.useRef(auditLog)
  auditEnabledRef.current = auditLog
  const auditRef = React.useRef<AuditLog | null>(null)
  if (auditRef.current === null) {
    auditRef.current = createAuditLog()
  }
  const audit = auditRef.current
  // Previous rows for the light diff. Kept in sync by EVERY write-back
  // funnel (recordAudit assigns eagerly — React defers the setLiveData
  // updaters) AND by the live-data effect below (external re-feeds
  // re-baseline so the next commit diff doesn't read stale rows).
  const auditRowsRef = React.useRef<Row[]>(liveData)
  // Ref mirror for commitValue (defined above the recordAudit helper):
  // assigned every render from the helper's definition site.
  const recordAuditRef = React.useRef<((next: Row[], type: AuditLogType) => void) | null>(null)
  // External re-feeds (parent `data` / proxy refetch / undo baseline restore)
  // move liveData WITHOUT a commit — re-baseline the diff snapshot so the
  // NEXT user commit doesn't diff against stale rows (the fresh rows become
  // the new "before"). Commit-driven liveData changes agree with the eager
  // ref sync inside recordAudit (both hold the committed list).
  React.useEffect(() => {
    auditRowsRef.current = liveData
  }, [liveData])

  // ── Built-in performance panel (iris 独有, batch BL) ───────────────────
  // A core createPerfStats keeps the LATEST render-commit sample (the audit
  // controller's mold — createPerfStats/auditRef 1:1). Created once
  // (ref-once) and stays inert unless the `perfStats` prop is on
  // (perfEnabledRef gate — off = zero cost, no push ever). The sampling
  // itself lives in a dependency-less useLayoutEffect below (after
  // bodyData/leafColumns resolve) — see the render-top mark there.
  const perfEnabledRef = React.useRef(perfStats)
  perfEnabledRef.current = perfStats
  const perfRef = React.useRef<PerfStats | null>(null)
  if (perfRef.current === null) {
    perfRef.current = createPerfStats()
  }
  const perf = perfRef.current

  // ── Built-in version history (iris 独有, batch BA) ────────────────────
  // A core createVersionHistory keeps a bounded (default 20) ring of the
  // PRE-change row list per row-list commit — the same funnel and type hint
  // as the batch-AT audit (commitRowList only; commitValue inline edits do
  // NOT create versions — restore replaces the whole row list, so row-level
  // commits are the coherent unit, documented). The controller is created
  // once (ref-once, max from the first render — mirrors auditRef) and stays
  // inert unless the `versionHistory` prop is on (historyEnabledRef gate).
  // restoreVersion flips historySuppressRef around its own replay (a
  // commitRowList with type 'undo'): the replay never pushes a new version,
  // but it IS audited and undoable — consistent with undo/redo replay.
  const historyEnabledRef = React.useRef(versionHistory)
  historyEnabledRef.current = versionHistory
  const historyRef = React.useRef<VersionHistory<Row> | null>(null)
  if (historyRef.current === null) {
    historyRef.current = createVersionHistory<Row>({ max: versionHistory?.max })
  }
  const history = historyRef.current
  const historySuppressRef = React.useRef(false)

  // ── Built-in recent filters (iris 独有, batch CB) ────────────────────
  // A core createRecentFilters keeps a bounded (10) ring of ONE entry per
  // filter-panel confirm — the column key + the checked values,
  // newest-first with (key, values-SET) MRU de-dupe. The record point is
  // applyFilterValues (the confirm throat): non-empty sets only (empty =
  // clear semantics, mergeFilterValues precedent) and controlled-
  // irrelevant (records even without an onFilterValuesChange handler).
  // The controller is created once (ref-once, mirrors auditRef) and stays
  // inert unless the `recentFilters` prop is on (recentEnabledRef gate —
  // off = zero cost, no record ever). The filter panel snapshots
  // `list()` at open (key={filterPanelSeq} remount seeds it) — zero
  // useSyncExternalStore subscription.
  const recentEnabledRef = React.useRef(recentFilters)
  recentEnabledRef.current = recentFilters
  const recentRef = React.useRef<RecentFilters | null>(null)
  if (recentRef.current === null) {
    recentRef.current = createRecentFilters()
  }
  const recent = recentRef.current

  // ── Compare view (iris 独有, batch AU) ────────────────────────────────
  // A pure diff of the live rows against the `compareWith` snapshot by
  // rowKey (core diffRows — framework-free). Null when the feature is off
  // (no compareWith / no rowKey) so every render path stays inert. O(1)
  // maps keyed by rowKey: the row render reads `status.get(k)`, each cell
  // reads `cellChanges.get(k)?.get(dataIndex ?? key)`. Direction per the
  // batch-AU baseline: before = liveData, after = compareWith — so a live
  // row absent from the snapshot is `removed`, a row in both with differing
  // cells is `changed`, and the tooltip shows live → snapshot values.
  const compareDiff = React.useMemo<RowDiff | null>(
    () => (compareWith && rowKey ? diffRows(liveData, compareWith, rowKey) : null),
    [liveData, compareWith, rowKey],
  )

  // Sort state managed by useTableSort hook (controlled/uncontrolled, comparator, sorted data).
  const {
    sortState: sort,
    cycleSort,
    setSort,
    sortComparator,
    sortedData: localSortedData,
    multiSortState,
    cycleMultiSort,
    setMultiSort,
    multiSortComparator,
  } = useTableSort<Row>(liveData, {
    leafColumns,
    sort: sortProp,
    defaultSort,
    onSortChange: (next) => {
      onSortChange?.(next)
      // remoteSort parity: sort changes re-query the server (page resets to 1
      // in the core controller, vxe behavior).
      if (remoteSort) proxyRef.current?.setParams({ sort: next })
    },
    multiSort,
    multiSortState: multiSortStateProp,
    defaultMultiSort,
    onMultiSortChange: (next) => {
      onMultiSortChange?.(next)
      // remoteSort parity (multi mode): the FULL sort list re-queries the
      // server; the single `sort` param stays the single-column channel.
      if (remoteSort) proxyRef.current?.setParams({ sorts: next })
    },
    formulaTables,
  })
  // remoteSort parity: the server owns the ordering — never re-sort locally.
  const sortedData = remoteSort ? liveData : localSortedData

  // Batch AI: the parsed `sort by` clause seeds the ordering ONLY while no sort
  // prop is set (sort / defaultSort / multiSort / multiSortState / defaultMultiSort
  // all absent), the internal uncontrolled sort state is untouched (sort === null,
  // i.e. no header click yet) and the server does not own ordering (remoteSort). A
  // user sort interaction or a parent sort prop takes over (last-user-action-wins);
  // the effective `sort` state (controlled value or internal click) wins over the
  // clause whenever it is non-null. Local sorting only: the clause is never pushed
  // to the proxy (documented).
  const querySort = React.useMemo<IrisTableSortState | null>(() => {
    if (
      remoteSort ||
      sortProp !== undefined ||
      sort !== null ||
      defaultSort !== undefined ||
      multiSort ||
      multiSortStateProp !== undefined ||
      defaultMultiSort !== undefined ||
      queryParsed.sort === null
    ) {
      return null
    }
    return queryParsed.sort
  }, [
    remoteSort,
    sortProp,
    sort,
    defaultSort,
    multiSort,
    multiSortStateProp,
    defaultMultiSort,
    queryParsed,
  ])
  const querySortedData = React.useMemo(() => {
    if (!querySort) return sortedData
    const col = leafColumns.find((c) => c.key === querySort.key)
    if (!col) return sortedData
    const dir = querySort.direction === 'asc' ? 1 : -1
    const sortByKey = (col.sortBy ?? col.dataIndex ?? col.key) as keyof Row
    const cmp = (a: Row, b: Row): number => {
      if (col.sorter) return col.sorter(a, b) * dir
      if (col.formula) {
        // Batch AO: the parsed `sort by` clause sorts formula columns by the
        // COMPUTED value (same memoized evaluation as the cell render);
        // batch BC: cross-table refs read the render-scoped tables slot.
        let va = memoizedFormulaValue(col.formula, a, currentFormulaTables)
        let vb = memoizedFormulaValue(col.formula, b, currentFormulaTables)
        if (col.sortType === 'number') {
          va = Number(va)
          vb = Number(vb)
        } else if (col.sortType === 'string') {
          va = String(va ?? '')
          vb = String(vb ?? '')
        }
        return compareValues(va, vb) * dir
      }
      let va: unknown = a[sortByKey]
      let vb: unknown = b[sortByKey]
      if (col.sortType === 'number') {
        va = Number(va)
        vb = Number(vb)
      } else if (col.sortType === 'string') {
        va = String(va ?? '')
        vb = String(vb ?? '')
      }
      return compareValues(va, vb) * dir
    }
    return [...sortedData].sort(cmp)
  }, [querySort, sortedData, leafColumns])

  // remoteSort parity: hand the sort state to the server. Header clicks are
  // pushed via the onSortChange wrapper above; this effect covers controlled
  // `sort` prop updates from the parent (core setParams dedupes unchanged
  // params, so the click path does not double-request). In multiSort mode the
  // single-column channel is inert — the multi effect below owns the sync.
  React.useEffect(() => {
    if (!proxy || !remoteSort || multiSort) return
    proxyRef.current?.setParams({ sort: sort ?? null })
  }, [proxy, remoteSort, sort, multiSort])

  // remoteSort parity (multi mode): hand the full sort list to the server,
  // keyed on click order. The header-click path pushes via the
  // onMultiSortChange wrapper; this effect covers controlled `multiSortState`
  // prop updates from the parent (core setParams dedupes unchanged sorts, so
  // neither path double-requests).
  React.useEffect(() => {
    if (!proxy || !remoteSort || !multiSort) return
    proxyRef.current?.setParams({ sorts: multiSortState })
  }, [proxy, remoteSort, multiSort, multiSortState])

  // ── Search form (vxe-grid formConfig parity, batch D) ──────────────────
  // Draft/applied two-state: keystrokes only touch the DRAFT (never trigger a
  // query); submit/reset promote the built values into the APPLIED filters.
  // The draft is seeded from field defaultValue and re-seeded only when the
  // field set (or a default) actually changes, so an inline formConfig object
  // with a fresh identity each render never wipes user input.
  const [formDraft, setFormDraft] = React.useState<Record<string, string>>(() =>
    seedFormValues(formConfig?.fields),
  )
  const [formApplied, setFormApplied] = React.useState<Record<string, string>>({})
  const formFieldSignature = (formConfig?.fields ?? [])
    .map((f) => `${f.key}=${f.defaultValue ?? ''}`)
    .join('\u0000')
  React.useEffect(() => {
    setFormDraft(seedFormValues(formConfig?.fields))
    setFormApplied({})
    // Keyed on the field signature only — inline formConfig objects with a
    // fresh identity per render must not re-seed (nor wipe user input).
  }, [formFieldSignature])
  const setFormValue = (key: string, value: string): void => {
    setFormDraft((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }
  // Batch I: the proxy receives the text filters PLUS the comma-joined checked
  // filter sets, merged into ONE map (vxe filter-multiple remote serialization).
  // Batch AI: the parsed query's substring/in channels join the same map.
  const mergedProxyFilters = (form: Record<string, string>): Record<string, string> =>
    mergeQueryIntoFilters(
      mergeFilterValues(mergeFormFilters(filters ?? {}, form), filterValues ?? {}),
      queryParsed,
    )
  const handleFormSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const values = buildFormValues(formConfig?.fields, formDraft)
    formConfig?.onSearch?.(values)
    setFormApplied(values)
    // Proxy mode: the server owns filtering — merge the form values into the
    // controller filters (page resets to 1 in core applyParams, vxe behavior).
    if (proxy) {
      proxyRef.current?.setParams({ filters: mergedProxyFilters(values), page: 1 })
    }
  }
  const handleFormReset = (e: React.FormEvent): void => {
    e.preventDefault()
    const defaults = seedFormValues(formConfig?.fields)
    setFormDraft(defaults)
    const values = buildFormValues(formConfig?.fields, defaults)
    setFormApplied(values)
    formConfig?.onReset?.(values)
    if (proxy) {
      // setParams returns false when the merged params are unchanged (e.g.
      // filters already cleared) — a reset must still re-query, so force a
      // refetch only in that no-op case (no double request when it changed).
      if (
        proxyRef.current?.setParams({
          filters: mergedProxyFilters(values),
          page: 1,
        }) === false
      ) {
        proxyRef.current?.refetch()
      }
    }
  }

  // remoteFilter parity: hand the filter map to the server and never hide
  // rows client-side (vxe proxyConfig.filter). Form values are merged in so a
  // later `filters` prop change from the parent does not silently drop the
  // applied search (the draft would still show it). The effect lives after
  // the form state declarations (formApplied is referenced in the deps).
  React.useEffect(() => {
    if (!proxy || !remoteFilter) return
    proxyRef.current?.setParams({ filters: mergedProxyFilters(formApplied) })
  }, [proxy, remoteFilter, filters, filterValues, formApplied, queryParsed])

  // Row-selection logic (single/multiple toggle, dedup, select-all,
  // controlled/uncontrolled) is single-sourced in the core model; keys are the
  // string|number row keys. The sort / edit / resize / virtual logic below is
  // untouched. Mode is fixed at creation from `selectable` (as ToggleGroup
  // fixes its mode from `type`).
  const selControlled = selectionProp !== undefined
  const selModelRef = React.useRef<SelectionModel<string | number> | null>(null)
  if (selModelRef.current === null) {
    selModelRef.current = createSelectionModel<string | number>({
      mode: selectable === 'single' ? 'single' : 'multiple',
      defaultSelected: selControlled
        ? (selectionProp as Array<string | number>)
        : (defaultSelection ?? []),
      onChange: (next) => onSelectionChange?.(next),
    })
  }
  const selModel = selModelRef.current
  const selection = useStore(selModel.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  React.useEffect(() => {
    if (selControlled) selModel.sync(selectionProp as Array<string | number>)
  }, [selectionProp, selControlled, selModel])

  // Controlled tables RENDER from the prop (true controlled semantics): a local
  // toggle emits onSelectionChange, but the displayed selection only changes when
  // the parent writes `selection` back — so a parent that validates/rejects a
  // change no longer sees the row flip optimistically. Uncontrolled renders from
  // the model store as before.
  const displaySelection = selControlled ? (selectionProp as Array<string | number>) : selection
  // Handle methods run against the MOUNT-time closure (tableRef is assigned once), so
  // a selection snapshot would go stale — mirror the latest value for them instead.
  const displaySelectionRef = React.useRef(displaySelection)
  displaySelectionRef.current = displaySelection
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  const rebaseToProp = (): void => {
    if (selControlled) selModel.sync(selectionProp as Array<string | number>)
  }

  // Checkbox range-selection anchor (vxe checkboxConfig isShiftKey parity,
  // batch G): the row key of the last clicked row checkbox. Shift-click toggles
  // every checkMethod-eligible row between the anchor and the target (in
  // bodyData order); a plain click just moves the anchor. The header
  // select-all resets it.
  const checkboxAnchorRef = React.useRef<string | number | null>(null)

  // Expandable detail rows: a leading toggle column + a full-width detail panel,
  // driven by the framework-agnostic createExpansion (multiple-open).
  const hasDetail = renderDetail !== undefined
  // Batch BY: shared expandability probe for the persistState collector AND
  // restore gate — mirrors `treeMode` (derived later in the flatten-tree
  // region) so the snapshot logic can live before it. A flat table has no
  // expansion capability: nothing is saved and a seeded snapshot is inert.
  const expandableMode = hasDetail || getSubRows !== undefined || lazyLoad !== undefined
  const expansionRef = React.useRef<ExpansionModel | null>(null)
  if (expansionRef.current === null) {
    expansionRef.current = createExpansion({
      mode: 'multiple',
      defaultExpanded: (defaultExpandedRowKeys ?? []).map(String),
      onChange: (keys) => onExpandedRowsChange?.(keys),
    })
  }
  const expansion = expansionRef.current
  const expandedKeys = useStore(expansion.store)
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail && (rowExpandable ? rowExpandable(row, idx) : true)

  const widthsControlled = columnWidthsProp !== undefined
  const [widthsInternal, setWidthsInternal] = React.useState<IrisTableColumnWidths>(
    defaultColumnWidths ?? {},
  )
  const columnWidths = widthsControlled
    ? (columnWidthsProp as IrisTableColumnWidths)
    : widthsInternal
  const setColumnWidth = (key: string, width: number) => {
    const next = { ...columnWidths, [key]: width }
    if (!widthsControlled) setWidthsInternal(next)
    onColumnWidthsChange?.(next)
  }
  // Batch BO (iris 独有): toolbar reset button — the canonical 默认映射 is the
  // empty map (zero overrides → every render path falls back to the
  // column-DECLARED width through the existing `??` chain, so no new render
  // logic exists). Same dual channel as setColumnWidth: uncontrolled mode
  // clears the internal widths too, the callback fires unconditionally.
  const resetColumnWidths = () => {
    if (!widthsControlled) setWidthsInternal({})
    onColumnWidthsChange?.({})
  }

  // ── Column pin state (batch BX, iris 独有 — vxe has no header pin menu) ─
  // Dual channel mirroring columnWidths: `pinnedColumns` controlled → the map
  // is the ONLY read source (a `null` entry overrides a static `col.pinned`
  // declaration); absent → an internal map holds the pin state, seeded by the
  // static `col.pinned` declarations via `pinOf`'s fallback. `pinOf` is the
  // single throat every render path reads (pinnedOffsets, visibleColSet,
  // body attr, flat + grouped header attrs). `setColumnPinned` flips the
  // internal map in uncontrolled mode and fires `onColumnPinnedChange`
  // unconditionally in both channels (`onColumnWidthsChange` precedent) —
  // controlled mode never optimistically flips (the parent writes the map
  // back).
  const pinsControlled = pinnedColumns !== undefined
  const [pinsInternal, setPinsInternal] = React.useState<Record<string, 'left' | 'right' | null>>(
    {},
  )
  const pinOf = React.useCallback(
    (col: IrisTableColumn<Row>): 'left' | 'right' | null => {
      if (pinsControlled)
        // Absent keys fall back to the column's own declaration — only an
        // EXPLICIT `null` entry overrides a static `col.pinned` pin (so
        // `pinnedColumns={{}}` never unpins statically-declared pins).
        return col.key in pinnedColumns ? pinnedColumns[col.key] : (col.pinned ?? null)
      if (pinsInternal[col.key] !== undefined) return pinsInternal[col.key]
      return col.pinned ?? null
    },
    [pinsControlled, pinnedColumns, pinsInternal],
  )
  const setColumnPinned = (key: string, side: 'left' | 'right' | null): void => {
    if (!pinsControlled) setPinsInternal((prev) => ({ ...prev, [key]: side }))
    onColumnPinnedChange?.(key, side)
  }

  // ── persistState (batch AG, iris 独有 — vxe has no built-in persistence) ─
  // The table is CONTROLLED — every piece is parent-owned through its change
  // callback — so this hook is a pure LOADS/SAVES coordinator: restore
  // replays the stored values through the callbacks (only pieces whose
  // callback exists), saves serialize the CURRENT props on every change. The
  // snapshot only carries pieces the parent actually owns (callback present)
  // — what can be restored is what gets saved. `pageSize` is the documented
  // special case: no callback exists (proxy onPageChange is a notification),
  // so its restore is applied by the proxy-creation effect above BEFORE the
  // first query; without a proxy it is skipped entirely. Batch AH: the SAME
  // collector feeds the named-views hook (views save the current pieces under
  // a typed name) — one collector, two consumers.
  // Batch BZ: the `persistState || views` gate is gone — the collector is
  // UNCONDITIONAL so even a bare table can export via handle.exportStateJson()
  // (usePersistState's hasConfig gate / useTableViews' config gate double-
  // guard the no-config consumers; a bare table simply has no owning
  // callbacks, so every piece is gated out and the export is '{}').
  const persistSnapshot = React.useMemo<IrisTablePersistedState>(() => {
    const s: IrisTablePersistedState = {}
    if (onSortChange) s.sort = sort
    if (onMultiSortChange && multiSort) s.multiSortState = multiSortState
    if (onFiltersChange) s.filters = filters
    if (onFilterValuesChange) s.filterValues = filterValues
    if (onColumnVisibilityChange) s.columnVisibility = columnVisibility
    if (onColumnOrderChange) s.columnOrder = columnOrder
    if (onColumnWidthsChange) s.columnWidths = columnWidths
    if (proxy) s.pageSize = proxyState.params.pageSize
    // Batch BY: expanded keys (detail panels + tree carets) join the snapshot
    // only when restorable — an expandable table (renderDetail or tree mode)
    // WITH the callback (the restore gate below). pageSize's no-proxy skip
    // is the same precedent: what can't be restored is never saved.
    if (onExpandedRowsChange && expandableMode) s.expandedKeys = expandedKeys
    // Batch AJ: the query string joins the snapshot when set — persistState's
    // save loop iterates IrisTablePersistPiece and never sees it, so the
    // batch-AG path stays byte-identical; only the views (and batch BZ
    // export) consumers read it back. The query is a controlled prop,
    // captured like any other parent-owned piece and restored FIRST on apply
    // (see below). An empty `''` query is inactive (batch-AI convention) and
    // is NOT captured.
    if (query !== undefined && query !== '') s.query = query
    return s
  }, [
    persistState,
    views,
    sort,
    multiSort,
    multiSortState,
    filters,
    filterValues,
    columnVisibility,
    columnOrder,
    columnWidths,
    proxy,
    proxyState,
    onSortChange,
    onMultiSortChange,
    onFiltersChange,
    onFilterValuesChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onColumnWidthsChange,
    query,
    onExpandedRowsChange,
    expandableMode,
    expandedKeys,
  ])
  // Batch BZ (iris 独有): ref mirror of the LATEST collector snapshot — the
  // handle object is re-created every render but `tableRef` captures it ONCE
  // on mount, so handle methods must read the current snapshot through refs
  // (getFilteredData → filteredDataRef precedent). A bare table's snapshot is
  // an empty object → exportStateJson returns '{}'.
  const persistSnapshotRef = React.useRef<IrisTablePersistedState>({})
  persistSnapshotRef.current = persistSnapshot
  const restorePersistPiece = React.useCallback(
    (piece: IrisTablePersistPiece, value: unknown): boolean => {
      switch (piece) {
        case 'sort':
          if (!onSortChange) return false
          if (value !== null && (typeof value !== 'object' || Array.isArray(value))) return false
          onSortChange(value as IrisTableSortState | null)
          return true
        case 'multiSortState':
          if (!multiSort || !onMultiSortChange || !Array.isArray(value)) return false
          onMultiSortChange(value as IrisTableSortState[])
          return true
        case 'filters':
          if (!onFiltersChange || typeof value !== 'object' || value === null) return false
          onFiltersChange(value as Record<string, string>)
          return true
        case 'filterValues':
          if (!onFilterValuesChange || typeof value !== 'object' || value === null) return false
          onFilterValuesChange(value as IrisTableFilterValues)
          return true
        case 'columnVisibility':
          if (!onColumnVisibilityChange || typeof value !== 'object' || value === null) return false
          onColumnVisibilityChange(value as Record<string, boolean>)
          return true
        case 'columnOrder':
          if (!onColumnOrderChange || !Array.isArray(value)) return false
          onColumnOrderChange(value as string[])
          return true
        case 'columnWidths':
          if (!onColumnWidthsChange || typeof value !== 'object' || value === null) return false
          onColumnWidthsChange(value as IrisTableColumnWidths)
          return true
        case 'expandedKeys':
          // Batch BY: FULL-SET restore — a snapshot is the complete expanded
          // set, so merge (union-only) could never collapse; `set` replaces
          // wholesale. The model commit fires its onChange →
          // `onExpandedRowsChange(keys)` — the documented restore channel
          // (expansion has no controlled prop; the callback is the
          // parent-owned piece, pageSize's onPageChange precedent). Row keys
          // are stringified at the model boundary, so raw numeric keys
          // coerce here. A flat table makes the piece inert (collector never
          // saves it — a seeded snapshot must not replay either).
          if (!onExpandedRowsChange || !Array.isArray(value)) return false
          if (!expandableMode) return false
          expansion.set(value.map((k) => String(k)))
          return true
        case 'pageSize':
          // Applied by the proxy-creation effect before the first query;
          // eligible only when a proxy with onPageChange exists (documented).
          return proxyConfig?.onPageChange !== undefined && typeof value === 'number' && value > 0
        default:
          return false
      }
    },
    [
      multiSort,
      onSortChange,
      onMultiSortChange,
      onFiltersChange,
      onFilterValuesChange,
      onColumnVisibilityChange,
      onColumnOrderChange,
      onColumnWidthsChange,
      proxyConfig,
      expansion,
      expandableMode,
      onExpandedRowsChange,
    ],
  )
  // Batch AH (views): apply ONE stored snapshot mid-session through the same
  // per-piece callback gating + TYPE GUARDS as `restorePersistPiece` (a
  // tampered storage entry can't land raw values in the change callbacks).
  // The one deliberate divergence: `pageSize` — its mount-restore lives in
  // the proxy-creation effect (a notification, not a callback), so a view
  // apply must REPRODUCE that sequence (`onPageChange(1, size)` + exactly ONE
  // request) instead of just declaring eligibility.
  const applyViewSnapshot = React.useCallback(
    (snapshot: IrisTablePersistedState): void => {
      // Batch AJ: the query string restores FIRST (before any other piece) via
      // onQueryChange with a typeof-string guard — a tampered snapshot can't
      // land a non-string in the callback. Legacy views without `query` skip
      // this entirely and leave the current query untouched.
      if (snapshot.query !== undefined && typeof snapshot.query === 'string' && onQueryChange) {
        onQueryChange(snapshot.query)
      }
      if (snapshot.sort !== undefined) restorePersistPiece('sort', snapshot.sort)
      if (snapshot.multiSortState !== undefined)
        restorePersistPiece('multiSortState', snapshot.multiSortState)
      if (snapshot.filters !== undefined) restorePersistPiece('filters', snapshot.filters)
      if (snapshot.filterValues !== undefined)
        restorePersistPiece('filterValues', snapshot.filterValues)
      if (snapshot.columnVisibility !== undefined)
        restorePersistPiece('columnVisibility', snapshot.columnVisibility)
      if (snapshot.columnOrder !== undefined)
        restorePersistPiece('columnOrder', snapshot.columnOrder)
      if (snapshot.columnWidths !== undefined)
        restorePersistPiece('columnWidths', snapshot.columnWidths)
      // Batch BY: expanded keys restore through the same gate as mount
      // (onExpandedRowsChange + expandable) — the shared collector now
      // captures them, so a view apply must replay them symmetrically.
      if (snapshot.expandedKeys !== undefined)
        restorePersistPiece('expandedKeys', snapshot.expandedKeys)
      // `restorePersistPiece` only gates pageSize eligibility (the actual
      // restore lives in the proxy-creation effect); the reproduction stays
      // here so a view apply issues exactly one request.
      if (snapshot.pageSize !== undefined && restorePersistPiece('pageSize', snapshot.pageSize)) {
        const pageChange = proxyConfig?.onPageChange
        if (pageChange) {
          pageChange(1, snapshot.pageSize)
          void proxyRef.current?.request({ pageSize: snapshot.pageSize, page: 1 })
        }
      }
    },
    [restorePersistPiece, proxyConfig, onQueryChange],
  )
  // Batch BZ (iris 独有): ref mirror of the latest apply callback for the
  // handle's importStateJson (same mount-closure rationale as
  // persistSnapshotRef above).
  const applyViewSnapshotRef = React.useRef<typeof applyViewSnapshot>(applyViewSnapshot)
  applyViewSnapshotRef.current = applyViewSnapshot
  // Parse runs during the first render (guarded, idempotent); mirror the
  // parsed snapshot into the ref the proxy-creation effect reads above.
  const persistParsed = usePersistState({
    config: persistState,
    state: persistSnapshot,
    restorePiece: restorePersistPiece,
  })
  persistParsedRef.current = persistParsed.parsed

  // ── Named view presets (batch AH, iris 独有 — vxe has no equivalent) ────
  // The toolbar select + inline save input (TableViews) render the hook's
  // state; snapshots come from the SAME collector as persistState (the memo
  // above) and apply through the same per-piece callbacks.
  const tableViews = useTableViews({
    config: views,
    snapshot: persistSnapshot,
    applySnapshot: applyViewSnapshot,
    activeKey: views?.activeKey,
    onActiveViewChange,
  })

  // Inline editing: one cell at a time, keyed by `${rowKey}::${colKey}`. The
  // whole draft/validate/coerce session lives in the framework-agnostic
  // createCellEdit controller (core); the adapter only bridges the editor
  // element and resolves the row/column context for the session callbacks.
  // Both the text/number <input> and the select editor focus through this ref
  // (callback refs because a single union-typed ref can't bind to both tags).
  const editorRef = React.useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(
    null,
  )
  const setEditorRef = (
    el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null,
  ): void => {
    editorRef.current = el
  }
  const onCellEditRef = React.useRef(onCellEdit)
  onCellEditRef.current = onCellEdit
  // Batch V: latest-closure refs for the new event props (mount-time handle
  // methods and EditorSurface callbacks must never see a stale closure).
  const onEditStartRef = React.useRef(onEditStart)
  onEditStartRef.current = onEditStart
  const onEditClosedRef = React.useRef(onEditClosed)
  onEditClosedRef.current = onEditClosed
  // Batch BQ (iris 独有): editAutosave — commitValue is captured by the
  // cellEdit useMemo([]) closure, so the feature switch + callback must be
  // read through refs (auditEnabledRef same shape).
  const editAutosaveRef = React.useRef(editAutosave)
  editAutosaveRef.current = editAutosave
  const onAutosaveRef = React.useRef(onAutosave)
  onAutosaveRef.current = onAutosave
  const onSelectAllChangeRef = React.useRef(onSelectAllChange)
  onSelectAllChangeRef.current = onSelectAllChange
  const onScrollRef = React.useRef(onScroll)
  onScrollRef.current = onScroll
  const editCtxRef = React.useRef<{ row: Row; col: IrisTableColumn<Row>; rowIndex: number } | null>(
    null,
  )
  // Batch Q (vxe editDirtyConfig parity): committed cells whose value differs
  // from their pre-edit original are tracked here, keyed
  // `${rowKeyVal}::${colKey}` (same `::` delimiter as `cellId`). `original`
  // is captured at the FIRST commit of a cell (the onCommit oldValue);
  // `current` mirrors the latest committed value so a later commit only
  // needs to compare against `original` to decide clean/dirty. Ref (not
  // state): every commit already re-renders via the live-data write-back,
  // so the render reads this map directly.
  const dirtyCellsRef = React.useRef<Map<string, { original: unknown; current: unknown }>>(
    new Map(),
  )
  // Dirty write-back for cell AND row edit modes (batch Q): first commit of a
  // cell records its original and marks it dirty; a later commit that equals
  // the original removes it (clean); any other commit keeps it dirty and
  // refreshes the tracked current value.
  const trackDirty = (
    k: string | number,
    colKey: string,
    oldValue: unknown,
    value: unknown,
  ): void => {
    if (!editDirtyConfig) return
    const key = dirtyKey(k, colKey)
    const tracked = dirtyCellsRef.current.get(key)
    if (!tracked) dirtyCellsRef.current.set(key, { original: oldValue, current: value })
    else if (value === tracked.original) dirtyCellsRef.current.delete(key)
    else tracked.current = value
  }
  // Batch Q: dirty entries for a removed row are pruned so a later re-added
  // row with the same key (insertRow / proxy refetch / paging back to a page
  // with the same ids) starts clean instead of rendering phantom dirty dots.
  const pruneDirtyFor = (rowIdent: string | number): void => {
    const prefix = `${rowIdent}::`
    for (const key of [...dirtyCellsRef.current.keys()]) {
      if (key.startsWith(prefix)) dirtyCellsRef.current.delete(key)
    }
  }
  // Batch K (M1): Tab-navigation intent stashed while an async validation
  // commit is in flight (commitEdit returns false for a pending Promise). The
  // settle-observer effect performs the navigation when the commit lands, and
  // drops it when validation fails or the session is cancelled instead.
  const pendingNavRef = React.useRef<{
    dir: 1 | -1
    row: Row
    col: IrisTableColumn<Row>
    k: string | number
    idx: number
  } | null>(null)
  const cellId = (rowIdent: string | number, colKey: string): string => `${rowIdent}::${colKey}`
  const coerceValueFor = (row: Row, col: IrisTableColumn<Row>, draft: unknown): unknown => {
    // Select editors commit the option's TYPED value (vxe edit-render parity):
    // a number option commits a number, a string option a string. Drafts that
    // already carry the typed form (select onChange stores it) pass through;
    // string drafts (e.g. the initial seed) resolve against editOptions by
    // String(value) so validation and commit see the typed value.
    if (col.editor === 'select') {
      if (!col.editOptions) return String(draft)
      if (typeof draft !== 'string') return draft
      const opt = col.editOptions.find((o) => String(o.value) === draft)
      return opt ? opt.value : draft
    }
    const s = String(draft)
    if (col.editor !== 'number') return s
    return s === '' || Number.isNaN(Number(s)) ? getCellValue(row, col) : Number(s)
  }
  const coerceValue = (col: IrisTableColumn<Row>, draft: unknown): unknown =>
    coerceValueFor(editCtxRef.current!.row, col, draft)
  /** Current row object for a row key (row edit mode resolves at commit time). */
  const currentRowFor = (rowIdent: string | number): Row | undefined =>
    liveDataRef.current.find((r, i) => rowKeyOf(r, i) === rowIdent)
  /** Batch BQ (iris 独有): the post-commit row list payload for onAutosave.
   *  The eager block already syncs externalDataRef to the next list for
   *  rowKey rows; rowId rows cannot be found by that field lookup, so this
   *  mirrors the setLiveData updater's fallback (locate by computed key,
   *  clone, set). Unreachable without a resolvable key → current list. */
  const autosaveRows = (
    ctx: { col: IrisTableColumn<Row> },
    k: string | number,
    value: unknown,
  ): Row[] => {
    const current = externalDataRef.current ?? []
    const next = setCellValue(current, rowKey, k, ctx.col.key, value)
    if (next !== current) return next
    if (!rowId) return current
    const at = current.findIndex((r, i) => rowKeyOf(r, i) === k)
    if (at < 0) return current
    const viaId = current.slice()
    viaId[at] = { ...viaId[at]!, [ctx.col.key]: value }
    return viaId
  }
  /** Shared commit write-back for cell AND row edit sessions (batch K): the
   *  live data update + onCellEdit fire, skipping no-op commits. `ctx.row` is
   *  the CURRENT row object (row sessions resolve it by key). */
  const commitValue = (
    ctx: { row: Row; col: IrisTableColumn<Row>; rowIndex: number },
    value: unknown,
  ): void => {
    const oldValue = getCellValue(ctx.row, ctx.col)
    if (value === oldValue) return
    // Batch AL: cell/row edit commits bypass commitRowList (they write back
    // through setLiveData directly), so the POST-change snapshot is recorded
    // here too — otherwise undo would silently miss every inline edit. The
    // eager ref sync keeps a following commitValue in the SAME event
    // (row-mode switchRowEdit commits several columns) snapshotting the true
    // intermediate list — React defers the setLiveData updaters, so without
    // it every snapshot in one event would capture the same stale list.
    const k = rowKeyOf(ctx.row, ctx.rowIndex)
    if (k != null) {
      const current = externalDataRef.current ?? []
      const nextList = setCellValue(current, rowKey, k, ctx.col.key, value)
      recordUndo(nextList)
      // Batch AT: record ONE audit entry per inline edit commit (type
      // 'edit') — the SAME light diff the commitRowList funnel uses, so the
      // trail stays consistent across both write-back paths.
      recordAuditRef.current?.(nextList, 'edit')
      if (nextList !== current) externalDataRef.current = nextList
    }
    // Batch Q: dirty write-back for editDirtyConfig (cell AND row edit modes
    // both funnel through here).
    if (k != null) trackDirty(k, ctx.col.key, oldValue, value)
    // Write the committed value back into the live data so the edit survives
    // without the parent re-feeding `data` (controlled mode overrides via the
    // data-reference sync above).
    if (k != null) {
      setLiveData((prev) => {
        const next = setCellValue(prev, rowKey, k, ctx.col.key, value)
        if (next !== prev) {
          externalDataRef.current = next
          return next
        }
        // rowId rows (batch R): the key lives outside the `rowKey` field, so
        // the field lookup above cannot find the row — locate it by the
        // computed key instead. Without `rowId` this path is unreachable
        // (field rows always resolve above), keeping behavior byte-identical.
        if (!rowId) return prev
        const at = prev.findIndex((r, i) => rowKeyOf(r, i) === k)
        if (at < 0) return prev
        const viaId = prev.slice()
        viaId[at] = { ...viaId[at]!, [ctx.col.key]: value }
        externalDataRef.current = viaId
        return viaId
      })
    }
    onCellEditRef.current?.({
      row: ctx.row,
      column: ctx.col,
      oldValue,
      newValue: value,
      rowIndex: ctx.rowIndex,
    })
    // Batch BQ (iris 独有): editAutosave — after a successful commit, notify
    // the parent persistence hook with the post-commit row list. editAutosave
    // is the feature switch (onAutosave alone is inert); the value ===
    // oldValue early-return above already filtered no-ops. Row-list write-
    // backs (paste/fill/FNR/batch ops) never funnel through here.
    if (editAutosaveRef.current) onAutosaveRef.current?.(autosaveRows(ctx, k, value))
  }
  // Batch BR (iris 独有): validationSummary — editRules commit-outcome
  // ledger. ok = a commit that passed editRules validation and landed
  // (counted in the onCommit wrapper, cell and row modes); fail = a commit
  // attempt rejected by editRules (counted in the validate wrapper's Promise
  // `.then`). The cellEdit/createRowSession memos run with [] deps, so the
  // feature switch is read through a ref mirror (editAutosaveRef precedent);
  // the commit-intent marker distinguishes a REAL commit attempt (set by the
  // commit wrappers, consumed synchronously by the validate wrapper) from
  // setDraft typing validation and startEdit seeds — neither ever counts.
  // Re-enabling the switch resets the ledger (fresh start per session).
  const [validationCounts, setValidationCounts] = React.useState({ ok: 0, fail: 0 })
  const validationSummaryRef = React.useRef(validationSummary)
  validationSummaryRef.current = validationSummary
  const validationIntentRef = React.useRef(false)
  React.useEffect(() => {
    if (validationSummary) setValidationCounts({ ok: 0, fail: 0 })
  }, [validationSummary])
  /** Batch BR: mark a commit attempt so the editRules validate wrapper counts
   *  the outcome — the marker is consumed synchronously inside commitEdit(),
   *  and cleared again when nothing was actually committed so a stray intent
   *  can never leak into the next validation (idle commitEdit is a no-op). */
  const commitWithSummaryIntent = React.useCallback((s: CellEdit): boolean => {
    validationIntentRef.current = true
    const ok = s.commitEdit()
    if (!ok) validationIntentRef.current = false
    return ok
  }, [])
  /** Batch BR: bump one side of the ledger (gated on the feature switch so a
   *  turned-off table never accumulates invisible counts). Stable — the memo
   *  closures capture it once and read the switch through the ref mirror. */
  const bumpValidationCount = React.useCallback((kind: 'ok' | 'fail') => {
    if (!validationSummaryRef.current) return
    setValidationCounts((prev) => ({ ...prev, [kind]: prev[kind] + 1 }))
  }, [])
  const cellEdit = React.useMemo(
    () =>
      createCellEdit({
        validate: (draft, _target) => {
          const ctx = editCtxRef.current
          if (!ctx) return null
          // Batch BR: consume the commit-intent marker — set by the commit
          // wrappers immediately before a real commit attempt. setDraft
          // typing validation and startEdit seeds carry no intent and never
          // count; the marker is cleared synchronously on the very next
          // validate invocation, so it cannot leak across calls.
          const commitIntent = validationIntentRef.current
          validationIntentRef.current = false
          // Declarative editRules run async (they may contain async validators);
          // the legacy validate callback stays synchronous for the sync commit
          // path.
          if (hasEditRules(ctx.col)) {
            return validateEditRulesAsync(ctx.col.editRules, draft, ctx.row, false, {
              rows: externalDataRef.current ?? [],
              columnKey: ctx.col.key,
            }).then((r) => {
              if (commitIntent && !r.valid) bumpValidationCount('fail')
              return r.valid ? null : (r.messages[0] ?? null)
            })
          }
          if (ctx.col.validate) {
            return ctx.col.validate(coerceValue(ctx.col, draft), ctx.row) ?? null
          }
          return null
        },
        coerce: (draft, _target) => {
          const ctx = editCtxRef.current
          return ctx ? coerceValue(ctx.col, draft) : draft
        },
        onCommit: (_target, value) => {
          const ctx = editCtxRef.current
          if (!ctx) return
          // Batch BR: a commit that PASSED editRules validation and landed.
          if (hasEditRules(ctx.col)) bumpValidationCount('ok')
          commitValue(ctx, value)
        },
      }),
    [],
  )
  const editTarget = useStore(cellEdit.store)
  const editingTarget = editTarget.editing
  // Row edit mode (vxe editConfig.mode parity, batch K): `'row'` opens one
  // session per editable column of the clicked row (see beginRowEdit); the
  // default `'cell'` keeps the singleton one-cell-at-a-time behavior.
  const rowMode = editConfig?.mode === 'row'

  // ── Row edit mode (vxe editConfig.mode='row' parity, batch K) ────────────
  // One CellEdit session per editable column of the clicked row, each with its
  // own draft/validate/commit through the existing core machinery. Sessions
  // live in a state Map keyed by cellId (so the cell render reacts); the
  // EditorSurface per open column subscribes to its session store and reports
  // back when the session goes idle (committed) so just THAT column's editor
  // closes — row mode commits per cell, never the whole row at once.
  const [rowSessions, setRowSessions] = React.useState<Map<string, CellEdit>>(new Map())
  const [rowEditing, setRowEditing] = React.useState<{ k: string | number; idx: number } | null>(
    null,
  )
  // Focus token for row editors: beginRowEdit / Tab / reopen bump the seq of
  // the target column; the EditorSurface focuses when its token is current.
  const [rowFocus, setRowFocus] = React.useState<{ colKey: string; seq: number }>({
    colKey: '',
    seq: 0,
  })
  const rowEditorRefs = React.useRef<
    Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  >(new Map())
  const rowSessionsRef = React.useRef(rowSessions)
  rowSessionsRef.current = rowSessions
  const focusRowEditor = React.useCallback((colKey: string) => {
    setRowFocus((prev) => ({ colKey, seq: prev.seq + 1 }))
  }, [])
  // Stable per-column ref registrar (a changing callback ref would detach/
  // reattach the DOM node and drop focus on every table re-render).
  const registerRowEditorRef = React.useCallback((colKey: string) => {
    return (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null): void => {
      if (el) rowEditorRefs.current.set(colKey, el)
      else rowEditorRefs.current.delete(colKey)
    }
  }, [])
  const createRowSession = (
    rowIdent: string | number,
    col: IrisTableColumn<Row>,
    rowIndex: number,
  ): CellEdit =>
    createCellEdit({
      validate: (draft) => {
        const row = currentRowFor(rowIdent)
        if (!row) return null
        // Batch BR: same commit-intent consumption as the cell session — the
        // row sessions' commit sites (Enter/Tab/row-switch) set the marker.
        const commitIntent = validationIntentRef.current
        validationIntentRef.current = false
        if (hasEditRules(col)) {
          return validateEditRulesAsync(col.editRules, draft, row, false, {
            rows: externalDataRef.current ?? [],
            columnKey: col.key,
          }).then((r) => {
            if (commitIntent && !r.valid) bumpValidationCount('fail')
            return r.valid ? null : (r.messages[0] ?? null)
          })
        }
        if (col.validate) return col.validate(coerceValueFor(row, col, draft), row) ?? null
        return null
      },
      coerce: (draft) => {
        const row = currentRowFor(rowIdent)
        return row ? coerceValueFor(row, col, draft) : draft
      },
      onCommit: (_target, value) => {
        const row = currentRowFor(rowIdent)
        if (row) {
          // Batch BR: a row-session commit that PASSED editRules and landed.
          if (hasEditRules(col)) bumpValidationCount('ok')
          commitValue({ row, col, rowIndex }, value)
        }
      },
    })
  const beginRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const k = rowKeyOf(row, rowIndex)
    if (k == null) return
    const editableCols = leafColumns.filter(
      (c) => c.editable && !c.formula && !isCellLocked(row, c) && !isCellReadonly(row, c),
    )
    if (editableCols.length === 0) return
    pendingNavRef.current = null
    rowEditorRefs.current = new Map()
    const sessions = new Map<string, CellEdit>()
    for (const col of editableCols) {
      const id = cellId(k, col.key)
      const session = createRowSession(k, col, rowIndex)
      const current = getCellValue(row, col)
      session.startEdit(id, col.key, current == null ? '' : String(current))
      sessions.set(id, session)
    }
    setRowSessions(sessions)
    setRowEditing({ k, idx: rowIndex })
    // Focus the clicked column's editor when it exists, else the first
    // editable column (the editors mount on the next render).
    const focusKey =
      focusColKey && editableCols.some((c) => c.key === focusColKey)
        ? focusColKey
        : editableCols[0]!.key
    focusRowEditor(focusKey)
  }
  /** Escape: cancel EVERY open session of the row (the whole row, vxe parity). */
  const cancelRowEdit = (): void => {
    for (const s of rowSessionsRef.current.values()) s.cancelEdit()
    pendingNavRef.current = null
    setRowSessions(new Map())
    setRowEditing(null)
  }
  /** Clicking another row (or starting a new row): commit each open session;
   *  a SYNC validation failure keeps the row open with the error visible.
   *  Async-validating sessions commit in the background and land whenever
   *  they resolve (per-cell commit, vxe row mode parity). */
  const switchRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    if (rowEditing !== null) {
      for (const [, s] of rowSessionsRef.current) {
        commitWithSummaryIntent(s)
        if (s.getError() !== null) return
      }
    }
    beginRowEdit(row, rowIndex, focusColKey)
  }
  /** Tab between the row's editors: commit THAT column, focus the next
   *  editable one. Sync failure stays on the editor with the error; async
   *  commits stay pending and land in the background (the error, if any,
   *  appears on the source column). */
  const moveRowEditOnTab = (
    e: React.KeyboardEvent,
    dir: 1 | -1,
    col: IrisTableColumn<Row>,
    row: Row,
  ): void => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const editing = rowEditing
    const id = editing ? cellId(editing.k, col.key) : ''
    const session = rowSessionsRef.current.get(id)
    if (session) {
      commitWithSummaryIntent(session)
      if (session.getError() !== null) return
    }
    const start = leafColumns.indexOf(col)
    for (let i = start + dir; i >= 0 && i < leafColumns.length; i += dir) {
      const nextCol = leafColumns[i]!
      if (
        !nextCol.editable ||
        nextCol.formula ||
        isCellLocked(row, nextCol) ||
        isCellReadonly(row, nextCol)
      )
        continue
      focusRowEditor(nextCol.key)
      return
    }
  }
  /** A row session went idle (committed) — close just that column's editor.
   *  The last-session close is derived from STATE below (rowSessions becomes
   *  empty) rather than from the ref here, because batched commits (Enter in
   *  two editors in one event loop) fire both idle callbacks before the parent
   *  re-renders — the ref would still count 2 sessions and the row would never
   *  leave edit mode. */
  const onRowSessionIdle = (id: string): void => {
    setRowSessions((prev) => {
      if (!prev.has(id)) return prev
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }
  // All open sessions committed → the row leaves edit mode (click re-opens).
  React.useEffect(() => {
    if (rowEditing !== null && rowSessions.size === 0) setRowEditing(null)
  }, [rowSessions, rowEditing])

  // Batch K (M1): async-commit settle observer for Tab navigation. When the
  // Tab handler stashes pendingNavRef (the commit runs async validation), this
  // effect performs the navigation once the commit lands: editing cleared +
  // validated set → move to the next editable column; error set → validation
  // failed, stay in the cell with the error visible; editing cleared without a
  // validated value → the session was cancelled, drop the intent.
  React.useEffect(() => {
    const nav = pendingNavRef.current
    if (!nav) return
    if (editTarget.editing !== null) {
      if (editTarget.error !== null) pendingNavRef.current = null
      return
    }
    pendingNavRef.current = null
    if (editTarget.validated === undefined) return
    const start = leafColumns.indexOf(nav.col)
    for (let i = start + nav.dir; i >= 0 && i < leafColumns.length; i += nav.dir) {
      const nextCol = leafColumns[i]
      if (
        !nextCol.editable ||
        nextCol.formula ||
        isCellLocked(nav.row, nextCol) ||
        isCellReadonly(nav.row, nextCol)
      )
        continue
      beginEdit(nav.row, nextCol, nav.k, nav.idx)
      return
    }
  }, [editTarget])
  // ── Row drag-sort (composed over core createSortable) ──────────────────
  // One controller + container-level pointer handling; each row renders a
  // drag handle that seeds the press. Drop targets are collected on first
  // movement past the threshold (rects are captured once, then reused).
  const rowDragCtrl = React.useMemo(() => createSortable(), [])
  // ── Column drag-sort (composed over core createSortable) ────────────────
  const colDragCtrl = React.useMemo(() => createSortable(), [])
  const colDragState = useStore(colDragCtrl)
  const colRectsRef = React.useRef<SortableRect[]>([])
  const colDragActive = colDragState.activeId
  const colDragOver = colDragState.overId

  const handleColDragPointerDown = (e: React.PointerEvent, colKey: string) => {
    if (!columnDrag || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    colDragCtrl.press(colKey, e.clientX, e.clientY)
  }

  const handleColDragPointerMove = (e: React.PointerEvent) => {
    if (!columnDrag) return
    if (colDragCtrl.isPending()) {
      const started = colDragCtrl.tryStart(e.clientX, e.clientY)
      if (started) {
        const rects: SortableRect[] = []
        rootRef.current?.querySelectorAll('[data-iris-table-header]').forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          const id = (el as HTMLElement).getAttribute('data-iris-table-header')
          if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
        })
        colRectsRef.current = rects
      }
    }
    if (colDragCtrl.getState().activeId !== null) {
      colDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, colRectsRef.current)
    }
  }

  // Batch CH (iris 独有 — vxe has no drag-out pin): resolve a column-drag
  // release. Edge check FIRST — a release outside the root's LEFT edge pins
  // the dragged column left (gated on `columnPinMenu`; the drag is a second
  // gesture into the pin menu's state channel): already-left is a no-op, a
  // right→left drag flips the side, the drop NEVER reorders, and both
  // channels ride setColumnPinned (controlled mode never flips
  // optimistically — the callback fires, the parent writes the map back).
  // Otherwise the existing closestCenter reorder path runs byte-for-byte.
  // `_y` keeps the signature symmetric with the pointer events feeding it;
  // the window pointerup listener (release OUTSIDE the root) and the root
  // onPointerUp both resolve here — `end()`'s capture-and-clear dedupes.
  const resolveColDrag = (x: number, _y: number): void => {
    if (!columnDrag) return
    if (colDragCtrl.isPending()) {
      colDragCtrl.cancel()
      return
    }
    const { activeId, overId } = colDragCtrl.end()
    if (
      activeId !== null &&
      columnPinMenu &&
      rootRef.current !== null &&
      isColDragOutLeft(x, rootRef.current.getBoundingClientRect().left)
    ) {
      const active = leafColumns.find((c) => c.key === activeId)
      if (active && pinOf(active) !== 'left') setColumnPinned(activeId, 'left')
      colRectsRef.current = []
      return
    }
    if (activeId !== null && overId !== null && activeId !== overId) {
      const next = [...leafColumns]
      const from = next.findIndex((c) => c.key === activeId)
      const to = next.findIndex((c) => c.key === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        columnDrag.onReorder(next as IrisTableColumn<Row>[])
      }
    }
    colRectsRef.current = []
  }

  // Fresh-closure window bridge: the window listeners below resolve through
  // this ref so a prop/state change mid-drag never resolves against a stale
  // closure (same render-assigned-ref pattern as `viewColumnsRef`).
  const resolveColDragRef = React.useRef<(x: number, y: number) => void>(() => {})
  resolveColDragRef.current = resolveColDrag

  // Batch CH: window-level release for the drag-out pin — a pointerup (or
  // pointercancel) OUTSIDE the root must resolve the column drag (previously
  // a release outside the root left the controller stuck in activeId). The
  // effect lives ONLY while a drag is active in the gated config
  // (`columnDrag && columnPinMenu`); plain `columnDrag` keeps vxe parity
  // byte-identical with zero global hooks. The window pointermove keeps
  // overId fresh outside the root (the root handler only sees moves inside);
  // releases INSIDE the root bubble to the root handler first, so the window
  // handler's `end()` dedupe is free (capture-and-clear).
  React.useEffect(() => {
    if (!columnDrag || !columnPinMenu || colDragActive === null) return
    const onWindowMove = (e: PointerEvent): void => {
      if (colDragCtrl.getState().activeId !== null) {
        colDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, colRectsRef.current)
      }
    }
    const onWindowUp = (e: PointerEvent): void => {
      resolveColDragRef.current(e.clientX, e.clientY)
    }
    const onWindowCancel = (): void => {
      if (colDragCtrl.isPending() || colDragCtrl.getState().activeId !== null) {
        colDragCtrl.cancel()
      }
      colRectsRef.current = []
    }
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('pointercancel', onWindowCancel)
    return () => {
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      window.removeEventListener('pointercancel', onWindowCancel)
    }
  }, [columnDrag, columnPinMenu, colDragActive])
  const rowDragState = useStore(rowDragCtrl)
  const rowRectsRef = React.useRef<SortableRect[]>([])
  const spanOccupyRef = React.useRef<Set<string>>(new Set())
  // Footer occupy set (batch P): footerSpanMethod spans use their own ref so
  // body spanMethod keys never collide (the body and footer stacks are
  // independent coordinate spaces).
  const footerOccupyRef = React.useRef<Set<string>>(new Set())
  const [columnSettingsOpen, setColumnSettingsOpen] = React.useState(false)
  // Batch U (vxe toolbar zoom parity): local zoom state — the toolbar toggle
  // flips it, the injected stylesheet pins the root fixed, Esc exits. The
  // window listener lives only while zoomed (no global hook otherwise).
  const [zoomed, setZoomed] = React.useState(false)
  React.useEffect(() => {
    if (!zoomed) return
    const onWindowKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', onWindowKey)
    return () => window.removeEventListener('keydown', onWindowKey)
  }, [zoomed])
  // ── Batch AR mini chart preview (iris 独有) ─────────────────────
  // Toolbar trigger + anchor (the trigger button itself — a real DOM node);
  // the panel floats below it and remounts per open (state re-seeds).
  const [chartOpen, setChartOpen] = React.useState(false)
  const chartAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  // Batch AT: audit panel open state + toolbar trigger anchor (floating like
  // the chart panel).
  const [auditOpen, setAuditOpen] = React.useState(false)
  const auditAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  // Batch BA: version-history panel open state + toolbar trigger anchor.
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const historyAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  // Batch BL: perf panel open state + toolbar trigger anchor (floating like
  // the audit/chart panels).
  const [perfOpen, setPerfOpen] = React.useState(false)
  const perfAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  // Batch CJ: shortcut-hints panel open state + toolbar trigger anchor (the
  // `?` button after the perf trigger; floating like the chart/audit panels).
  const [hintsOpen, setHintsOpen] = React.useState(false)
  const hintsAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  const importFileRef = React.useRef<HTMLInputElement | null>(null)
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !toolbar?.onImport) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseCsv(text)
      if (parsed.length < 2) return
      const [header, ...body] = parsed
      const rows = body.map((cells: string[]) =>
        Object.fromEntries(header.map((h: string, i: number) => [h, cells[i] ?? ''])),
      )
      toolbar.onImport?.(rows)
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  const toggleColumnVisibility = (key: string) => {
    const next = { ...(columnVisibility ?? {}) }
    next[key] = !(columnVisibility?.[key] !== false)
    onColumnVisibilityChange?.(next)
  }
  // ── Custom column panel (vxe customConfig parity, batch S) ─────────────
  // The toolbar button opens the full panel in place of the old checkbox
  // menu: a search box (display-only), a drag-sort list over a local draft
  // order (cloned from the rowDrag createSortable composition — same
  // press/tryStart/moveOver/end flow), live visibility toggles, and footer
  // buttons. Confirm commits the draft through `onColumnOrderChange` and
  // closes; reset restores the visibility snapshot taken at FIRST open and
  // clears the order (`undefined` → parent drops `columnOrder`); Esc closes
  // without applying.
  const customDragCtrl = React.useMemo(() => createSortable(), [])
  const customDragState = useStore(customDragCtrl)
  const customRectsRef = React.useRef<SortableRect[]>([])
  const customDragActiveId = customDragState.activeId
  const customDragOverId = customDragState.overId
  const [customSearch, setCustomSearch] = React.useState('')
  const [draftOrder, setDraftOrder] = React.useState<string[]>([])
  const visibilitySnapshotRef = React.useRef<Record<string, boolean> | null>(null)

  // Panel rows: the draft order mapped back to columns, filtered by search.
  const customPanelColumns = React.useMemo(() => {
    const byKey = new Map(safeColumns.map((c) => [c.key, c]))
    const q = customSearch.trim().toLowerCase()
    const cols = draftOrder
      .map((key) => byKey.get(key))
      .filter((c): c is IrisTableColumn<Row> => c !== undefined)
    if (!q) return cols
    return cols.filter((c) => (c.title ?? c.key).toLowerCase().includes(q))
  }, [draftOrder, safeColumns, customSearch])

  const toggleColumnSettings = () => {
    if (columnSettingsOpen) {
      setColumnSettingsOpen(false)
      return
    }
    setColumnSettingsOpen(true)
    setCustomSearch('')
    setDraftOrder(orderedColumns.map((c) => c.key))
    // Re-snapshot visibility on EVERY open so reset always restores the
    // state as of the last open (parent-side visibility changes included,
    // per the batch-S baseline's `onColumnVisibilityChange({})` semantics
    // — see docs/vxe-grid/DECISIONS.md).
    visibilitySnapshotRef.current = { ...(columnVisibility ?? {}) }
  }

  const handleCustomDragPointerDown = (e: React.PointerEvent, colKey: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    customDragCtrl.press(colKey, e.clientX, e.clientY)
  }

  const handleCustomDragPointerMove = (e: React.PointerEvent) => {
    if (customDragCtrl.isPending()) {
      const started = customDragCtrl.tryStart(e.clientX, e.clientY)
      if (started) {
        const rects: SortableRect[] = []
        // The panel lives in the toolbar, OUTSIDE the rootRef div — collect
        // from the panel element itself (e.currentTarget is the panel).
        ;(e.currentTarget as HTMLElement)
          .querySelectorAll('[data-iris-table-column-settings-row]')
          .forEach((el) => {
            const r = (el as HTMLElement).getBoundingClientRect()
            const id = (el as HTMLElement).getAttribute('data-iris-table-column-settings-row')
            if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
          })
        customRectsRef.current = rects
      }
    }
    if (customDragCtrl.getState().activeId !== null) {
      customDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, customRectsRef.current)
    }
  }

  const handleCustomDragPointerUp = React.useCallback(() => {
    if (customDragCtrl.isPending()) {
      customDragCtrl.cancel()
      return
    }
    const { activeId, overId } = customDragCtrl.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      setDraftOrder((prev) => {
        const from = prev.indexOf(activeId)
        const to = prev.indexOf(overId)
        if (from < 0 || to < 0 || from === to) return prev
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      })
    }
    customRectsRef.current = []
  }, [])

  // Window-level release: the panel is only ~200px wide, so a pointerup or
  // pointercancel anywhere outside it (or outside the panel's pointer
  // handlers entirely) must never leave the custom drag stuck in activeId.
  React.useEffect(() => {
    if (!columnSettingsOpen) return
    window.addEventListener('pointerup', handleCustomDragPointerUp)
    const handleCustomDragCancel = () => {
      if (customDragCtrl.isPending() || customDragCtrl.getState().activeId !== null) {
        customDragCtrl.cancel()
      }
      customRectsRef.current = []
    }
    window.addEventListener('pointercancel', handleCustomDragCancel)
    return () => {
      window.removeEventListener('pointerup', handleCustomDragPointerUp)
      window.removeEventListener('pointercancel', handleCustomDragCancel)
    }
  }, [columnSettingsOpen, handleCustomDragPointerUp])

  const handleCustomConfirm = () => {
    setColumnSettingsOpen(false)
    onColumnOrderChange?.(draftOrder)
  }

  const handleCustomReset = () => {
    onColumnVisibilityChange?.({ ...(visibilitySnapshotRef.current ?? {}) })
    onColumnOrderChange?.(undefined)
    setDraftOrder(safeColumns.map((c) => c.key))
    setCustomSearch('')
  }
  const rowDragActiveId = rowDragState.activeId
  const rowDragOverId = rowDragState.overId
  // Batch CD row-drag insertion line (iris 独有): during an active drag a
  // 1px primary line renders between rows. `rowDropRef` records the EXACT
  // inputs that drew the line so pointerup re-resolves through the same
  // pure function — the row always lands where the line was drawn. Cleared
  // on up / leave / cancel (spec-required cleanup).
  const [rowDropTarget, setRowDropTarget] = React.useState<{
    rowId: string
    side: 'above' | 'below'
    top: number
  } | null>(null)
  const rowDropRef = React.useRef<{
    pointerY: number
    overId: string
    overRect: SortableRect
  } | null>(null)

  const handleRowDragPointerDown = (e: React.PointerEvent, rowId: string) => {
    if (!rowDrag || e.button !== 0) return
    e.preventDefault()
    rowDragCtrl.press(rowId, e.clientX, e.clientY)
  }

  const handleRowDragPointerMove = (e: React.PointerEvent) => {
    if (!rowDrag) return
    if (rowDragCtrl.isPending()) {
      const started = rowDragCtrl.tryStart(e.clientX, e.clientY)
      if (started) {
        const rects: SortableRect[] = []
        rootRef.current?.querySelectorAll('[data-iris-table-row]').forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          const id = (el as HTMLElement).getAttribute('data-iris-table-row')
          if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
        })
        rowRectsRef.current = rects
      }
    }
    const state = rowDragCtrl.getState()
    if (state.activeId !== null) {
      const overId = rowDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, rowRectsRef.current)
      updateRowDropIndicator(e.clientY, state.activeId, overId)
    }
  }

  // Batch CD: draw (or clear) the between-rows insertion line for the
  // current drop target. The line sits at the over row's top edge (above)
  // or bottom edge (below) — computed from the same captured rect the
  // pointer is over, translated into the root's coordinate space (the root
  // is forced position: relative while rowDrag is on). No target / the
  // active row itself / a non-row target (e.g. the header) → no line.
  const updateRowDropIndicator = (
    pointerY: number,
    activeId: string,
    overId: string | null,
  ): void => {
    if (overId === null || overId === activeId) {
      rowDropRef.current = null
      setRowDropTarget(null)
      return
    }
    const overRect = rowRectsRef.current.find((r) => r.id === overId)
    if (!overRect) {
      rowDropRef.current = null
      setRowDropTarget(null)
      return
    }
    const resolved = resolveRowDragDrop(
      pointerY,
      activeId,
      overId,
      overRect,
      bodyData,
      (row, index) => String(rowKeyOf(row, index)),
    )
    if (!resolved) {
      rowDropRef.current = null
      setRowDropTarget(null)
      return
    }
    const root = rootRef.current
    const rootTop = root ? root.getBoundingClientRect().top + (root.clientTop || 0) : 0
    const top = overRect.top - rootTop + (resolved.side === 'below' ? overRect.height : 0)
    rowDropRef.current = { pointerY, overId, overRect }
    setRowDropTarget((prev) =>
      prev && prev.rowId === overId && prev.side === resolved.side && prev.top === top
        ? prev
        : { rowId: overId, side: resolved.side, top },
    )
  }

  const handleRowDragPointerUp = () => {
    if (!rowDrag) return
    if (rowDragCtrl.isPending()) {
      rowDragCtrl.cancel()
      // Batch CD cleanup: an aborted tap still clears the line + refs.
      rowDropRef.current = null
      setRowDropTarget(null)
      return
    }
    const { activeId, overId } = rowDragCtrl.end()
    const recorded = rowDropRef.current
    rowDropRef.current = null
    setRowDropTarget(null)
    // Commit through the SAME resolve that drew the line (recorded pointerY
    // + overRect) so the row lands exactly where the line was drawn; a
    // net-zero move (from === insertIndex) skips onReorder.
    if (activeId !== null && overId !== null && recorded && recorded.overId === overId) {
      const rows = [...bodyData] as Row[]
      const from = rows.findIndex((r, i) => String(rowKeyOf(r, i)) === activeId)
      const resolved = resolveRowDragDrop(
        recorded.pointerY,
        activeId,
        overId,
        recorded.overRect,
        rows,
        (row, index) => String(rowKeyOf(row, index)),
      )
      if (resolved && from >= 0 && from !== resolved.insertIndex) {
        const [moved] = rows.splice(from, 1)
        rows.splice(resolved.insertIndex, 0, moved)
        rowDrag.onReorder(rows)
      }
    }
    rowRectsRef.current = []
  }

  const handleRowDragPointerLeave = () => {
    // Batch CD cleanup: leave aborts the drag AND clears the line + refs.
    if (rowDrag && rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.cancel()
    }
    rowDropRef.current = null
    setRowDropTarget(null)
  }

  // Row-selection drag range (batch BT, iris 独有 — vxe has no mouse-drag
  // checkbox range): pressing the `__selection` cell in multi mode records a
  // pending press; once the pointer moves past the 4px threshold (row-drag
  // aligned), the drag starts and every pointermove hit-tests the hovered
  // row via elementFromPoint → closest('[data-iris-table-row]') (range-fill
  // precedent — group-header/detail slots carry no such attr and summaries/
  // footers resolve to no body index → ignored). The applied interval
  // [anchor, hover] is committed as a MONOTONIC union (rows only ever get
  // added during one drag — reverse drags shrink the interval but never
  // uncheck), checkMethod-eligible rows only, through
  // `selModel.set([...display, ...add])` (selectAll additive precedent).
  // Pointer capture is DEFERRED to the drag start — never on a bare press:
  // capturing at pointerdown would retarget the pointerup→click onto the
  // press cell, so a plain click could never reach the checkbox label (its
  // input is pointerEvents:none) and rows would become un-toggleable with
  // selectionDrag on. Once the threshold is crossed, capture on the press
  // cell keeps pointermove/up and the trailing click on the table even when
  // released outside the root; jsdom lacks capture (try/catch `?.`).
  const selectionDragPendingRef = React.useRef<{ key: string; x: number; y: number } | null>(null)
  const selectionDragAnchorRef = React.useRef<string | null>(null)
  const selectionDragSeenRef = React.useRef<Set<string> | null>(null)
  const selectionDragPressCellRef = React.useRef<HTMLElement | null>(null)
  // Armed once the threshold is crossed; consumed by the trailing click that
  // pointer capture retargets onto the press cell (under capture the label
  // never receives that click, so no double-toggle can occur — preventDefault
  // + consume is belt-and-braces, and in jsdom, which has no capture
  // retargeting, it also blocks a trailing label→input activation). Cleared
  // on every press (before the guard) and on pointercancel, so an aborted
  // drag never swallows the next click.
  const selectionDragSuppressRef = React.useRef(false)

  const hitTestSelectionRowKey = (x: number, y: number): string | null => {
    if (typeof document === 'undefined' || !document.elementFromPoint) return null
    const el = document.elementFromPoint(x, y) as Element | null
    return el?.closest?.('[data-iris-table-row]')?.getAttribute('data-iris-table-row') ?? null
  }

  const handleSelectionDragPointerDown = (
    e: React.PointerEvent,
    rowKeyValue: string | number,
  ): void => {
    // A press on a selection cell clears a stale suppression arm FIRST (before
    // the guard): an aborted drag's pointercancel fires no trailing click to
    // consume it, so without this the flag could swallow the next click even
    // when this press is not a drag press (right button, selectable switched,
    // or the prop turned off mid-flight).
    selectionDragSuppressRef.current = false
    if (!selectionDrag || selectable !== 'multi' || e.button !== 0) return
    // No pointer capture on a bare press (see the refs comment above) — the
    // press cell is remembered so the drag-start branch can capture on it.
    selectionDragPressCellRef.current = e.currentTarget as HTMLElement
    selectionDragPendingRef.current = { key: String(rowKeyValue), x: e.clientX, y: e.clientY }
  }

  const applySelectionDragTo = (targetKey: string): void => {
    const anchor = selectionDragAnchorRef.current
    if (anchor === null) return
    const rows = bodyDataRef.current
    const anchorIdx = rows.findIndex((r, i) => String(rowKeyOf(r, i)) === anchor)
    const targetIdx = rows.findIndex((r, i) => String(rowKeyOf(r, i)) === targetKey)
    if (anchorIdx < 0 || targetIdx < 0) return
    const from = Math.min(anchorIdx, targetIdx)
    const to = Math.max(anchorIdx, targetIdx)
    const seen = selectionDragSeenRef.current ?? new Set<string>()
    const add: Array<string | number> = []
    for (let i = from; i <= to; i += 1) {
      const row = rows[i]!
      const key = rowKeyOf(row, i)
      const keyStr = String(key)
      if (checkMethod && !checkMethod(row, i)) continue
      if (seen.has(keyStr)) continue
      seen.add(keyStr)
      add.push(key)
    }
    if (add.length === 0) return
    rebaseToProp()
    selModel.set([...displaySelection, ...add])
  }

  const handleSelectionDragPointerMove = (e: React.PointerEvent): void => {
    if (!selectionDrag) return
    const pending = selectionDragPendingRef.current
    if (pending) {
      if (Math.abs(e.clientX - pending.x) < 4 && Math.abs(e.clientY - pending.y) < 4) return
      selectionDragPendingRef.current = null
      selectionDragAnchorRef.current = pending.key
      selectionDragSeenRef.current = new Set()
      selectionDragSuppressRef.current = true
      // Drag start: capture the pointer on the press cell NOW — deferred from
      // pointerdown so a bare press stays a normal click (see the refs
      // comment). Capture keeps pointermove/up and the trailing click on the
      // table even when released outside the root; jsdom has no real capture
      // (try/catch `?.`).
      try {
        selectionDragPressCellRef.current?.setPointerCapture?.(e.pointerId)
      } catch {
        /* jsdom has no real pointer capture */
      }
      // Drag start: apply the closed interval [anchor, hover] right away
      // (the anchor row is included; a press alone selects nothing).
      applySelectionDragTo(hitTestSelectionRowKey(e.clientX, e.clientY) ?? pending.key)
      return
    }
    if (selectionDragAnchorRef.current === null) return
    const hoverKey = hitTestSelectionRowKey(e.clientX, e.clientY)
    if (hoverKey === null) return
    applySelectionDragTo(hoverKey)
  }

  const handleSelectionDragPointerUp = (): void => {
    if (!selectionDrag) return
    selectionDragPendingRef.current = null
    selectionDragAnchorRef.current = null
    selectionDragSeenRef.current = null
    selectionDragPressCellRef.current = null
    // selectionDragSuppressRef stays armed until the trailing click (or the
    // next press) consumes it.
  }

  React.useEffect(() => {
    if (editingTarget !== null) editorRef.current?.focus()
  }, [editingTarget])

  // ── Right-click context menu (vxe contextMenu parity, batch H) ────────
  // Transient state: items + params are computed ONCE per open from the
  // callback; the cursor coordinates live in a virtual floating anchor (a fake
  // element whose getBoundingClientRect returns the zero-size cursor rect).
  // Cross-page note: the selection model is created once in a ref and the
  // proxy page change only calls setLiveData — nothing resets displaySelection,
  // so selections survive page flips (vxe reserve semantics is our default;
  // covered by the cross-page test in context-menu-select.test.tsx).
  const [contextMenuState, setContextMenuState] = React.useState<{
    open: boolean
    items: Array<{ key: string; label: string; disabled?: boolean }>
    params: IrisTableContextMenuParams<Row>
  } | null>(null)
  const contextAnchorRef = React.useRef<HTMLElement | null>(null)
  // Remount token: useFloating's autoUpdate does not re-run when `open` stays
  // true (a second right-click while the menu is open), so a fresh key forces
  // the menu to recompute at the new cursor coordinates.
  const [contextMenuSeq, setContextMenuSeq] = React.useState(0)
  const closeContextMenu = React.useCallback(() => {
    setContextMenuState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  // ── Column header pin menu (batch BX, iris 独有) ────────────────────────
  // Fully independent of `contextMenu` (which only opens on body cells): a
  // header right-click with `columnPinMenu` opens THIS menu at the cursor
  // (the same virtual-anchor pattern as the context menu), showing ONE
  // built-in item — 固定左 or 取消固定 per the column's CURRENT pin state
  // (single + mutually exclusive). The two menus are separate floating
  // instances: opening one closes the other (exactly one
  // `data-iris-table-context-menu` in the DOM at a time).
  const [pinMenuState, setPinMenuState] = React.useState<{
    open: boolean
    col: IrisTableColumn<Row>
  } | null>(null)
  const pinMenuAnchorRef = React.useRef<HTMLElement | null>(null)
  const [pinMenuSeq, setPinMenuSeq] = React.useState(0)
  const closePinMenu = React.useCallback(() => {
    setPinMenuState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  const handleHeaderContextMenu = (e: React.MouseEvent, col: IrisTableColumn<Row>): void => {
    if (!columnPinMenu) return
    // Right-click on a header is a menu gesture, never a sort/click — sort
    // only ever fires from the onClick path (left button); suppress the
    // browser's native context menu and contain the event.
    e.preventDefault()
    e.stopPropagation()
    // Swap menus: close the body context menu before this one opens.
    closeContextMenu()
    // Virtual anchor: zero-size rect at the cursor (context-menu pattern).
    pinMenuAnchorRef.current = {
      getBoundingClientRect: () => ({
        left: e.clientX,
        top: e.clientY,
        right: e.clientX,
        bottom: e.clientY,
        width: 0,
        height: 0,
        x: e.clientX,
        y: e.clientY,
        toJSON() {},
      }),
    } as unknown as HTMLElement
    setPinMenuState({ open: true, col })
    setPinMenuSeq((s) => s + 1)
  }
  // ── Value distribution panel (batch AM, iris 独有) ────────────────
  // Opens from the context menu's built-in `__iris_distribution` item; the
  // panel floats at the SAME virtual cursor anchor the menu used (snapshotted
  // into its own ref at open time, so a later right-click rebuilding the
  // menu anchor cannot move an already-open panel). The seq token remounts
  // the panel per open so its rows re-seed from the current bodyData.
  const [distributionState, setDistributionState] = React.useState<{
    open: boolean
    colKey: string
    columnTitle: string
  } | null>(null)
  const distributionAnchorRef = React.useRef<HTMLElement | null>(null)
  const [distributionSeq, setDistributionSeq] = React.useState(0)
  const closeDistribution = React.useCallback(() => {
    setDistributionState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  const openDistribution = (params: IrisTableContextMenuParams<Row>): void => {
    distributionAnchorRef.current = contextAnchorRef.current
    setDistributionState({
      open: true,
      colKey: (params.column.dataIndex ?? params.column.key) as string,
      columnTitle: params.column.title ?? params.column.key,
    })
    setDistributionSeq((s) => s + 1)
  }
  // ── NL summary panel (batch AW, iris 独有) ─────────────────────────────
  // Same clone pattern as the distribution panel: the menu's built-in
  // `__iris-summary` item opens it at the SAME virtual cursor anchor, and the
  // seq token remounts it per open so its rows re-seed from the current
  // bodyData.
  const [summaryState, setSummaryState] = React.useState<{
    open: boolean
    colKey: string
    columnTitle: string
  } | null>(null)
  const summaryAnchorRef = React.useRef<HTMLElement | null>(null)
  const [summarySeq, setSummarySeq] = React.useState(0)
  const closeSummary = React.useCallback(() => {
    setSummaryState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  const openSummary = (params: IrisTableContextMenuParams<Row>): void => {
    summaryAnchorRef.current = contextAnchorRef.current
    setSummaryState({
      open: true,
      colKey: (params.column.dataIndex ?? params.column.key) as string,
      columnTitle: params.column.title ?? params.column.key,
    })
    setSummarySeq((s) => s + 1)
  }
  // ── Annotation edit panel (batch BB, iris 独有) ───────────────────────
  // Same clone pattern as the distribution/summary panels: the menu's
  // built-in `__iris-annotate` / `__iris-annotate-edit` items open it at the
  // SAME virtual cursor anchor, and the seq token remounts it per open so
  // the textarea re-seeds from the current `annotations` map. Writes are
  // fully controlled: save/remove call `onAnnotationsChange` (empty text
  // removes the key); without the callback they are inert (documented).
  const [annotateState, setAnnotateState] = React.useState<{
    open: boolean
    cellKey: string
  } | null>(null)
  const annotateAnchorRef = React.useRef<HTMLElement | null>(null)
  const [annotateSeq, setAnnotateSeq] = React.useState(0)
  const closeAnnotate = React.useCallback(() => {
    setAnnotateState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  const openAnnotate = (params: IrisTableContextMenuParams<Row>): void => {
    annotateAnchorRef.current = contextAnchorRef.current
    const k = rowKeyOf(params.row, params.rowIndex)
    setAnnotateState({ open: true, cellKey: cellId(k, params.column.key) })
    setAnnotateSeq((s) => s + 1)
  }
  const saveAnnotation = (cellKey: string, text: string): void => {
    if (!onAnnotationsChange) return
    const next = { ...(annotations ?? {}) }
    if (text.trim() === '') delete next[cellKey]
    else next[cellKey] = text
    onAnnotationsChange(next)
    closeAnnotate()
  }
  const removeAnnotationKey = (cellKey: string): void => {
    if (!onAnnotationsChange) return
    const next = { ...(annotations ?? {}) }
    delete next[cellKey]
    onAnnotationsChange(next)
    // Close is part of the callback path only — without `onAnnotationsChange`
    // the panel's 删除 button is inert too (save/remove stay symmetric).
    closeAnnotate()
  }
  // ── Cell note hover popover (batch BM, iris 独有) ──────────────────────
  // One table-level hover target at a time (the last noted cell the pointer
  // entered). The anchor is a VIRTUAL element — a zero-size rect snapshot at
  // the cell's top-right corner (where the badge sits), captured at
  // mouseenter and read by useFloating after the state update commits
  // (context-menu precedent, rect-snapshot shape verbatim). mouseleave
  // closes — native-title semantics — and the popover is pure display
  // (pointer-events none), so it never blocks the leave. Off = zero cost:
  // the handlers spread onto cells only when `notePopover && note`.
  const [noteHover, setNoteHover] = React.useState<{ cellKey: string; text: string } | null>(null)
  const noteHoverAnchorRef = React.useRef<HTMLElement | null>(null)
  const closeNotePopover = React.useCallback(() => setNoteHover(null), [])
  const openNotePopover = (cellKey: string, text: string, el: HTMLElement): void => {
    const r = el.getBoundingClientRect()
    noteHoverAnchorRef.current = {
      getBoundingClientRect: () => ({
        left: r.right,
        top: r.top,
        right: r.right,
        bottom: r.top,
        width: 0,
        height: 0,
        x: r.right,
        y: r.top,
      }),
    } as unknown as HTMLElement
    setNoteHover({ cellKey, text })
  }
  // ── Header filter panel (vxe filterConfig parity, batch I) ─────────────
  // One panel at a time, keyed by the column whose trigger was clicked. The
  // anchor is the trigger BUTTON itself (a real DOM node), captured at click
  // time; the seq token remounts the panel per open so its draft checkbox
  // state always re-seeds from the applied `filterValues`.
  const [filterPanelState, setFilterPanelState] = React.useState<{
    open: boolean
    colKey: string
  } | null>(null)
  const filterAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  const [filterPanelSeq, setFilterPanelSeq] = React.useState(0)
  const closeFilterPanel = React.useCallback(() => {
    setFilterPanelState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  const openFilterPanel = (e: React.MouseEvent<HTMLButtonElement>, colKey: string): void => {
    // Never let the trigger click reach the header cell (which would sort).
    e.stopPropagation()
    filterAnchorRef.current = e.currentTarget
    setFilterPanelState({ open: true, colKey })
    setFilterPanelSeq((s) => s + 1)
  }
  const applyFilterValues = (colKey: string, values: string[]): void => {
    onFilterValuesChange?.({ ...(filterValues ?? {}), [colKey]: values })
    // Batch CB: record recent filters — non-empty sets only (an empty set is
    // the clear semantics, mergeFilterValues precedent). Records even without
    // an onFilterValuesChange handler (controlled-irrelevant).
    if (recentEnabledRef.current && values.length > 0) {
      recentRef.current?.record(colKey, values)
    }
  }
  // Clicking a recent entry applies it immediately — possibly across columns
  // (the entry carries its own column key) — and closes the panel. The
  // re-record inside applyFilterValues bumps the entry to the top (MRU).
  const applyRecentFilter = (entry: RecentFilterEntry): void => {
    applyFilterValues(entry.key, entry.values)
    closeFilterPanel()
  }
  const clearFilterValues = (colKey: string): void => {
    const next = { ...(filterValues ?? {}) }
    delete next[colKey]
    onFilterValuesChange?.(next)
  }
  // Batch BW: 复制值 — the clicked cell's display text (mask → formatter →
  // String, the `contextCellText` chain shared with cellTooltip) via the
  // existing safe clipboard writer (three-channel, no-op when no clipboard).
  const copyContextValue = (params: IrisTableContextMenuParams<Row>): void => {
    void writeClipboardText(contextCellText(params.row, params.column))
  }
  // Batch BW: 清空 — the clicked cell set to '' through ONE commitRowList
  // (the SAME funnel as the Delete shortcut: undo/audit/onDataChange
  // covered); locked/readonly no-op like every other write entry point.
  const clearContextCell = (params: IrisTableContextMenuParams<Row>): void => {
    const { row, column, rowIndex } = params
    if (isCellLocked(row, column) || isCellReadonly(row, column)) return
    const current = externalDataRef.current ?? []
    const k = rowKeyOf(row, rowIndex)
    const next = setCellValue(current, rowKey, k, column.key, '')
    if (next !== current) commitRowList(next)
  }
  const handleContextMenu = (
    e: React.MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    idx: number,
    ci: number,
  ): void => {
    if (!contextMenu) return
    // Swap menus: a body right-click closes the header pin menu (the two are
    // separate floating instances — batch BX).
    closePinMenu()
    e.preventDefault()
    // Virtual anchor: zero-size rect at the cursor. The object is rebuilt per
    // open (capturing this event's coordinates) and read by useFloating after
    // the state update commits, so the panel always lands at the cursor.
    contextAnchorRef.current = {
      getBoundingClientRect: () => ({
        left: e.clientX,
        top: e.clientY,
        right: e.clientX,
        bottom: e.clientY,
        width: 0,
        height: 0,
        x: e.clientX,
        y: e.clientY,
        toJSON() {},
      }),
    } as unknown as HTMLElement
    const params: IrisTableContextMenuParams<Row> = {
      row,
      column: col,
      rowIndex: idx,
      columnIndex: ci,
    }
    const items = contextMenu.items(params)
    // Batch AM: with `valueDistribution`, append the built-in item AFTER the
    // user items; a user item already using the reserved key is left alone
    // (dedupe guard) so the table never renders it twice.
    if (valueDistribution && !items.some((i) => i.key === DISTRIBUTION_MENU_KEY)) {
      items.push({ key: DISTRIBUTION_MENU_KEY, label: t('table.distribution') })
    }
    // Batch AW: with `nlSummary`, append the built-in summary item AFTER the
    // distribution item; a user item already using the reserved key is left
    // alone (dedupe guard) so the table never renders it twice.
    if (nlSummary && !items.some((i) => i.key === SUMMARY_MENU_KEY)) {
      items.push({ key: SUMMARY_MENU_KEY, label: t('table.summary') })
    }
    // Batch BW: 复制值 + 清空 are built-in quick actions on EVERY context
    // menu (unconditional, no new prop) — appended AFTER the summary item,
    // BEFORE the annotate block; the same dedupe guard as the distribution/
    // summary items leaves a user item using a reserved key alone, and the
    // onSelect wiring intercepts the keys so the user callback never sees
    // them.
    if (!items.some((i) => i.key === COPY_VALUE_MENU_KEY)) {
      items.push({ key: COPY_VALUE_MENU_KEY, label: t('table.copyValue') })
    }
    if (!items.some((i) => i.key === CLEAR_CELL_MENU_KEY)) {
      items.push({ key: CLEAR_CELL_MENU_KEY, label: t('table.clearCell') })
    }
    // Batch BB: with `annotationEditing`, append the built-in annotate items
    // AFTER the summary item — 添加批注 on a note-less cell, 编辑批注 +
    // 删除批注 on a noted one (existence = `annotations[cellId(rowKey, key)]`
    // non-empty); the same dedupe guard as the distribution/summary items.
    if (annotationEditing) {
      const cellKey = cellId(rowKeyOf(row, idx), col.key)
      if (annotations?.[cellKey]) {
        if (!items.some((i) => i.key === ANNOTATE_EDIT_MENU_KEY)) {
          items.push({ key: ANNOTATE_EDIT_MENU_KEY, label: t('table.annotate.edit') })
        }
        if (!items.some((i) => i.key === ANNOTATE_REMOVE_MENU_KEY)) {
          items.push({ key: ANNOTATE_REMOVE_MENU_KEY, label: t('table.annotate.remove') })
        }
      } else if (!items.some((i) => i.key === ANNOTATE_MENU_KEY)) {
        items.push({ key: ANNOTATE_MENU_KEY, label: t('table.annotate') })
      }
    }
    setContextMenuState({ open: true, items, params })
    setContextMenuSeq((s) => s + 1)
  }

  const beginEdit = (
    row: Row,
    col: IrisTableColumn<Row>,
    rowIdent: string | number,
    rowIndex: number,
  ) => {
    if (!col.editable || col.formula || isCellLocked(row, col) || isCellReadonly(row, col)) return
    // Any manual start supersedes a stashed Tab-navigation intent (M1).
    pendingNavRef.current = null
    editCtxRef.current = { row, col, rowIndex }
    const current = getCellValue(row, col)
    cellEdit.startEdit(cellId(rowIdent, col.key), col.key, current == null ? '' : String(current))
    // Batch V (vxe edit-activated parity): the session is open — report the
    // cell coordinates (cell mode only).
    onEditStartRef.current?.({ row, column: col, rowIndex })
  }
  const cancelEdit = () => {
    cellEdit.cancelEdit()
    // Batch V (vxe edit-closed parity): the session ended without a commit.
    const ctx = editCtxRef.current
    if (ctx)
      onEditClosedRef.current?.({
        row: ctx.row,
        column: ctx.col,
        rowIndex: ctx.rowIndex,
        cancelled: true,
      })
  }
  const commitEdit = (): boolean => {
    const ok = commitWithSummaryIntent(cellEdit)
    if (ok) {
      // Batch V (vxe edit-closed parity): committed — the store's validated
      // slot holds the coerced committed value (getDraft is cleared).
      const ctx = editCtxRef.current
      if (ctx)
        onEditClosedRef.current?.({
          row: ctx.row,
          column: ctx.col,
          rowIndex: ctx.rowIndex,
          value: cellEdit.getValidated(),
          cancelled: false,
        })
    }
    return ok
  }

  // Tab edit navigation (vxe editConfig parity, batch J): Tab commits the
  // current cell and opens the NEXT editable column of the same row, Shift+Tab
  // the previous one (`leafColumns` render order). A validation failure keeps
  // the cell (commit returns false). With no editable neighbor the edit is
  // committed and the default Tab behavior moves focus away (no preventDefault).
  // Batch K (M1): editRules columns validate through an async Promise, so
  // commitEdit returns false immediately and the commit lands later — stash
  // the Tab intent and let the settle-observer effect perform the navigation
  // when validation passes (or drop it when it fails, staying with the error).
  const moveEditOnTab = (e: React.KeyboardEvent, dir: 1 | -1): void => {
    if (e.key !== 'Tab') return
    const ctx = editCtxRef.current
    if (!ctx) return
    if (hasEditRules(ctx.col)) {
      e.preventDefault()
      pendingNavRef.current = {
        dir,
        row: ctx.row,
        col: ctx.col,
        k: rowKeyOf(ctx.row, ctx.rowIndex),
        idx: ctx.rowIndex,
      }
      commitWithSummaryIntent(cellEdit)
      return
    }
    if (!commitEdit()) {
      e.preventDefault()
      return
    }
    const start = leafColumns.indexOf(ctx.col)
    for (let i = start + dir; i >= 0 && i < leafColumns.length; i += dir) {
      const nextCol = leafColumns[i]!
      if (
        !nextCol.editable ||
        nextCol.formula ||
        isCellLocked(ctx.row, nextCol) ||
        isCellReadonly(ctx.row, nextCol)
      )
        continue
      e.preventDefault()
      beginEdit(ctx.row, nextCol, rowKeyOf(ctx.row, ctx.rowIndex), ctx.rowIndex)
      return
    }
  }

  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, col: IrisTableColumn<Row>) => {
    if (!col.sortable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (multiSort) cycleMultiSort(col)
      else cycleSort(col)
    }
  }

  // Sortable header click: multi mode appends/cycles the list, single mode
  // keeps the asc → desc → none cycle — both routed through one entry point.
  const cycleHeaderSort = (col: IrisTableColumn<Row>) => {
    if (multiSort) cycleMultiSort(col)
    else cycleSort(col)
  }

  const rowKeyOf = (row: Row, rowIndex?: number): string | number => {
    // Batch R (vxe-grid deprecated string `rowId` parity, re-typed as a
    // function): the `rowKey` field wins; `rowId` supplies the key for rows
    // lacking the field; the call-site index fallback (`k ?? idx`) stays for
    // callers without an index. Without `rowId`, `rowKeyOf(row, i)` returns
    // `row[rowKey] ?? i` — identical to the old `rowKeyOf(row)` plus `?? i`
    // at index-bearing call sites; non-index-bearing sites (flattenTree
    // getKey) keep the old `row[rowKey]` result (undefined for keyless
    // rows), so the additive guard holds per call site.
    const v = (row as Record<string, unknown>)[rowKey]
    if (v != null) return v as string | number
    if (rowIndex === undefined) return undefined as unknown as string | number
    return (rowId?.(row, rowIndex) ?? rowIndex) as string | number
  }

  // Batch AT: record ONE audit entry per mutation commit. A plain function
  // (not a useCallback — it closes over rowKeyOf, which is declared just
  // above, and the stable refs/controller). Exposed to commitValue (defined
  // earlier in the body) through the recordAuditRef mirror assigned here.
  const recordAudit = (next: Row[], type: AuditLogType): void => {
    if (!auditEnabledRef.current) return
    const entry = auditDiff(auditRowsRef.current, next, (r, i) => rowKeyOf(r, i))
    if (entry) audit.push({ type, ...entry })
    // Eager ref sync: a following commit in the SAME event must diff against
    // the true intermediate list (React defers the setLiveData updaters).
    auditRowsRef.current = next
  }
  recordAuditRef.current = recordAudit

  // Batch BA: one version per row-list commit — the PRE-change rows (the
  // exact state a restore returns to) + the same type hint the batch-AT
  // funnel records. Runs BEFORE recordAudit's eager auditRowsRef sync so the
  // snapshot holds the true previous rows. commitValue (inline edits) never
  // reaches here — documented scope (restore replaces the whole row list).
  const recordHistory = (type: AuditLogType): void => {
    if (!historyEnabledRef.current) return
    history.push(auditRowsRef.current, type)
  }

  /**
   * Unified cell click: preserves the internal edit/range behavior, then fires
   * the user `onCellClick` (vxe cell-click parity) with full coordinates.
   */
  const handleCellClick = (
    e: React.MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    k: string | number | undefined,
    idx: number,
    ci: number,
  ): void => {
    if (rowMode && k != null) {
      // vxe editConfig.mode='row' parity (batch K): a click on any cell of a
      // row that has editable columns opens every editable column's editor;
      // clicking a DIFFERENT row first commits the current row's open editors
      // (vxe click-elsewhere-commits). Editors stopPropagation, so
      // interactions inside an editor never reach here. A click on a column
      // that was already committed (session closed) reopens just that column.
      if (rowEditing?.k === k) {
        const id = cellId(k, col.key)
        if (
          col.editable &&
          !col.formula &&
          !isCellLocked(row, col) &&
          !isCellReadonly(row, col) &&
          !rowSessionsRef.current.has(id)
        ) {
          const session = createRowSession(k, col, idx)
          const current = getCellValue(row, col)
          session.startEdit(id, col.key, current == null ? '' : String(current))
          setRowSessions((prev) => {
            const next = new Map(prev)
            next.set(id, session)
            return next
          })
          focusRowEditor(col.key)
        }
      } else {
        switchRowEdit(row, idx, col.key)
      }
    } else if (cellRange) {
      if (e.shiftKey) cellRangeCtrl.extendRange(idx, ci)
      else cellRangeCtrl.startRange(idx, ci)
      // Batch AH: anchor the floating range toolbar at the new range's first
      // cell. This is the ONLY anchor-update path when `onCellClick` is also
      // wired (the cellRange spread onClick below would be shadowed by the
      // unified onClick → dead code — hence the anchor lives here).
      updateRangeToolbarAnchor()
    } else if (col.editable && !col.formula && editConfig?.trigger === 'click' && k != null) {
      beginEdit(row, col, k, idx)
    }
    onCellClick?.({ row, column: col, rowIndex: idx, columnIndex: ci })
  }

  const setCurrentColumn = (col: IrisTableColumn<Row>): void => {
    if (onCurrentColumnChange && beforeCurrentColumnChange?.(col.key) !== false) {
      onCurrentColumnChange(col.key)
    }
  }

  // Single mode toggles off / replaces, multiple toggles inclusion — both are
  // the model's `toggle` semantics for the row's key.
  // ── Imperative row ops (vxe-grid insert/remove/setRow parity, batch E) ──
  const onDataChangeRef = React.useRef(onDataChange)
  onDataChangeRef.current = onDataChange
  const commitRowList = React.useCallback(
    (next: Row[], type: AuditLogType = 'edit') => {
      // Batch BA: push the PRE-change rows + the type hint into the version
      // ring BEFORE recordAudit overwrites the diff snapshot. restoreVersion
      // flips historySuppressRef so its own replay never pushes a new version
      // (it IS audited + undoable — consistent with undo/redo replay).
      if (!historySuppressRef.current) recordHistory(type)
      recordUndo(next)
      // Batch AT: ONE audit entry per commit — the type hint comes from the
      // mutation site (insert/remove/paste/batch/fill/undo/redo; default
      // 'edit' covers inline-equivalent writes like updateRow, find-replace,
      // range clear and the Delete shortcut); rowKey + first changed cell
      // come from the light diff against the previous rows.
      recordAudit(next, type)
      setLiveData(next)
      externalDataRef.current = next
      onDataChangeRef.current?.(next)
    },
    [recordUndo, recordAudit, recordHistory],
  )
  // Replay a snapshot (undo or redo) through the same write-back channel as
  // every other mutation — one commitRowList (setLiveData + onDataChange).
  // restoringRef is flipped around the replay so recordUndo (called inside
  // commitRowList) is a no-op — history never re-pushes its own replay.
  // Selection: keys that no longer exist in the restored list are pruned
  // (mirrors the removeRows/clearSelection pruning pattern); keys that
  // survive keep their selected state (selection unchanged on undo/redo).
  const applyUndoSnapshot = React.useCallback(
    (rows: Row[] | undefined, type: AuditLogType = 'undo'): void => {
      if (rows == null) return
      const before = displaySelectionRef.current
      if (selectable !== 'none' && before.length > 0) {
        const afterKeys = new Set<string | number>()
        rows.forEach((r, i) => {
          const k = rowKeyOf(r, i)
          if (k != null) afterKeys.add(k)
        })
        const vanished = before.filter((k) => !afterKeys.has(k))
        if (vanished.length > 0) {
          rebaseToProp()
          selModel.set(before.filter((k) => !vanished.includes(k)))
        }
      }
      restoringRef.current = true
      commitRowList(rows, type)
      restoringRef.current = false
    },
    [commitRowList, rebaseToProp, selModel, selectable],
  )
  // Batch BA: restore the rows captured before commit `index` through the
  // normal write-back channel (commitRowList, type 'undo' — auditable +
  // undoable) while historySuppressRef stops the replay from pushing a new
  // version. No-op for an unknown index (the ring may have trimmed it).
  const restoreVersion = (index: number): void => {
    const entry = history.get(index)
    if (entry === undefined) return
    historySuppressRef.current = true
    commitRowList(entry.rows as Row[], 'undo')
    historySuppressRef.current = false
  }
  const handleRef = React.useRef<IrisTableHandle<Row> | null>(null)
  handleRef.current = {
    insertRow: (row, index) => {
      commitRowList(insertRowInList(externalDataRef.current ?? [], rowKey, row, index), 'insert')
    },
    cloneRow: (key, index) => {
      const rows = externalDataRef.current ?? []
      const next = cloneRowInList(rows, rowKey, key, index)
      if (next !== rows) commitRowList(next, 'insert')
    },
    removeRow: (key) => {
      const rows = externalDataRef.current ?? []
      const next = removeRowFromList(rows, rowKey, key)
      if (next !== rows) {
        if (displaySelectionRef.current.includes(key)) {
          rebaseToProp()
          selModel.toggle(key)
        }
        pruneDirtyFor(key)
        commitRowList(next, 'remove')
      }
    },
    removeRows: (keys) => {
      // Batch remove (vxe removeRows parity, batch J): compose the core helper
      // per key, skipping missing ones; prune the selection of the keys that
      // were ACTUALLY removed; commit + onDataChange exactly once.
      let rows = externalDataRef.current ?? []
      const removed = new Set<string | number>()
      for (const key of keys) {
        const next = removeRowFromList(rows, rowKey, key)
        if (next !== rows) {
          removed.add(key)
          rows = next
        }
      }
      if (removed.size === 0) return
      for (const key of removed) pruneDirtyFor(key)
      const selectedNow = displaySelectionRef.current
      if (selectable !== 'none' && selectedNow.some((k) => removed.has(k))) {
        rebaseToProp()
        for (const key of removed) {
          if (selectedNow.includes(key)) selModel.toggle(key)
        }
      }
      commitRowList(rows, 'remove')
    },
    updateRow: (key, patch) => {
      commitRowList(updateRowInList(externalDataRef.current ?? [], rowKey, key, patch))
    },
    refetch: () => {
      proxyRef.current?.refetch()
    },
    // ── Proxy methods (vxe loadData/reloadData/commitProxy/getProxyInfo
    // parity, batch V) ────────────────────────────────────────────────────
    loadData: (rows) => {
      // loadData replaces the live row list through the write-back channel
      // (fires onDataChange). The core remote table source has no setData,
      // so the proxy state (total/page) stays unchanged until the next
      // query replaces the page (documented in the handle type).
      commitRowList(rows)
    },
    reloadData: () => {
      proxyRef.current?.refetch()
    },
    commitProxy: (overrides) => {
      proxyRef.current?.setParams(overrides)
    },
    getProxyInfo: () => {
      const s = proxyRef.current?.getState()
      return s ? { page: s.params.page, pageSize: s.params.pageSize, total: s.total } : null
    },
    getData: () => [...(externalDataRef.current ?? [])],
    // ── View methods (vxe getFilteredData parity + current-view export,
    // batch W) ────────────────────────────────────────────────────────────
    // The handle is assigned to tableRef ONCE on mount (effect below), so
    // methods run against the mount-time closure — read the per-render ref
    // mirrors (filteredDataRef / viewColumnsRef, set above) instead of the
    // render's memo values, which would go stale after any rerender.
    // viewColumnsRef holds leafColumns: flat mode is reference-identical to
    // displayColumns (zero flat regression) and grouped mode carries the
    // data-bearing leaves, so the CSV keeps leaf data in both modes.
    getFilteredData: () => [...filteredDataRef.current],
    exportCurrentViewCsv: () =>
      exportCsv(
        withComputedFormulaCells(
          [...filteredDataRef.current],
          viewColumnsRef.current,
          formulaTablesRef.current,
        ),
        viewColumnsRef.current,
      ),
    // Batch AP (iris 独有): export the SELECTED rows — selection keys mapped
    // through the latest bodyData in bodyData order (the same view the
    // selection summary uses; cross-page proxy keys absent from the loaded
    // page are skipped), formula columns materialized on shadow rows, hidden
    // columns excluded — byte-identical shape to exportCurrentViewCsv. Empty
    // selection → '' (caller detects via getSelection()).
    exportSelectionCsv: () => {
      const selected = new Set(displaySelectionRef.current)
      const rows = bodyDataRef.current.filter((row, i) => selected.has(rowKeyOf(row, i)))
      if (rows.length === 0) return ''
      return exportCsv(
        withComputedFormulaCells(rows, viewColumnsRef.current, formulaTablesRef.current),
        viewColumnsRef.current,
      )
    },
    getSelection: () => [...displaySelectionRef.current],
    // ── Selection methods (vxe clearCheckboxRow / setAllCheckboxRow(true) /
    // toggleCheckboxRow parity, batch F) ───────────────────────────────────
    clearSelection: () => {
      if (selectable === 'none') return
      rebaseToProp()
      selModel.clear()
    },
    selectAll: () => {
      if (selectable !== 'multi') return
      rebaseToProp()
      // vxe setAllCheckboxRow(true): select every checkMethod-eligible row of
      // the current page (checkMethod rows are skipped, vxe parity) — UNIONED
      // with the existing selection, so rows selected on an earlier proxy page
      // (or a prior toggle) are kept instead of replaced.
      const keys = bodyData
        .map((row, i) => (checkMethod && !checkMethod(row, i) ? null : rowKeyOf(row, i)))
        .filter((k): k is string | number => k != null)
      const existing = new Set(displaySelection)
      selModel.set([...displaySelection, ...keys.filter((k) => !existing.has(k))])
    },
    toggleRowSelection: (key) => {
      if (selectable === 'none') return
      rebaseToProp()
      // vxe toggleCheckboxRow: a DIRECT toggle by key — bypasses checkMethod.
      selModel.toggle(key)
    },
    // ── Imperative view methods (vxe-grid scrollToRow / toggleRowExpand /
    // clearSort / clearFilter / setCurrentRow / setCurrentColumn parity, batch T)
    scrollToRow: (key) => {
      // The row DOM node is located via the same data attribute the row-drag
      // path uses (flat, tree, grouped and virtual rows all carry it). Guarded
      // for jsdom, which does not implement scrollIntoView. The selector is
      // escaped for attribute values (a raw `"` in a key would otherwise make
      // querySelector throw); jsdom lacks CSS.escape, so fall back to attribute
      // iteration there.
      const keyStr = String(key)
      const root = rootRef.current
      if (!root) return
      const el =
        typeof CSS !== 'undefined' && CSS.escape
          ? root.querySelector<HTMLElement>(`[data-iris-table-row="${CSS.escape(keyStr)}"]`)
          : Array.from(root.querySelectorAll<HTMLElement>('[data-iris-table-row]')).find(
              (n) => n.getAttribute('data-iris-table-row') === keyStr,
            )
      el?.scrollIntoView?.({ block: 'nearest' })
    },
    toggleRowExpand: (key) => {
      // Tree mode and detail mode share the single expansion model — both
      // render toggles route through expansion.toggle. No-op for plain tables.
      if (!treeMode && !hasDetail) return
      const idx = liveDataRef.current.findIndex((r, i) => rowKeyOf(r, i) === key)
      if (idx < 0) return
      const row = liveDataRef.current[idx]
      // Mirror the row-click path's gate: detail expansion respects rowExpandable.
      if (hasDetail && !isRowExpandable(row, idx)) return
      const keyStr = String(key)
      // Live read via the model index: the handle runs against the MOUNT-time
      // closure, so the render snapshot `expandedKeys` would go stale across
      // toggles (second call would re-report the pre-first-toggle state).
      // isExpanded matches the click path's `!expandedKeys.includes(...)`
      // semantics against the SAME model.
      const wasExpanded = expansion.isExpanded(keyStr)
      expansion.toggle(keyStr)
      // vxe toggle-row-expand parity: events fire with the NEW state, and the
      // same channel as the corresponding render toggle (detail vs tree).
      if (hasDetail) onExpandChange?.(row, !wasExpanded)
      if (treeMode) onTreeExpandChange?.(row, !wasExpanded)
    },
    clearSort: () => {
      // Multi mode owns the sort list; single mode the one-column state.
      if (multiSort) setMultiSort([])
      else setSort(null)
    },
    clearFilter: () => {
      // Both filter channels are CONTROLLED (no internal mode — batch I), so
      // the change handlers own the reset; without handlers the parent map
      // stays untouched (read-only table, documented).
      onFiltersChange?.({})
      onFilterValuesChange?.({})
    },
    setCurrentRow: (key) => {
      // Mirror the row-click path's veto guards: fire only when the row
      // exists AND the handler is provided (no-op otherwise, documented).
      const row = liveDataRef.current.find((r, i) => rowKeyOf(r, i) === key)
      if (row !== undefined && onCurrentRowChange) {
        if (beforeCurrentRowChange?.(key, row) !== false) onCurrentRowChange(key, row)
      }
    },
    setCurrentColumn: (key) => {
      // Mirror the header-click path (setCurrentColumn helper + veto guard).
      const col = leafColumns.find((c) => c.key === key)
      if (col) setCurrentColumn(col)
    },
    // Batch AT (iris 独有): audit trail programmatic access — a snapshot
    // (newest-first entries) and a wipe. Both run against the ref-once
    // controller; the seq counter never resets on clear (audit integrity).
    getAuditLog: () => audit.list(),
    clearAuditLog: () => {
      audit.clear()
    },
    // Batch BA (iris 独有): version history programmatic access — a
    // LIGHTWEIGHT (no rows) newest-first snapshot for the caller/panel, and
    // a time-travel restore through the normal write-back channel as 'undo'
    // (suppressed from re-pushing; unknown index → no-op).
    getVersions: () => history.list().map((e) => ({ index: e.index, at: e.at, type: e.type })),
    restoreVersion,
    // Batch BF (iris 独有): export the PRE-change snapshot of commit `index`
    // through the same exportCsv pipeline as exportCurrentViewCsv (formula
    // columns materialized on shadow rows, masks applied, hidden columns
    // excluded) — the row source is the version ring, not the live view.
    // Unknown index (trimmed/cleared) or no versionHistory → '' (caller
    // detects via getVersions()).
    exportVersionCsv: (index) => {
      const entry = history.get(index)
      if (entry === undefined) return ''
      return exportCsv(
        withComputedFormulaCells(entry.rows, viewColumnsRef.current, formulaTablesRef.current),
        viewColumnsRef.current,
      )
    },
    // Batch BV (iris 独有): export the DIFF rows of the compare view —
    // current-view rows marked removed/changed (VIEW order, filteredData —
    // the same source as exportCurrentViewCsv) + compareWith-only added rows
    // (SNAPSHOT order, no render slot), each prefixed with a marker column
    // (`__iris_diff`: added/removed/changed, header = table.compare.diff);
    // changed cells export `maskedOld → maskedNew` (mask before composition,
    // exportRaw keeps both sides bare, formula columns do not self-composite).
    // Feature off (no compareWith / no rowKey — the render memo is null) →
    // ''; identical snapshots → header only (two states, caller
    // distinguishes via the memo being non-null).
    exportComparisonCsv: () => {
      const diff = compareDiffRef.current
      const snapshot = compareWithRef.current
      if (!diff || !snapshot || !rowKeyRef.current) return ''
      return buildComparisonCsv(
        filteredDataRef.current,
        snapshot,
        rowKeyRef.current,
        diff,
        viewColumnsRef.current,
        formulaTablesRef.current,
        t('table.compare.diff'),
      )
    },
    // Batch BZ (iris 独有): export the FULL view state as JSON — the 9 spec
    // blocks (sort / filters / filterValues / columnVisibility / columnOrder /
    // columnWidths / pageSize / expandedKeys / query) captured by the SAME
    // collector memo as persistState/views. multiSortState is deliberately
    // stripped here (spec has no such block; it stays in the collector for
    // persistState/views — import accepts supersets, so round-trips still
    // work). A piece appears only when restorable (owning callback present;
    // pageSize only with a proxy; expandedKeys only when expandable AND
    // restorable; query only when set) — a bare table exports '{}'.
    // Round-trips byte-identically through importStateJson.
    exportStateJson: () => {
      const s = { ...persistSnapshotRef.current }
      delete (s as { multiSortState?: unknown }).multiSortState
      return JSON.stringify(s)
    },
    // Batch BZ: apply an exported state JSON — parse + replay every present
    // piece through the owning callbacks (the SAME applyViewSnapshot path a
    // named view uses: query restores FIRST via onQueryChange, pageSize
    // reproduces onPageChange(1, size) + exactly one request, expandedKeys
    // replaces the whole set). Invalid JSON or a non-object value → false
    // with NOTHING applied; valid JSON applies piece-by-piece lazily and
    // returns true (ineligible pieces — missing callback / wrong type — are
    // skipped).
    importStateJson: (json) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        return false
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false
      applyViewSnapshotRef.current(parsed as IrisTablePersistedState)
      return true
    },
  }
  React.useEffect(() => {
    if (tableRef) tableRef.current = handleRef.current
    return () => {
      if (tableRef) tableRef.current = null
    }
  }, [tableRef])

  const toggleRow = (row: Row, idx?: number) => {
    if (selectable === 'none') return
    if (idx != null && checkMethod && !checkMethod(row, idx)) return
    rebaseToProp()
    selModel.toggle(rowKeyOf(row, idx))
  }

  /**
   * Shift-click checkbox range (vxe checkboxConfig isShiftKey parity): toggle
   * every checkMethod-eligible row between the anchor and the target in
   * bodyData order. An unknown anchor (e.g. the anchor row left the page in
   * proxy mode) degrades to a single toggle of the target. Updates go through
   * the model's per-key `toggle` (batch: one rebase against the controlled
   * prop, then the toggles).
   */
  const toggleRowRange = (anchorKey: string | number, targetKey: string | number) => {
    if (selectable !== 'multi') return
    const anchorIdx = bodyData.findIndex((r, i) => rowKeyOf(r, i) === anchorKey)
    const targetIdx = bodyData.findIndex((r, i) => rowKeyOf(r, i) === targetKey)
    if (anchorIdx < 0 || targetIdx < 0) {
      // Unknown anchor: fall back to a plain single toggle of the target
      // (checkMethod still respected — a disabled row cannot be range-toggled).
      if (targetIdx < 0 || (checkMethod && !checkMethod(bodyData[targetIdx]!, targetIdx))) return
      rebaseToProp()
      selModel.toggle(targetKey)
      return
    }
    const from = Math.min(anchorIdx, targetIdx)
    const to = Math.max(anchorIdx, targetIdx)
    const keys: Array<string | number> = []
    for (let i = from; i <= to; i += 1) {
      const row = bodyData[i]!
      if (checkMethod && !checkMethod(row, i)) continue
      keys.push(rowKeyOf(row, i))
    }
    if (keys.length === 0) return
    rebaseToProp()
    for (const key of keys) selModel.toggle(key)
  }

  // Tree mode (opt-in via getSubRows): flatten the data into the visible rows
  // honoring the (shared) expansion model. `bodyData` is the row list the body,
  // selection, and summary all operate on — identical to `sortedData` in flat
  // mode, so non-tree behavior is unchanged.
  const treeMode = getSubRows !== undefined || lazyLoad !== undefined
  // Lazy tree (vxe lazyLoad parity, batch J): children are fetched on first
  // expand. The loaded map lives in a ref (read by `getChildren`, which wins
  // over `getSubRows`); the loading SET is React state because it drives the
  // caret render (spinner) on both transitions.
  const lazyChildrenRef = React.useRef<Map<string, Row[]>>(new Map())
  const [lazyLoading, setLazyLoading] = React.useState<Set<string>>(new Set())
  // Batch K review fix (M2 race): bumped whenever the data source reference
  // changes (cache + loading set cleared). A lazy-load callback captures the
  // epoch at call time and drops its result if a refresh happened while the
  // fetch was in flight — stale children must never re-seed the cleared cache.
  const lazyEpochRef = React.useRef(0)
  // Tree keys (batch R): flattenTree's getKey receives only the row, so with
  // `rowId` the sibling index is precomputed here in the same walk order as
  // flattenTree (forEach index per level) and the flatten's getKey reads this
  // map — rowId applies to tree rows too. Null without `rowId` → getKey falls
  // back to `String(rowKeyOf(row))`, exactly as before (additive guard).
  // `lazyLoading` in deps re-walks after a lazy load lands (the ref map
  // itself is not reactive).
  const treeKeyMap = React.useMemo<Map<Row, string> | null>(() => {
    if (!rowId) return null
    const map = new Map<Row, string>()
    const walk = (rows: readonly Row[]): void => {
      rows.forEach((r, i) => {
        const key = String(rowKeyOf(r, i))
        map.set(r, key)
        const children = lazyChildrenRef.current.get(key) ?? getSubRows?.(r)
        if (children && children.length > 0) walk(children)
      })
    }
    walk(sortedData)
    return map
  }, [rowId, sortedData, getSubRows, lazyLoading])
  const lazyChildrenOf = (row: Row): readonly Row[] | undefined => {
    const key = treeKeyMap?.get(row) ?? String(rowKeyOf(row))
    return lazyChildrenRef.current.get(key) ?? getSubRows?.(row)
  }
  // Comparator for tree siblings: multi mode uses the chained multi comparator
  // (batch G fix), single mode keeps its own — byte-identical to before.
  const treeComparator = React.useMemo(
    () => (multiSort ? multiSortComparator : sortComparator),
    [multiSort, multiSortComparator, sortComparator],
  )
  const flatTree = React.useMemo<Array<TreeRow<Row>> | null>(
    () =>
      treeMode
        ? flattenTree<Row>(sortedData, {
            getKey: (r) => treeKeyMap?.get(r) ?? String(rowKeyOf(r)),
            // With an active sort, sort each level's children by the same
            // comparator so the whole tree reorders hierarchically (multi mode
            // passes the chained multi comparator so child ties resolve by the
            // secondary columns too). Lazy-loaded children win over `getSubRows`
            // and still participate in the same sorting.
            getChildren: treeComparator
              ? withSortedChildren(lazyChildrenOf, treeComparator)
              : lazyChildrenOf,
            isExpanded: (k) => expandedKeys.includes(k),
          })
        : null,
    // Recompute on data / expansion / accessor / sort change (rowKeyOf reads `rowKey`).
    [
      treeMode,
      sortedData,
      getSubRows,
      expandedKeys,
      rowKey,
      rowId,
      treeKeyMap,
      treeComparator,
      lazyLoading,
    ],
  )
  // Client-side filters (vxe filterConfig parity, local mode): core filterSort
  // applied to the sorted data before paging/virtualizing (flat mode). With
  // remoteFilter, the server owns filtering — rows are never hidden locally.
  // The search form's applied values merge over the `filters` prop (form wins,
  // neither input is mutated); in proxy mode the server owns form filtering,
  // so only the prop map filters the loaded page (batch C behavior preserved).
  const filteredData = React.useMemo(() => {
    if (remoteFilter) return querySortedData
    const merged: Record<string, string> = proxy
      ? (filters ?? {})
      : mergeFormFilters(filters ?? {}, formApplied)
    // Batch AI: the parsed query's substring channel (`=`/`contains`) AND-merges
    // over the prop/form filters — the query wins on key collision (last-typed
    // wins, same as the form). In proxy mode without remoteFilter the loaded
    // page is still filtered locally (batch C behavior preserved).
    for (const [key, value] of Object.entries(queryParsed.filters)) {
      if (value !== '') merged[key] = value
    }
    const active = Object.entries(merged).filter(([, v]) => v != null && v !== '')
    // Batch I: per-column checked sets OR-match the raw String(value); a set
    // applies only when non-empty. AND-ed with the text channel below.
    const checkedEntries = Object.entries(filterValues ?? {}).filter(
      ([, values]) => values.length > 0,
    )
    // Batch AI: the parsed `in` lists join the checked-set channel (OR-match
    // against the raw String(value) — the same semantics as filterValues).
    const queryInEntries = Object.entries(queryParsed.inValues).filter(
      ([, values]) => values.length > 0,
    )
    if (
      active.length === 0 &&
      checkedEntries.length === 0 &&
      queryInEntries.length === 0 &&
      queryParsed.rules.length === 0
    ) {
      return querySortedData
    }
    return querySortedData.filter((row) => {
      const textOk = active.every(([key, value]) => {
        const col = displayColumns.find((c) => c.key === key)
        if (!col) return true
        const raw = getCellValue(row, col)
        if (col.filterMethod) return col.filterMethod(raw, row, value)
        return String(raw ?? '')
          .toLowerCase()
          .includes(value.toLowerCase())
      })
      const setsOk = checkedEntries.every(([key, values]) => {
        const col = displayColumns.find((c) => c.key === key)
        if (!col) return true
        return values.includes(String(getCellValue(row, col) ?? ''))
      })
      // Batch AI: query `in` lists (OR-match) + typed relational rules AND-ed
      // with the channels above (core matchesRule = filterSort semantics).
      const queryInOk = queryInEntries.every(([key, values]) => {
        const col = displayColumns.find((c) => c.key === key)
        if (!col) return true
        return values.includes(String(getCellValue(row, col) ?? ''))
      })
      const rulesOk = queryParsed.rules.every((rule) => {
        const col = displayColumns.find((c) => c.key === rule.key)
        if (!col) return true
        return matchesRule(getCellValue(row, col), rule)
      })
      return textOk && setsOk && queryInOk && rulesOk
    })
  }, [
    querySortedData,
    filters,
    formApplied,
    displayColumns,
    remoteFilter,
    proxy,
    filterValues,
    queryParsed,
  ])
  // Batch W: mirror the latest filtered rows for the mount-time handle
  // (getFilteredData / exportCurrentViewCsv must see post-rerender state,
  // not the mount render's memo).
  const filteredDataRef = React.useRef(filteredData)
  filteredDataRef.current = filteredData
  // Batch BC: mirror the latest formulaTables for the mount-time handle
  // (exportCurrentViewCsv / exportSelectionCsv run on demand, NOT during
  // render — the module slot is render-scoped and would race on multi-table
  // pages; the handles pass this ref's value explicitly).
  const formulaTablesRef = React.useRef<FormulaTables | undefined>(formulaTables)
  formulaTablesRef.current = formulaTables
  const bodyData = flatTree ? flatTree.map((t) => t.row) : filteredData
  // Batch AR mini chart preview (iris 独有): numeric leaf columns for the
  // chart panel — the two existing signals — a row whose `getCellValue` is a
  // number (formula columns flow through the choke point) OR a
  // `summary: 'sum'` column — computed over the CURRENT filtered rows (the
  // same list the panel charts).
  const chartNumericColumns = React.useMemo(
    () =>
      leafColumns.filter(
        (col) =>
          col.summary === 'sum' ||
          filteredData.some((row) => typeof getCellValue(row, col) === 'number'),
      ),
    [leafColumns, filteredData],
  )
  // Batch BI column sparkline (iris 独有): one O(n) render memo — the
  // filteredData row-identity index plus per-column RAW value arrays — so
  // each visible cell costs one Map lookup + an O(i) prefix slice (O(n²)
  // worst case accepted; virtual scroll bounds the visible window). The
  // series follows filteredData (fiat): sort/filter reorder and trim the
  // prefix; tree expansion and group collapse do NOT truncate it. Lazily
  // null when no column opts in.
  const sparklineData = React.useMemo<SparklineData<Row> | null>(() => {
    if (!leafColumns.some((c) => c.sparkline)) return null
    const rowIndexOf = new Map<Row, number>()
    filteredData.forEach((row, i) => rowIndexOf.set(row, i))
    const valuesByKey = new Map<string, unknown[]>()
    for (const col of leafColumns) {
      if (!col.sparkline) continue
      const values: unknown[] = new Array(filteredData.length)
      filteredData.forEach((row, i) => {
        values[i] = getCellValue(row, col)
      })
      valuesByKey.set(col.key, values)
    }
    return { rowIndexOf, valuesByKey }
  }, [leafColumns, filteredData])
  // Batch AP: mirror the latest body rows for the mount-time handle
  // (exportSelectionCsv runs against the mount-time closure and must see
  // post-rerender rows — same pattern as filteredDataRef above).
  const bodyDataRef = React.useRef(bodyData)
  bodyDataRef.current = bodyData
  // Batch BV: mirror the latest compare state for the mount-time handle
  // (exportComparisonCsv runs on demand, NOT during render — the same
  // ref-mirror pattern as filteredDataRef/bodyDataRef above; the diff memo
  // and the props are render-scoped and would go stale in the mount closure).
  const compareDiffRef = React.useRef<RowDiff | null>(compareDiff)
  compareDiffRef.current = compareDiff
  const compareWithRef = React.useRef<Row[] | undefined>(compareWith)
  compareWithRef.current = compareWith
  const rowKeyRef = React.useRef<string>(rowKey)
  rowKeyRef.current = rowKey

  // Batch BL: after EVERY commit, sample the render+layout duration from
  // the render-top mark and push the latest snapshot into the perf
  // controller (rows = bodyData, columns = leafColumns, changes = audit
  // depth). Dependency-less on purpose — a fresh capture per commit. The
  // push only notifies the floating perf panel (a separate portal root via
  // useSyncExternalStore) — the table NEVER re-renders from its own
  // measurement (vs. setState-in-effect which would busy-loop). Off = zero
  // cost (the gate skips the push entirely).
  React.useLayoutEffect(() => {
    if (!perfEnabledRef.current) return
    perf.push({
      durationMs: nowMs() - perfStartRef.current,
      rows: bodyData.length,
      columns: leafColumns.length,
      changes: audit.depth,
    })
  })

  // Batch AM: per-column native datalist suggestions (iris 独有). Only
  // `suggest === true` columns are scanned (an explicit array passes through
  // with zero scan); `true` builds DISTINCT String values from `bodyData`
  // (null/'' excluded), sorted, capped at 50 — the same indirection
  // getCellValue uses. Keyed by column key so EditorSurface stays free of
  // bodyData.
  const suggestOptions = React.useMemo(() => {
    const byKey = new Map<string, string[]>()
    for (const col of leafColumns) {
      if (col.suggest === undefined) continue
      if (Array.isArray(col.suggest)) {
        byKey.set(
          col.key,
          col.suggest.map((v) => String(v)),
        )
        continue
      }
      const seen = new Set<string>()
      const out: string[] = []
      for (const row of bodyData) {
        const raw = getCellValue(row, col)
        if (raw == null) continue
        const s = String(raw)
        if (s === '') continue
        if (!seen.has(s)) {
          seen.add(s)
          out.push(s)
        }
      }
      out.sort()
      byKey.set(col.key, out.slice(0, 50))
    }
    return byKey
  }, [bodyData, leafColumns])

  // Batch M: row grouping (vxe group-config parity) — a render-time
  // composition over `bodyData` (after sort + filter), groups in
  // first-appearance order. TREE MODE is never grouped: group headers would
  // fight the tree's depth/expansion semantics (fail-closed, documented). In
  // proxy mode grouping applies per loaded page. Only the FIRST `groupBy`
  // column drives the plan. Each row entry keeps its ORIGINAL bodyData index
  // so seq/striped/span/checkMethod semantics are untouched. A per-group
  // summary entry is appended when any leaf column has a `summary` op (same
  // aggregate ops as the footer, computed over the group's rows).
  type BodyPlanEntry =
    | { kind: 'group-header'; groupKey: string; count: number; depth?: number; value?: string }
    | { kind: 'row'; row: Row; rowIndex: number }
    | { kind: 'group-summary'; groupKey: string; rows: Row[] }
    // One virtual slot per expanded detail panel (batch AE): a `detail` entry
    // occupies a single itemHeight slot — content taller than the slot scrolls
    // INSIDE the detail cell, so the virtualized body stays uniform-height.
    | { kind: 'detail'; row: Row; rowIndex: number }
  // Batch BH (iris 独有): group-header collapse state. Uncontrolled: an
  // internal Set seeded from `defaultGroupCollapsed`. Controlled: derived from
  // the `groupCollapsed` prop with NO optimistic flip — the rendered body only
  // changes when the parent writes the prop back (mirrors the selection
  // controlled pattern). Group keys are `String(cell value)` of the `groupBy`
  // column — the same identity `data-iris-group-key` carries, so stale keys
  // are inert no-ops. `toggleGroupCollapse` fires `onGroupCollapseChange` with
  // the NEXT set in both modes (lift-ready).
  const [collapsedState, setCollapsedState] = React.useState<Set<string>>(
    () => new Set((defaultGroupCollapsed ?? []).map((key) => String(key))),
  )
  const collapsedSet = React.useMemo(
    () =>
      groupCollapsed !== undefined
        ? new Set(groupCollapsed.map((key) => String(key)))
        : collapsedState,
    [groupCollapsed, collapsedState],
  )
  const toggleGroupCollapse = (groupKey: string): void => {
    const next = new Set(collapsedSet)
    if (next.has(groupKey)) next.delete(groupKey)
    else next.add(groupKey)
    if (groupCollapsed === undefined) setCollapsedState(next)
    onGroupCollapseChange?.([...next])
  }
  // Batch BS (iris 独有): table-level multi-column grouping. Array elements
  // are leaf column keys; their ORDER defines the nesting depth. When set it
  // WINS over any column-level `groupBy: true` flag; unknown keys are dropped
  // and duplicates keep the first occurrence — an empty resolved list is
  // inert. When absent, the batch M single-column path below runs byte-
  // identical (the array's level-0 fallback, so defaultGroupCollapsed etc.
  // keep their exact key identity). Nested group keys are composite
  // (`v0::v1::…`, the same `::` delimiter as cellId) so collapse identity
  // stays unambiguous across parents; level 0 stays a bare value for
  // single-column compat. A collapsed parent hides its whole subtree.
  const groupByKeys = React.useMemo<string[] | null>(() => {
    if (!Array.isArray(groupBy) || groupBy.length === 0) return null
    const keys: string[] = []
    const seen = new Set<string>()
    for (const k of groupBy) {
      const col = leafColumns.find((c) => c.key === String(k))
      if (!col || seen.has(col.key)) continue
      seen.add(col.key)
      keys.push(col.key)
    }
    return keys.length > 0 ? keys : null
  }, [groupBy, leafColumns])
  const groupCol = leafColumns.find((c) => c.groupBy)
  const groupPlan = React.useMemo<BodyPlanEntry[] | null>(() => {
    if (treeMode) return null
    if (groupByKeys) {
      const indexOf = new Map<Row, number>()
      bodyData.forEach((r, i) => indexOf.set(r, i))
      const plan: BodyPlanEntry[] = []
      const hasSummary = leafColumns.some((c) => c.summary)
      const cols = groupByKeys
        .map((k) => leafColumns.find((c) => c.key === k))
        .filter((c): c is IrisTableColumn<Row> => Boolean(c))
      const build = (rows: Row[], level: number, prefix: string[]): void => {
        const col = cols[level]!
        const groups = groupRows(rows, (row) => String(getCellValue(row, col)))
        for (const g of groups) {
          const groupKey = level === 0 ? g.key : [...prefix, g.key].join('::')
          plan.push({
            kind: 'group-header',
            groupKey,
            count: g.rows.length,
            depth: level,
            value: g.key,
          })
          // Collapsed (batch BH): hide the group's rows AND its per-group
          // summary; the header and its FULL count stay. For a parent group
          // the skip hides the whole subtree (children never render). Skipped
          // rows keep their original bodyData indices, so seq/striped/span/
          // checkMethod are untouched.
          if (collapsedSet.has(groupKey)) continue
          if (level === cols.length - 1) {
            for (const row of g.rows)
              plan.push({ kind: 'row', row, rowIndex: indexOf.get(row) ?? 0 })
            // group-summary only on the innermost level (same aggregate ops
            // as the footer, computed over the leaf group's rows).
            if (hasSummary) plan.push({ kind: 'group-summary', groupKey, rows: g.rows })
          } else {
            build(g.rows, level + 1, [...prefix, g.key])
          }
        }
      }
      build(bodyData, 0, [])
      return plan
    }
    if (!groupCol) return null
    const groups = groupRows(bodyData, (row) => String(getCellValue(row, groupCol)))
    const indexOf = new Map<Row, number>()
    bodyData.forEach((r, i) => indexOf.set(r, i))
    const plan: BodyPlanEntry[] = []
    const hasSummary = leafColumns.some((c) => c.summary)
    for (const g of groups) {
      plan.push({ kind: 'group-header', groupKey: g.key, count: g.rows.length })
      // Collapsed (batch BH): hide the group's rows AND its per-group summary;
      // the header and its FULL count stay. Skipped rows keep their original
      // bodyData indices, so seq/striped/span/checkMethod are untouched.
      if (collapsedSet.has(g.key)) continue
      for (const row of g.rows) plan.push({ kind: 'row', row, rowIndex: indexOf.get(row) ?? 0 })
      if (hasSummary) plan.push({ kind: 'group-summary', groupKey: g.key, rows: g.rows })
    }
    return plan
  }, [groupByKeys, groupCol, bodyData, treeMode, leafColumns, collapsedSet])

  // expandAll parity (vxe expand-config.expandAll — one-shot at init): seed the
  // expansion model with every tree key that HAS children, walked from the top
  // of `sortedData` (not the flattened rows — the flat tree is DERIVED from the
  // expansion model, so flattening first is chicken/egg). Proxy data arrives
  // async, so the seed waits for the first non-empty page; the ref keeps it
  // initial-only (a later prop toggle does not re-seed).
  const expandAllSeededRef = React.useRef(false)
  React.useEffect(() => {
    if (!expandAll || !treeMode || expandAllSeededRef.current) return
    if (sortedData.length === 0) return
    const keys: string[] = []
    const collect = (rows: Row[]): void => {
      rows.forEach((row) => {
        const children = getSubRows?.(row)
        if (children && children.length > 0) {
          // Batch R: seeded keys must match flattenTree's getKey EXACTLY —
          // treeKeyMap (rowId-aware, sibling index) when present, else the
          // plain field key (keyless rows fall back to undefined, as before
          // the rowId slot existed — index keys would never match).
          keys.push(String(treeKeyMap?.get(row) ?? rowKeyOf(row)))
          collect(children)
        }
      })
    }
    collect(sortedData)
    // Burn the one-shot only when there was something to seed: a proxy page
    // without parent rows (e.g. the first page of a paged tree) must not
    // consume the seed — a later page that does contain parents still seeds.
    if (keys.length === 0) return
    expandAllSeededRef.current = true
    expansion.merge(keys)
  }, [expandAll, treeMode, sortedData, getSubRows, expansion, rowKey])

  const toggleAll = () => {
    if (selectable !== 'multi') return
    // The header select-all is the range-selection escape hatch: any
    // subsequent shift-click starts a fresh range from the next clicked row.
    checkboxAnchorRef.current = null
    rebaseToProp()
    const keys = bodyData
      .map((row, i) => (checkMethod && !checkMethod(row, i) ? null : rowKeyOf(row, i)))
      .filter((k): k is string | number => k != null)
    // Batch V (vxe has no select-all emit — additive): report the header
    // checkbox's PRE-toggle state + the current selection snapshot.
    onSelectAllChangeRef.current?.(allSelected ? true : someSelected ? 'indeterminate' : false, [
      ...displaySelection,
    ])
    selModel.toggleAll(keys)
  }

  const allKeys = bodyData.map((row, i) => rowKeyOf(row, i))
  const allSelected =
    selectable === 'multi' &&
    (selControlled
      ? allKeys.length > 0 && allKeys.every((k) => displaySelection.includes(k))
      : selModel.isAllSelected(allKeys))
  const someSelected =
    selectable === 'multi' && allKeys.some((k) => displaySelection.includes(k)) && !allSelected

  const gridTemplateColumns = React.useMemo(() => {
    const widths: string[] = []
    // Track order must match the row's cell order (rowDrag → seq → detail →
    // selection → leaf columns); batch AF: seq/rowDrag tracks were missing,
    // wrapping the last column onto a second line (react-only vs vue/solid/
    // svelte which all emit these tracks — cross-framework parity fix).
    if (rowDrag) widths.push(`${DRAG_COL_WIDTH}px`)
    if (showRowNumbers) widths.push(`${SEQ_COL_WIDTH}px`)
    if (hasDetail) widths.push(`${EXPAND_COL_WIDTH}px`)
    if (selectable !== 'none') widths.push('40px')
    for (const col of leafColumns) {
      const override = columnWidths[col.key]
      if (override != null) widths.push(`${override}px`)
      else if (typeof col.width === 'number') widths.push(`${col.width}px`)
      // Batch M: `width: 'auto'` sizes the track to its widest cell content
      // (vxe width=auto parity). Pinned offsets / column virtualization keep
      // the DEFAULT_PINNED_WIDTH (140) approximation — they need a number
      // (documented limitation).
      else if (col.width === 'auto') widths.push('minmax(max-content, max-content)')
      else if (typeof col.width === 'string') widths.push(col.width)
      else widths.push('minmax(0, 1fr)')
    }
    return widths.join(' ')
  }, [leafColumns, selectable, columnWidths, hasDetail, showRowNumbers, rowDrag])

  // Sticky offsets for pinned columns: each accumulates the resolved widths of
  // the pinned columns between it and its edge (plus the selection column on
  // the left). Requires a numeric width; falls back to a default.
  const pinnedOffsets = React.useMemo(() => {
    const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
    const widthOf = (col: IrisTableColumn<Row>): number =>
      columnWidths[col.key] ?? (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH)
    let left =
      (rowDrag ? DRAG_COL_WIDTH : 0) +
      (showRowNumbers ? SEQ_COL_WIDTH : 0) +
      (hasDetail ? EXPAND_COL_WIDTH : 0) +
      (selectable !== 'none' ? SELECTION_COL_WIDTH : 0)
    for (const col of leafColumns) {
      if (pinOf(col) === 'left') {
        map[col.key] = { side: 'left', offset: left }
        left += widthOf(col)
      }
    }
    let right = 0
    for (let i = leafColumns.length - 1; i >= 0; i -= 1) {
      const col = leafColumns[i]
      if (pinOf(col) === 'right') {
        map[col.key] = { side: 'right', offset: right }
        right += widthOf(col)
      }
    }
    return map
  }, [leafColumns, columnWidths, selectable, hasDetail, showRowNumbers, rowDrag, pinOf])

  const pinnedStyle = (key: string): React.CSSProperties | null => {
    const p = pinnedOffsets[key]
    if (!p) return null
    return {
      position: 'sticky',
      [p.side]: p.offset,
      zIndex: 1,
      background: 'var(--iris-background)',
    }
  }

  // -------- Column virtualization (opt-in) --------
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollLeft, setScrollLeft] = React.useState(0)
  const [viewportWidth, setViewportWidth] = React.useState(0)
  // Batch Q (vxe auto-resize parity): last measured root size; drives the
  // inline height when `autoResize` is on and no explicit `height` is set.
  const [autoSize, setAutoSize] = React.useState<{ width: number; height: number } | null>(null)

  // Cell-range selection (opt-in via `cellRange`). The controller lives in a
  // ref so it is never re-created; we bridge it to React via
  // useSyncExternalStore through the controller's getState/subscribe API.
  const cellRangeRef = React.useRef<CellRangeController | null>(null)
  if (cellRangeRef.current === null) {
    cellRangeRef.current = createCellRange()
  }
  const cellRangeCtrl = cellRangeRef.current
  // Subscribe React to the range store — re-renders whenever anchor/active changes.
  // `cellRangeState` drives re-renders; `isInRange` reads fresh state at render time.
  const cellRangeState = React.useSyncExternalStore(
    cellRangeCtrl.subscribe,
    cellRangeCtrl.getState,
    cellRangeCtrl.getState,
  )
  // Derive a stable isInRange function from the subscribed snapshot so that
  // TypeScript treats `cellRangeState` as consumed and every cell reads the
  // current range (computed from anchor/active in the snapshot, not a closure).
  const isInRange = React.useCallback(
    (row: number, col: number): boolean => {
      const { anchor, active } = cellRangeState
      if (!anchor || !active) return false
      const minRow = Math.min(anchor.row, active.row)
      const maxRow = Math.max(anchor.row, active.row)
      const minCol = Math.min(anchor.col, active.col)
      const maxCol = Math.max(anchor.col, active.col)
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    },
    [cellRangeState],
  )

  // Grid keyboard navigation (opt-in): roving cell focus over the data cells.
  const [focusedCell, setFocusedCell] = React.useState<{ row: number; col: number } | null>(null)
  // Batch AV: a virtual PageUp/PageDown target row is often outside the
  // rendered window, so `querySelector` no-ops until the scroll (below)
  // re-renders the window — the follow-up layout effect re-arms the focus.
  const pendingGridFocusRef = React.useRef<GridCell | null>(null)
  const GRID_NAV_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ])
  const handleGridKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!keyboardNavigation) return
    // Only navigate from a grid cell — never hijack keys inside an editing
    // cell's <input> (which carries no data-grid-row). This keeps the batch J
    // editing Tab path (commit + move to the next editable column) untouched.
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    const current = focusedCell ?? { row: 0, col: 0 }
    const navOptions = {
      rowCount: bodyData.length,
      colCount: leafColumns.length,
      pageSize: 10,
    }
    let next: GridCell | null = null
    if (e.key === 'Tab') {
      // Row-major spreadsheet Tab: next/prev cell, clamped (no wrap) — Tab
      // from the last cell stays put instead of leaving the table.
      next = nextRowMajorCell(
        current,
        e.shiftKey ? -1 : 1,
        navOptions.rowCount,
        navOptions.colCount,
      )
    } else if (e.key === 'Enter') {
      // Spreadsheet Enter: alias of ArrowDown (F2 stays the edit-start key).
      next = nextGridCell(current, 'ArrowDown', navOptions)
    } else if (GRID_NAV_KEYS.has(e.key)) {
      next = nextGridCell(current, e.key as GridNavKey, navOptions)
    }
    if (!next) return
    e.preventDefault()
    setFocusedCell(next)
    // PageUp/PageDown scroll: virtual tables scroll the `data-iris-virtual-scroll`
    // viewport ±10 × itemHeight (the root is overflow:hidden in pure-virtual
    // mode — the viewport is the body scroller; fiat F1), non-virtual tables
    // scroll the root ±10 × the measured row height. Clamped to the scrollable
    // range. The focus itself lands via `cell.focus()` below (or the layout
    // effect once the virtual window re-renders).
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      const dir = e.key === 'PageDown' ? 1 : -1
      const viewport = rootRef.current?.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      if (viewport && virtualScroll && bodyData.length > 0) {
        pendingGridFocusRef.current = next
        // Batch BN: PageUp/PageDown reads the SAME resolved row-height source
        // as the render paths (`rowHeight` wins over `virtualScroll.itemHeight`)
        // so ±10-row paging matches the rendered row pitch; the fn form uses
        // the current row's height as the step approximation (batch AV).
        const stepHeight = effectiveRowHeight ?? virtualScroll.itemHeight
        const rowStep =
          typeof stepHeight === 'number'
            ? stepHeight
            : Math.max(1, stepHeight(Math.min(current.row, bodyData.length - 1)))
        const max = viewport.scrollHeight - viewport.clientHeight
        const nextTop = viewport.scrollTop + dir * 10 * rowStep
        viewport.scrollTop = max > 0 ? Math.min(Math.max(nextTop, 0), max) : Math.max(nextTop, 0)
      } else {
        const rowEl = rootRef.current?.querySelector<HTMLElement>(
          '[data-iris-table-row]:not([data-iris-table-row="header"])',
        )
        const measuredRowHeight = rowEl?.offsetHeight ?? 0
        if (measuredRowHeight > 0 && rootRef.current)
          rootRef.current.scrollTop += dir * 10 * measuredRowHeight
      }
    }
    const cell = rootRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }

  // Batch AV virtual focus follow-up: the virtual window re-renders INSIDE the
  // IrisVirtualScroll child ~1 frame after the scroll (its own rAF → state →
  // commit), which does not re-run this Table effect. So poll on animation
  // frames until the pending cell exists, then focus it (a few frames, bounded
  // to MAX_POLL_FRAMES; the rAF is cancelled on re-navigation / unmount). A
  // stale pending (the user navigated elsewhere first) is dropped.
  const GRID_FOCUS_MAX_POLL_FRAMES = 30
  React.useLayoutEffect(() => {
    const pending = pendingGridFocusRef.current
    if (!pending) return
    if (focusedCell && (focusedCell.row !== pending.row || focusedCell.col !== pending.col)) {
      pendingGridFocusRef.current = null
      return
    }
    let raf = 0
    let frames = 0
    const tryFocus = (): void => {
      if (pendingGridFocusRef.current !== pending) return
      frames += 1
      if (frames > GRID_FOCUS_MAX_POLL_FRAMES) {
        pendingGridFocusRef.current = null
        return
      }
      const cell = rootRef.current?.querySelector<HTMLElement>(
        `[data-grid-row="${pending.row}"][data-grid-col="${pending.col}"]`,
      )
      if (!cell) {
        raf = requestAnimationFrame(tryFocus)
        return
      }
      pendingGridFocusRef.current = null
      cell.focus()
    }
    raf = requestAnimationFrame(tryFocus)
    return () => cancelAnimationFrame(raf)
  }, [focusedCell])

  // Cell-range keyboard handler: Shift+Arrow extends the range, Escape clears it.
  const CELL_RANGE_ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
  const handleCellRangeKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!cellRange) return
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    if (!e.shiftKey || !CELL_RANGE_ARROW_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    const rowAttr = target.dataset.irisCellRow
    const colAttr = target.dataset.irisCellCol
    if (rowAttr === undefined || colAttr === undefined) return
    e.preventDefault()
    const row = Number(rowAttr)
    const col = Number(colAttr)
    const anchor = cellRangeCtrl.getState().anchor
    const active = anchor ? (cellRangeCtrl.getState().active ?? { row, col }) : { row, col }
    let nextRow = active.row
    let nextCol = active.col
    if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
    else if (e.key === 'ArrowDown') nextRow = Math.min(bodyData.length - 1, nextRow + 1)
    else if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
    else nextCol = Math.min(leafColumns.length - 1, nextCol + 1)
    cellRangeCtrl.extendRange(nextRow, nextCol)
    updateRangeToolbarAnchor()
  }

  // Batch AN shortcuts (iris 独有, tableShortcuts): the edit/clear keys
  // begin editing the focused cell's column (when editable) / clear the cell
  // to '' — one batched commitRowList (undo-covered free via the undo
  // funnel). Batch BG: the keys come from `keyBindings` (keymap rebinding),
  // so `edit: 'F3'` remaps F2 wholesale. Modifiers match EXACTLY — the
  // pre-BG code only read the bare key, so legacy modifier combos
  // (Shift+Delete, Ctrl+F2, Ctrl+Shift+Backspace, …) are now inert by
  // design (documented deviation, per the BG baseline). The focused-cell
  // state is keyboardNavigation's roving focus (cells only get
  // `data-grid-row`/onFocus there); WITHOUT keyboardNavigation the shortcuts
  // are inert (documented). While an inline editor is open the editor's own
  // keys win (the gates below skip). The event TARGET must be a grid cell —
  // header/editor focus never triggers on a stale cell.
  const handleTableShortcutKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!tableShortcuts) return
    if (editTarget.editing !== null || rowEditing !== null) return
    if ((e.target as HTMLElement).dataset.gridRow === undefined) return
    const cell = focusedCell
    if (!cell) return
    const row = bodyData[cell.row]
    const col = leafColumns[cell.col]
    if (!row || !col) return
    const k = rowKeyOf(row, cell.row)
    if (matchTableKey(e, keyBindings.edit)) {
      if (!col.editable || col.formula || isCellLocked(row, col) || isCellReadonly(row, col)) return
      e.preventDefault()
      beginEdit(row, col, k, cell.row)
      return
    }
    if (matchTableKey(e, keyBindings.clear)) {
      e.preventDefault()
      if (isCellLocked(row, col) || isCellReadonly(row, col)) return
      const current = externalDataRef.current ?? []
      const next = setCellValue(current, rowKey, k, col.key, '')
      if (next !== current) commitRowList(next)
    }
  }

  // ── Clipboard batch O (clipConfig): Ctrl/Cmd+C copies the selected range as
  // TSV; Ctrl/Cmd+V pastes TSV text into the range anchor onward (overflow
  // beyond the last row/col ignored). Window capture so the shortcuts work
  // from any focus inside the table; both require `cellRange` to have a live
  // range — additive, no range means no-op.
  const liveBodyRef = React.useRef(bodyData)
  liveBodyRef.current = bodyData
  const liveLeafRef = React.useRef(leafColumns)
  liveLeafRef.current = leafColumns

  // Batch CE copy feedback (iris 独有 — vxe has no copy flash): after a
  // SUCCESSFUL range copy (Ctrl/Cmd+C or the range toolbar 复制) the copied
  // cells highlight briefly. `copyFlashRange` snapshots the NORMALIZED rect
  // at copy time — the highlight does NOT chase a changed selection. The
  // 600ms timer clears it; re-copy restarts the clock; unmount cleanup below.
  const [copyFlashRange, setCopyFlashRange] = React.useState<CellRange | null>(null)
  const copyFlashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashCopyFeedback = React.useCallback((range: CellRange): void => {
    setCopyFlashRange(range)
    if (copyFlashTimerRef.current !== null) clearTimeout(copyFlashTimerRef.current)
    copyFlashTimerRef.current = setTimeout(() => {
      copyFlashTimerRef.current = null
      setCopyFlashRange(null)
    }, COPY_FLASH_MS)
  }, [])
  React.useEffect(() => {
    return () => {
      if (copyFlashTimerRef.current !== null) {
        clearTimeout(copyFlashTimerRef.current)
        copyFlashTimerRef.current = null
      }
    }
  }, [])

  // Batch BP (iris 独有): the copy OUTPUT format dispatcher — one throat for
  // BOTH consumption points (Ctrl/Cmd+C and the range toolbar 复制). Three
  // serializers, zero new ones: `'tsv'` → `tsvCell`, `'csv'` → `csvRangeCell`
  // (RFC-4180, headerless range fiat — same serializer as the 导出 CSV
  // download), `'html'` → core `toHtml` over the range's column subset
  // (`leafColumns.slice(start.col, end.col + 1)`) with synthesized rows keyed
  // by the SAME effective read key toHtml uses (string `dataIndex` else
  // `key` — the exportCsv shadow-row convention verbatim). The column mask
  // applies identically across all three formats (batch-AY invariant); a
  // number masked into a string loses toHtml's numeric right-alignment
  // (fiat). Unset / invalid format fail-closed to the batch-O TSV
  // (byte-identical, existing copy tests stay green).
  const buildRangeCopy = React.useCallback(
    (range: CellRange, format: 'tsv' | 'csv' | 'html'): string => {
      const body = liveBodyRef.current
      const cols = liveLeafRef.current
      if (format === 'html') {
        const rangeCols = cols.slice(range.start.col, range.end.col + 1)
        const exportCols = rangeCols.map((col) => ({
          key: col.key,
          title: col.title,
          dataIndex: typeof col.dataIndex === 'string' ? col.dataIndex : undefined,
        }))
        const rows: Record<string, unknown>[] = []
        for (let r = range.start.row; r <= range.end.row; r += 1) {
          const row = body[r]
          const out: Record<string, unknown> = {}
          for (let c = range.start.col; c <= range.end.col; c += 1) {
            const col = cols[c]
            if (!row || !col) continue
            // Batch AY: the copy HTML applies the column mask unless
            // `exportRaw` opts out — all three copy formats agree.
            const value = getCellValue(row, col)
            // The row is keyed by the SAME effective read key toHtml uses
            // (string `dataIndex` else `key` — exportCsv shadow-row
            // convention verbatim; a numeric dataIndex falls back to `key`).
            out[typeof col.dataIndex === 'string' ? col.dataIndex : col.key] = col.exportRaw
              ? value
              : applyCellMask(value, col)
          }
          rows.push(out)
        }
        return toHtml(rows, exportCols)
      }
      const lines: string[] = []
      for (let r = range.start.row; r <= range.end.row; r += 1) {
        const row = body[r]
        const cells: string[] = []
        for (let c = range.start.col; c <= range.end.col; c += 1) {
          const col = cols[c]
          if (!row || !col) {
            cells.push('')
            continue
          }
          // Batch AY: the copy TSV/CSV applies the column mask unless
          // `exportRaw` opts out — clipboard and CSV export agree.
          const value = getCellValue(row, col)
          const masked = col.exportRaw ? value : applyCellMask(value, col)
          cells.push(format === 'csv' ? csvRangeCell(masked) : tsvCell(masked))
        }
        lines.push(cells.join(format === 'csv' ? ',' : '\t'))
      }
      return lines.join('\n')
    },
    [],
  )

  const pasteIntoRange = React.useCallback(
    async (range: CellRange): Promise<void> => {
      if (!rowKey) return
      const text = await readClipboardText()
      if (text == null) return
      const body = liveBodyRef.current
      const cols = liveLeafRef.current
      if (body.length === 0 || cols.length === 0) return
      const lines = text.split(/\r?\n/)
      const byKey = new Map<string | number, Record<string, string>>()
      // Batch AK (iris 独有): a multi-cell selection fills EXACTLY its
      // rectangle from the top-left — clipboard smaller → top-left fill, the
      // rest of the rectangle unchanged; larger → clipped to the rectangle
      // AND the table bounds (out-of-table rows/cols ignored). A single-cell
      // selection keeps the batch-O streaming behavior (anchor onward), so
      // existing paste tests stay green. Either way ONE batched commitRowList
      // and values stay strings.
      const multiCell = range.end.row > range.start.row || range.end.col > range.start.col
      if (multiCell) {
        const lastRow = Math.min(range.end.row, body.length - 1)
        const lastCol = Math.min(range.end.col, cols.length - 1)
        for (let r = range.start.row; r <= lastRow; r += 1) {
          const row = body[r]!
          const k = rowKeyOf(row)
          if (k == null) continue
          const cells = lines[r - range.start.row]
          if (!cells) continue
          const values = cells.split('\t')
          let patch: Record<string, string> | undefined
          for (let c = range.start.col; c <= lastCol; c += 1) {
            const value = values[c - range.start.col]
            if (value === undefined) continue
            const col = cols[c]!
            // Batch BE: locked cells are read-only — the paste skips them
            // (the rest of the rectangle still lands, one batched commit).
            if (isCellLocked(row, col) || isCellReadonly(row, col)) continue
            patch = { ...patch, [col.key]: value }
          }
          if (patch) byKey.set(k, { ...byKey.get(k), ...patch })
        }
      } else {
        // Line i / cell j of the clipboard lands at (anchor.row + i, anchor.col + j);
        // cells beyond the last row/col are ignored.
        for (let i = 0; i < lines.length; i += 1) {
          const rowIdx = range.start.row + i
          if (rowIdx >= body.length) break
          const row = body[rowIdx]!
          const cells = lines[i]!.split('\t')
          for (let j = 0; j < cells.length; j += 1) {
            const colIdx = range.start.col + j
            if (colIdx >= cols.length) break
            const k = rowKeyOf(row)
            if (k == null) continue
            const col = cols[colIdx]!
            // Batch BE: locked cells stay read-only under a single-cell paste.
            if (isCellLocked(row, col) || isCellReadonly(row, col)) continue
            const prev = byKey.get(k)
            byKey.set(k, { ...prev, [col.key]: cells[j]! })
          }
        }
      }
      if (byKey.size === 0) return
      const keyField = rowKey
      const next = (externalDataRef.current ?? []).map((r) => {
        const k = (r as Record<string, unknown>)[keyField]
        const patch = k != null ? byKey.get(k as string | number) : undefined
        return patch ? { ...r, ...patch } : r
      })
      commitRowList(next, 'paste')
    },
    [rowKey, commitRowList],
  )

  // ── Batch BG keymap (iris 独有): the EFFECTIVE shortcut bindings = the
  // built-in defaults + the `keymap` prop overrides (per-action wholesale,
  // invalid specs fail-closed to the default). Shared by the edit/clear,
  // undo/redo, copy/paste, fill and query handlers below. `queryInputRef`
  // receives the toolbar query input so Ctrl+K can focus it. Memoized on the
  // JSON serialization so an inline `keymap={{…}}` literal (a fresh object
  // identity per render) does not churn `keyBindings` and re-register the
  // window undo/clip listeners below every render.
  const keymapJson = React.useMemo(() => JSON.stringify(keymap ?? null), [keymap])
  const keyBindings = React.useMemo(
    () =>
      normalizeKeymap(
        keymapJson === 'null' ? undefined : (JSON.parse(keymapJson) as IrisTableKeymap),
      ),
    [keymapJson],
  )
  const queryInputRef = React.useRef<HTMLInputElement | null>(null)

  // ── Built-in undo/redo keyboard (iris 独有, batch AL) ────────────────
  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) redoes — a window
  // listener gated on `undo`, accepting only targets inside the table and
  // skipping text controls / select editors / an active inline edit session,
  // mirroring the clipConfig guard. Not while editing: the editor's own
  // Ctrl+Z semantics win inside an open session. Batch BG: the bindings come
  // from `keyBindings` and modifiers match exactly (Alt+Ctrl+Z is inert).
  React.useEffect(() => {
    if (!undo) return
    const onKey = (e: KeyboardEvent): void => {
      // Batch BG first-handler-wins: an earlier (root) handler that claimed
      // the key already preventDefault'd it.
      if (e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target && !rootRef.current?.contains(target)) return
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.dataset.irisTableEditor !== undefined)
      )
        return
      if (editingTarget !== null || rowEditing !== null) return
      if (matchTableKey(e, keyBindings.undo)) {
        e.preventDefault()
        const prev = undoStack.undo()
        if (prev !== undefined) {
          bumpUndoTick()
          applyUndoSnapshot(prev, 'undo')
        }
      } else if (matchTableKey(e, keyBindings.redo)) {
        e.preventDefault()
        const next = undoStack.redo()
        if (next !== undefined) {
          bumpUndoTick()
          applyUndoSnapshot(next, 'redo')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, editingTarget, rowEditing, undoStack, applyUndoSnapshot, bumpUndoTick, keyBindings])

  React.useEffect(() => {
    if (!clipConfig) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      // Never hijack keys outside the table or on text inputs (editors, the
      // fnr bar, external fields) or select editors.
      const target = e.target as HTMLElement | null
      if (target && !rootRef.current?.contains(target)) return
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.dataset.irisTableEditor !== undefined)
      )
        return
      const range = cellRangeCtrl.getRange()
      if (!range) return
      if (matchTableKey(e, keyBindings.copy)) {
        if (clipConfig.copy === false) return
        e.preventDefault()
        // Batch CE: the flash gates on actual copy SUCCESS (any of the three
        // writer channels) — spec “复制成功后”.
        void writeClipboardText(buildRangeCopy(range, clipConfig?.copyFormat ?? 'tsv')).then(
          (ok) => {
            if (ok) flashCopyFeedback(range)
          },
        )
      } else if (matchTableKey(e, keyBindings.paste)) {
        if (clipConfig.paste === false) return
        e.preventDefault()
        void pasteIntoRange(range)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clipConfig, cellRangeCtrl, buildRangeCopy, pasteIntoRange, keyBindings, flashCopyFeedback])

  // ── Range floating toolbar (batch AH, iris 独有) ───────────────────────
  // Visibility derives from the range store: `cellRange` + a live selection
  // (≥1 cell) → the bar floats ABOVE the first selected cell (virtual anchor
  // = that cell's LIVE rect, placement top, flip/shift on, portal). It
  // repositions on scroll via autoUpdate instead of closing (deliberate
  // divergence from the right-click menu) and hides when the range clears
  // (Escape / outside click run useDismiss → clearRange). Actions: 复制
  // reuses the clipConfig copy builder (batch BP format-aware) for the
  // CURRENT range; 导出 CSV
  // downloads a headerless CSV of the range rectangle (core `downloadCsv`);
  // 清除 zeroes the range cells through one batched commitRowList.
  const rangeToolbarAnchorRef = React.useRef<HTMLElement | null>(null)
  // Remount token: useFloating's autoUpdate does not re-run while `open`
  // stays true, so every range change remounts the bar at the fresh anchor
  // (same pattern as contextMenuSeq / filterPanelSeq).
  const [rangeToolbarSeq, setRangeToolbarSeq] = React.useState(0)
  const activeRange = React.useMemo(() => {
    if (!cellRange) return null
    const { anchor, active } = cellRangeState
    if (!anchor || !active) return null
    return {
      start: {
        row: Math.min(anchor.row, active.row),
        col: Math.min(anchor.col, active.col),
      },
      end: {
        row: Math.max(anchor.row, active.row),
        col: Math.max(anchor.col, active.col),
      },
    }
  }, [cellRange, cellRangeState])
  const updateRangeToolbarAnchor = React.useCallback((): void => {
    const range = cellRangeCtrl.getRange()
    if (!range) {
      rangeToolbarAnchorRef.current = null
      return
    }
    const { row, col } = range.start
    // Live-rect closure: getBoundingClientRect is re-read on every autoUpdate
    // cycle, so the bar tracks the anchor cell through scrolls/resizes.
    rangeToolbarAnchorRef.current = {
      getBoundingClientRect: () => {
        const el = rootRef.current?.querySelector<HTMLElement>(
          `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
        )
        const rect = el?.getBoundingClientRect()
        const base = rect ?? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
        return {
          left: base.left,
          top: base.top,
          right: base.right,
          bottom: base.bottom,
          width: base.width,
          height: base.height,
          x: base.left,
          y: base.top,
          toJSON() {},
        }
      },
    } as unknown as HTMLElement
    setRangeToolbarSeq((s) => s + 1)
  }, [cellRangeCtrl])

  // ── Drag fill (batch AQ, iris 独有 — vxe has no fill parity) ────────────
  // The fill handle (data-iris-range-fill) renders inside the range's
  // bottom-right cell; dragging it DOWN/RIGHT cyclically fills the target
  // rectangle and extends the range (Excel parity). Dragging UP/LEFT is
  // ignored — the rectangle only ever grows down/right from the range edge
  // (max(pointer, range.end) + table-bounds clamp), so a pointer that stays
  // inside the range (or above/left of its end) yields no target cells.
  // `fillTarget` holds the drag-end cell while dragging: it drives the
  // data-iris-range-fill-target highlight, and pointerup commits the cyclic
  // fill + range extension in one shot. Hit-testing per move goes through
  // document.elementFromPoint → closest('[data-iris-cell-row][data-iris-cell-col]')
  // (leaf cells only — seq/selection/detail cells carry no row/col attrs).
  const [fillTarget, setFillTarget] = React.useState<{ row: number; col: number } | null>(null)

  /** True when (r, c) lies between the range edge and the drag end (exclusive
   * of the source range) — the highlighted fill-target rectangle. */
  const isRangeFillTarget = React.useCallback(
    (r: number, c: number): boolean => {
      if (fillTarget === null || activeRange === null) return false
      const endRow = Math.min(Math.max(fillTarget.row, activeRange.end.row), bodyData.length - 1)
      const endCol = Math.min(Math.max(fillTarget.col, activeRange.end.col), leafColumns.length - 1)
      if (endRow === activeRange.end.row && endCol === activeRange.end.col) return false
      if (r < activeRange.start.row || r > endRow) return false
      if (c < activeRange.start.col || c > endCol) return false
      if (isInRange(r, c)) return false
      return true
    },
    [fillTarget, activeRange, bodyData.length, leafColumns.length, isInRange],
  )

  const handleRangeFillPointerDown = (e: React.PointerEvent, row: number, col: number): void => {
    if (e.button !== 0) return
    // preventDefault stops the compatibility click → the cell's onClick
    // (startRange/extendRange) never fires from a handle press.
    e.preventDefault()
    e.stopPropagation()
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* jsdom has no real pointer capture */
    }
    setFillTarget({ row, col })
  }

  const handleRangeFillPointerMove = (e: React.PointerEvent): void => {
    if (fillTarget === null) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cellEl = el?.closest('[data-iris-cell-row][data-iris-cell-col]') as HTMLElement | null
    if (!cellEl) return // outside the body → keep the last resolved drag end
    const r = Number(cellEl.dataset.irisCellRow)
    const c = Number(cellEl.dataset.irisCellCol)
    if (Number.isNaN(r) || Number.isNaN(c)) return
    setFillTarget((prev) => (prev && prev.row === r && prev.col === c ? prev : { row: r, col: c }))
  }

  const handleRangeFillPointerUp = (): void => {
    // Batch AQ fix: the drag is over, so the next Escape / outside press must
    // dismiss the range again (the window-capture pointerdown only re-syncs
    // the flag on the NEXT handle press, which would otherwise stay stale).
    suppressRangeDismissRef.current = false
    if (fillTarget === null) return
    const { row, col } = fillTarget
    setFillTarget(null)
    fillRangeFromHandle(row, col)
  }

  /** Cyclic fill of the down/right-grown rectangle + range extension, all in
   * ONE commitRowList (undo-covered via the batch AL funnel). No target cells
   * (no growth, no rowKey, empty table) → no-op. */
  const fillRangeFromHandle = React.useCallback(
    (targetRow: number, targetCol: number): void => {
      const range = cellRangeCtrl.getRange()
      if (!range || !rowKey) return
      const body = liveBodyRef.current
      const cols = liveLeafRef.current
      if (body.length === 0 || cols.length === 0) return
      // Down/right-only: the drag end clamps to never shrink the source range.
      const endRow = Math.min(Math.max(targetRow, range.end.row), body.length - 1)
      const endCol = Math.min(Math.max(targetCol, range.end.col), cols.length - 1)
      if (endRow === range.end.row && endCol === range.end.col) return
      const rangeRows = range.end.row - range.start.row + 1
      const rangeCols = range.end.col - range.start.col + 1
      const byKey = new Map<string | number, Record<string, unknown>>()
      for (let r = range.start.row; r <= endRow; r += 1) {
        const row = body[r]
        if (!row) continue
        const k = rowKeyOf(row)
        if (k == null) continue
        for (let c = range.start.col; c <= endCol; c += 1) {
          // Source-range cells keep their values (nothing to fill there) and
          // formula columns are display-only everywhere (skip, like paste).
          if (
            r >= range.start.row &&
            r <= range.end.row &&
            c >= range.start.col &&
            c <= range.end.col
          )
            continue
          const col = cols[c]
          if (!col || col.formula || isCellLocked(row, col) || isCellReadonly(row, col)) continue
          const srcRow = body[((r - range.start.row) % rangeRows) + range.start.row]
          const srcCol = cols[((c - range.start.col) % rangeCols) + range.start.col]
          if (!srcRow || !srcCol) continue
          const value = getCellValue(srcRow, srcCol)
          byKey.set(k, { ...byKey.get(k), [col.key]: value })
        }
      }
      if (byKey.size === 0) return
      const keyField = rowKey
      const next = (externalDataRef.current ?? []).map((r) => {
        const k = (r as Record<string, unknown>)[keyField]
        const patch = k != null ? byKey.get(k as string | number) : undefined
        return patch ? { ...r, ...patch } : r
      })
      commitRowList(next, 'fill')
      // Excel parity: the selection grows to the drag end so the filled cells
      // become part of the range.
      cellRangeCtrl.extendRange(endRow, endCol)
      updateRangeToolbarAnchor()
    },
    [cellRangeCtrl, rowKey, commitRowList, updateRangeToolbarAnchor],
  )

  const copyActiveRange = React.useCallback((): void => {
    const range = cellRangeCtrl.getRange()
    if (!range) return
    // Batch CE: same success-gated flash as Ctrl/Cmd+C — the range toolbar
    // 复制 button is the second consumption point.
    void writeClipboardText(buildRangeCopy(range, clipConfig?.copyFormat ?? 'tsv')).then((ok) => {
      if (ok) flashCopyFeedback(range)
    })
  }, [cellRangeCtrl, buildRangeCopy, clipConfig, flashCopyFeedback])

  const exportActiveRangeCsv = React.useCallback((): string => {
    const range = cellRangeCtrl.getRange()
    if (!range) return ''
    const body = liveBodyRef.current
    const cols = liveLeafRef.current
    const rangeCols = cols.slice(range.start.col, range.end.col + 1)
    const lines: string[] = []
    for (let r = range.start.row; r <= range.end.row; r += 1) {
      const row = body[r]
      lines.push(
        rangeCols
          .map((col) => {
            // Batch AY: the range CSV export applies the column mask unless
            // `exportRaw` opts out — same rule as the copy TSV on this
            // toolbar, so clipboard and downloaded CSV always agree.
            const value = row ? getCellValue(row, col) : null
            return csvRangeCell(col.exportRaw ? value : applyCellMask(value, col))
          })
          .join(','),
      )
    }
    return lines.join('\n')
  }, [cellRangeCtrl])

  const clearActiveRange = React.useCallback((): void => {
    const range = cellRangeCtrl.getRange()
    if (!range || !rowKey) return
    const body = liveBodyRef.current
    const cols = liveLeafRef.current
    // Same byKey patch shape as the clipboard paste path: every cell of the
    // rectangle becomes '' — ONE batched commitRowList.
    const byKey = new Map<string | number, Record<string, string>>()
    for (let r = range.start.row; r <= range.end.row; r += 1) {
      const row = body[r]
      if (!row) continue
      const k = rowKeyOf(row)
      if (k == null) continue
      const patches: Record<string, string> = {}
      for (let c = range.start.col; c <= range.end.col; c += 1) {
        const col = cols[c]
        // Batch BE: locked cells survive a range clear.
        if (col && !isCellLocked(row, col) && !isCellReadonly(row, col)) patches[col.key] = ''
      }
      // Batch BE: an all-locked row produces an empty patch — skip it so an
      // all-locked range commits nothing (zero spurious onDataChange/undo/
      // audit entries, same zero-commit guard as paste/fill/batch edit).
      if (Object.keys(patches).length > 0) byKey.set(k, { ...byKey.get(k), ...patches })
    }
    if (byKey.size === 0) return
    const keyField = rowKey
    const next = (externalDataRef.current ?? []).map((r) => {
      const k = (r as Record<string, unknown>)[keyField]
      const patch = k != null ? byKey.get(k as string | number) : undefined
      return patch ? { ...r, ...patch } : r
    })
    commitRowList(next)
  }, [cellRangeCtrl, rowKey, commitRowList])

  // ── Range stats (batch AJ, iris 独有) ──────────────────────────────
  // Panel-open state is hoisted HERE because the bar remounts on every range
  // change (key={rangeToolbarSeq}): hoisted state survives the remount, so
  // the panel stays open while its stats recompute for the new range. Stats
  // come from the core `rangeStats` material over the range rectangle of the
  // DISPLAYED rows (`bodyData` — already query/filtered) and the leaf column
  // list (its index IS the grid column index, the same mapping cell rendering
  // uses). The column key indirection mirrors `getCellValue` (`dataIndex ??
  // key`) so core stays pure over { key }; entries render in range column
  // order with the column title for display.
  const [rangeStatsOpen, setRangeStatsOpen] = React.useState(false)
  // The per-column stats memo itself lives AFTER `visibleColSet` (below): it
  // reads the same visible-window skip the cell render uses.
  // Dismissal (Escape / outside pointer-down) also closes the panel — the
  // panel rides the bar's existing useDismiss, and the hoisted open state is
  // reset here so a later range never reopens it unprompted.
  const dismissRange = React.useCallback((): void => {
    // Batch AQ: a fill-handle press must never dismiss the bar — its
    // outside-press would clear the range mid-drag. The window capture-phase
    // listener below flags handle presses BEFORE the document listener runs.
    if (suppressRangeDismissRef.current) return
    cellRangeCtrl.clearRange()
    setRangeStatsOpen(false)
  }, [cellRangeCtrl])
  // Batch AQ: the floating range toolbar's useDismiss listens for outside
  // pointer-down on DOCUMENT (capture phase) and clears the range. The fill
  // handle sits outside the bar, so a handle press would clear the range
  // before the drag starts. A window-capture listener (which runs BEFORE the
  // document capture listener) flags handle presses so dismissRange skips
  // them; every pointerdown re-syncs the flag, so it is self-cleaning.
  const suppressRangeDismissRef = React.useRef(false)
  React.useEffect(() => {
    if (!rangeFill) return
    const onWindowPointerDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      suppressRangeDismissRef.current = !!target?.closest('[data-iris-range-fill]')
    }
    window.addEventListener('pointerdown', onWindowPointerDown, true)
    return () => window.removeEventListener('pointerdown', onWindowPointerDown, true)
  }, [rangeFill])

  // ── Find & replace (batch O: fnr) — Ctrl/Cmd+F opens the bar (when not
  // editing); matches highlight over bodyData in flat mode (case-insensitive
  // substring of each cell text); Enter/Shift+Enter step; replace/replace-all
  // write back through commitRowList; highlights clear when the bar closes or
  // the query empties. ──
  const [fnrOpen, setFnrOpen] = React.useState(false)
  const [fnrQuery, setFnrQuery] = React.useState('')
  const [fnrReplace, setFnrReplace] = React.useState('')
  const [fnrActive, setFnrActive] = React.useState(0)
  const fnrFindRef = React.useRef<HTMLInputElement | null>(null)

  const fnrMatches = React.useMemo(() => {
    if (!fnr || !fnrOpen || fnrQuery === '') return [] as Array<{ row: number; col: number }>
    const q = fnrQuery.toLowerCase()
    const out: Array<{ row: number; col: number }> = []
    bodyData.forEach((row, r) => {
      leafColumns.forEach((col, c) => {
        const v = getCellValue(row, col)
        if (v != null && String(v).toLowerCase().includes(q)) out.push({ row: r, col: c })
      })
    })
    return out
  }, [fnr, fnrOpen, fnrQuery, bodyData, leafColumns])

  const fnrActiveIndex = Math.min(fnrActive, Math.max(fnrMatches.length - 1, 0))
  const fnrActiveMatch = fnrMatches.length > 0 ? fnrMatches[fnrActiveIndex]! : null
  const fnrActiveKey = fnrActiveMatch ? `${fnrActiveMatch.row}:${fnrActiveMatch.col}` : null
  const fnrMatchSet = React.useMemo(
    () => new Set(fnrMatches.map((m) => `${m.row}:${m.col}`)),
    [fnrMatches],
  )
  const fnrHighlighting = fnrOpen && fnrQuery !== '' && fnrMatches.length > 0

  // Opening the bar / editing the query resets the active match to the first.
  React.useEffect(() => {
    setFnrActive(0)
  }, [fnrOpen, fnrQuery])

  // Keep the find input focused while the bar is open.
  React.useEffect(() => {
    if (fnr && fnrOpen) fnrFindRef.current?.focus()
  }, [fnr, fnrOpen])

  // Keep the ACTIVE match in view (guarded for jsdom, which lacks scrollIntoView).
  React.useEffect(() => {
    if (!fnrOpen || !fnrActiveKey) return
    const el = rootRef.current?.querySelector<HTMLElement>('[data-iris-fnr-active="true"]')
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [fnrOpen, fnrActiveKey])

  // Ctrl/Cmd+F opens the bar; Escape closes it. Both work from any focus
  // inside the table (window capture); editors keep their own shortcuts.
  React.useEffect(() => {
    if (!fnr) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setFnrOpen(false)
        return
      }
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.dataset.irisTableEditor !== undefined || target.closest('[data-iris-fnr-bar]'))
      )
        return
      e.preventDefault()
      setFnrOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fnr])

  // Step the active match by ±1 (wraps). Empty match list is a no-op.
  const stepFnrMatch = (delta: number): void => {
    if (fnrMatches.length === 0) return
    setFnrActive((a) => (a + delta + fnrMatches.length) % fnrMatches.length)
  }

  // Replace the ACTIVE match (every occurrence in that cell, case-insensitive)
  // — one commitRowList per replaced cell.
  const replaceFnrActive = (): void => {
    const m = fnrActiveMatch
    if (!m) return
    const rows = externalDataRef.current ?? []
    if (!rowKey || rows.length === 0) return
    const col = liveLeafRef.current[m.col]
    const row = liveBodyRef.current[m.row]
    if (!col || !row) return
    // Batch BE: locked cells are read-only — FNR replace skips them (FNR
    // FIND still matches them; locking guards writes only).
    if (isCellLocked(row, col) || isCellReadonly(row, col)) return
    const current = getCellValue(row, col)
    const text = current == null ? '' : String(current)
    const nextText = replaceAllOccurrences(text, fnrQuery, fnrReplace)
    if (nextText === text) return
    const k = rowKeyOf(row)
    if (k == null) return
    commitRowList(rows.map((r) => (rowKeyOf(r) === k ? { ...r, [col.key]: nextText } : r)))
  }

  // Replace EVERY match — one batched commitRowList (all cells in one pass).
  const replaceAllFnrMatches = (): void => {
    const rows = externalDataRef.current ?? []
    if (!rowKey || rows.length === 0 || fnrMatches.length === 0) return
    const body = liveBodyRef.current
    const cols = liveLeafRef.current
    const byKey = new Map<string | number, Record<string, string>>()
    for (const m of fnrMatches) {
      const row = body[m.row]
      const col = cols[m.col]
      if (!row || !col) continue
      // Batch BE: locked matches stay put under replace-all.
      if (isCellLocked(row, col) || isCellReadonly(row, col)) continue
      const current = getCellValue(row, col)
      const text = current == null ? '' : String(current)
      const nextText = replaceAllOccurrences(text, fnrQuery, fnrReplace)
      if (nextText === text) continue
      const k = rowKeyOf(row)
      if (k == null) continue
      const prev = byKey.get(k)
      byKey.set(k, { ...prev, [col.key]: nextText })
    }
    if (byKey.size === 0) return
    const keyField = rowKey
    commitRowList(
      rows.map((r) => {
        const k = (r as Record<string, unknown>)[keyField]
        const patch = k != null ? byKey.get(k as string | number) : undefined
        return patch ? { ...r, ...patch } : r
      }),
    )
  }

  const resolvedColWidths = React.useMemo(
    () =>
      leafColumns.map(
        (col) =>
          columnWidths[col.key] ??
          (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH),
      ),
    [leafColumns, columnWidths],
  )

  React.useEffect(() => {
    if (!columnVirtualization) return
    const el = rootRef.current
    if (!el) return
    const measure = () => setViewportWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [columnVirtualization])

  // Batch V (vxe scroll parity): without column virtualization the JSX
  // onScroll handler above doesn't exist — attach a native listener instead
  // (only meaningful with `height`/fixedHeight, else overflow stays hidden
  // and no scroll events arrive). Presence-gated so an onScroll that arrives
  // later still attaches; the latest closure is read via the ref.
  const hasOnScroll = onScroll !== undefined
  React.useEffect(() => {
    if (columnVirtualization || !hasOnScroll) return
    const root = rootRef.current
    if (!root) return
    const handler = () => {
      onScrollRef.current?.({ scrollTop: root.scrollTop, scrollLeft: root.scrollLeft })
    }
    root.addEventListener('scroll', handler)
    return () => root.removeEventListener('scroll', handler)
  }, [columnVirtualization, hasOnScroll])

  // Root measure (batch R): the single size read shared by autoResize's
  // ResizeObserver and syncResize's data-change effect — syncResize literally
  // re-runs the same measure autoResize would.
  const measureRoot = React.useCallback(() => {
    const el = rootRef.current
    if (!el) return
    setAutoSize({ width: el.clientWidth, height: el.clientHeight })
  }, [])

  // Auto-resize (batch Q, vxe-grid auto-resize parity): measure the root via
  // ResizeObserver into `autoSize`. The measure never pins the root height —
  // with no explicit `height` the root renders `height: 100%` (see the root
  // render) so it fills AND tracks its parent instead of freezing at one
  // measured px (the RO observes the root; a pinned root could never change
  // size again, so later container growth would be missed). The measure only
  // gates `fixedHeight`: once a positive size lands, the batch-N scroll
  // machinery (sticky header, overflow) engages. When `height` IS set the
  // explicit height wins (no visible change). jsdom/SSR have no
  // ResizeObserver → no-op.
  React.useEffect(() => {
    if (!autoResize) return
    const el = rootRef.current
    if (!el) return
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measureRoot())
    ro.observe(el)
    return () => ro.disconnect()
  }, [autoResize, measureRoot])

  // Sync-resize (batch R, vxe-grid syncResize parity): with `autoResize` off
  // and NO explicit `height`, re-run the same root measure whenever
  // content-affecting inputs change (data / loading / error / footerData /
  // size / bordered) and when the document becomes visible again — so the
  // fixed-height machinery tracks content-driven size changes without a
  // ResizeObserver. Application rules mirror `autoResize`: with `height` set
  // the explicit height wins and the effect does nothing.
  React.useEffect(() => {
    if (!syncResize || autoResize || height !== undefined) return
    measureRoot()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') measureRoot()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [
    data,
    loading,
    error,
    footerData,
    size,
    bordered,
    syncResize,
    autoResize,
    height,
    measureRoot,
  ])

  // Set of column indices to render: the visible window + overscan, always
  // unioned with pinned columns. `null` ⇒ render every column (feature off).
  const visibleColSet = React.useMemo(() => {
    if (!columnVirtualization) return null
    const w = computeVirtualRange({
      itemCount: leafColumns.length,
      scrollTop: scrollLeft,
      viewportSize: viewportWidth,
      itemSize: (i) => resolvedColWidths[i] ?? DEFAULT_PINNED_WIDTH,
      buffer: 2,
    })
    const set = new Set<number>()
    for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
    leafColumns.forEach((col, i) => {
      if (pinOf(col)) set.add(i)
    })
    return set
  }, [columnVirtualization, leafColumns, scrollLeft, viewportWidth, resolvedColWidths, pinOf])

  // ── Range stats material (batch AJ, iris 独有) ─────────────────────
  // Lives AFTER `visibleColSet` so it can apply the same visible-window skip
  // the cell render uses. Stats come from the core `rangeStats` material over
  // the range rectangle of the DISPLAYED rows (`bodyData` — already
  // query/filtered) and the leaf column list (its index IS the grid column
  // index). The column key indirection mirrors `getCellValue` (`dataIndex ??
  // key`) so core stays pure over { key }; entries render in range column
  // order with the column title for display.
  const rangeStatsData = React.useMemo<RangeStatsEntry[] | null>(() => {
    if (!activeRange) return null
    const cols = leafColumns.slice(activeRange.start.col, activeRange.end.col + 1)
    if (cols.length === 0) return null
    const stats = rangeStats(
      bodyData,
      leafColumns.map((col) => ({
        key: (col.dataIndex ?? col.key) as string,
        getValue: (row: Row) => getCellValue(row, col),
      })),
      activeRange,
    )
    // Batch AJ review: guard `stats[key]` presence — core returns `{}` when
    // the row span is fully out of bounds after `bodyData` shrinks (e.g. an
    // NL query emptying the view), and the panel must never dereference
    // undefined. When nothing remains the panel hides while `statsOpen` stays
    // true, so it reappears if the range becomes valid again. Also skip
    // columns outside the virtual window (`visibleColSet`), matching the cell
    // render — hidden/scrolled-out columns never appear as stats rows.
    const entries: RangeStatsEntry[] = []
    for (let i = 0; i < cols.length; i += 1) {
      if (visibleColSet && !visibleColSet.has(activeRange.start.col + i)) continue
      const col = cols[i]!
      const key = (col.dataIndex ?? col.key) as string
      const s = stats[key]
      if (s) entries.push({ key, title: col.title ?? key, stats: s })
    }
    return entries.length > 0 ? entries : null
  }, [activeRange, bodyData, leafColumns, visibleColSet])

  // 1-based grid track for a column (after the optional drag/seq/detail/
  // selection tracks), so a rendered cell lands in the right place even when
  // earlier cells are skipped. Order matches the row's cell order.
  const colTrack = (i: number): number =>
    (rowDrag ? 1 : 0) +
    (showRowNumbers ? 1 : 0) +
    (hasDetail ? 1 : 0) +
    (selectable !== 'none' ? 1 : 0) +
    1 +
    i

  // Header merge (batch P, vxe mergeHeaderCells parity): entries keyed by
  // leaf-column index, row 0 only (the flat header is a single row — rows > 0
  // are ignored; grouped headers are not merged). `occupied` holds the covered
  // "row:col" keys; `byCol` maps a merge origin cell to its span. Pure memo,
  // so no render-order clear is needed (unlike the body's spanOccupyRef).
  const headerMergePlan = React.useMemo(() => {
    const byCol = new Map<number, { rowspan?: number; colspan?: number }>()
    const occupied = new Set<string>()
    for (const m of mergeHeaderCells ?? []) {
      if (m.row !== 0) continue
      byCol.set(m.col, { rowspan: m.rowspan, colspan: m.colspan })
      const colspan = m.colspan ?? 1
      const rowspan = m.rowspan ?? 1
      for (let c = 1; c < colspan; c++) occupied.add(`0:${m.col + c}`)
      for (let r = 1; r < rowspan; r++) occupied.add(`${r}:${m.col}`)
    }
    return { byCol, occupied }
  }, [mergeHeaderCells])

  const baseCellStyle: React.CSSProperties = {
    padding: 'var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)',
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  // Batch W (vxe showHeaderOverflow/showFooterOverflow parity): spread right
  // after baseCellStyle so it beats the ellipsis base (user cell styles spread
  // later still win, mirroring vxe's inline-over-class precedence).
  const cellOverflowOverride = { whiteSpace: 'normal', overflow: 'visible' } as const
  const borderStyle = bordered ? '1px solid var(--iris-border)' : 'none'

  // Cell tooltips (vxe tooltipConfig parity, title mode, batch G): a native
  // `title` on every body cell — content from the callback or the raw cell
  // value; editing cells are exempt, and empty content drops the tooltip (vxe
  // empty-content parity). Truncation gating is not implemented: titles render
  // on every cell regardless of `showAll` (documented simplification — cheap
  // and explicit).
  const cellTooltip = (row: Row, col: IrisTableColumn<Row>): string | undefined => {
    if (!tooltipConfig) return undefined
    // Batch AY: the tooltip shows the MASKED value (mask first, formatter
    // second) — same display chain as the cell body.
    const displayValue = applyCellMask(getCellValue(row, col), col)
    const content = tooltipConfig.content
      ? tooltipConfig.content(row, col)
      : col.formatter
        ? (() => {
            const formatted = col.formatter(displayValue, row)
            return typeof formatted === 'string' ? formatted : String(displayValue ?? '')
          })()
        : String(displayValue ?? '')
    return content === '' ? undefined : content
  }

  // Batch AU: the compare tooltip overrides the tooltipConfig title on
  // changed cells — the old → new diff is more actionable than the raw value
  // (documented override: compare wins; tooltipConfig still applies to
  // unchanged cells). old = live value, new = compareWith snapshot value per
  // the diff direction above.
  const compareTitle = (change: RowDiffCellChange): string =>
    t('table.compare.tooltip', {
      old: String(change.oldValue ?? ''),
      new: String(change.newValue ?? ''),
    })

  // Batch AU: the changed cell for a (rowKey, column) pair — resolved via
  // the same dataIndex ?? key indirect layer getCellValue uses (kept in its
  // own helper so the cell render arrow stays under the complexity budget,
  // same pattern as dirtyCellState).
  const cellChangeOf = (
    rowK: string | number,
    col: IrisTableColumn<Row>,
  ): RowDiffCellChange | undefined =>
    compareDiff?.cellChanges.get(rowK)?.get((col.dataIndex ?? col.key) as string)

  // Batch AU: the changed-cell attribute (''-style undefined when unchanged).
  const compareCellAttr = (change: RowDiffCellChange | undefined): string | undefined =>
    change ? 'true' : undefined

  // Batch BI: the sparkline cell title — the series ("10, 4, 8") when this
  // cell renders a sparkline (same gate as the SVG), else undefined so the
  // chain falls through to the tooltip. The series string is the same one
  // the SVG's aria-label carries.
  const sparkTitle = (row: Row, col: IrisTableColumn<Row>): string | undefined => {
    const raw = getCellValue(row, col)
    if (!sparklineCell(col, raw)) return undefined
    const series = sparklineSeries(sparklineData, row, col)
    if (!series) return undefined
    return series.map((p) => (p === null ? '' : String(p))).join(', ')
  }

  // Batch AU: the unified cell title — the annotation note wins on noted
  // cells (batch AZ), compare wins on changed cells, the sparkline series
  // wins on sparkline cells (batch BI), the tooltipConfig path applies
  // otherwise, editing cells stay exempt. Batch BM: with `notePopover` the
  // note branch becomes undefined — the floating popover replaces the native
  // title on noted cells only (all other branches untouched).
  const cellTitle = (
    editing: boolean,
    note: string | null,
    change: RowDiffCellChange | undefined,
    row: Row,
    col: IrisTableColumn<Row>,
    notePopover: boolean | undefined,
  ): string | undefined =>
    editing
      ? undefined
      : note != null
        ? notePopover
          ? undefined
          : note
        : change
          ? compareTitle(change)
          : (sparkTitle(row, col) ?? cellTooltip(row, col))

  // Header cell tooltips (vxe header-tooltip-config parity, batch P): a
  // native `title` on flat + grouped header cells; empty content drops the
  // tooltip (same pattern as the body cellTooltip).
  const headerTooltip = (col: IrisTableColumn<Row>): string | undefined => {
    if (!headerTooltipConfig) return undefined
    const content = headerTooltipConfig.content?.(col)
    return content === '' || content == null ? undefined : content
  }

  // Footer cell tooltips (vxe footer-tooltip-config parity, batch P): a
  // native `title` on summary / footer-method / footer-data cells.
  const footerTooltip = (col: IrisTableColumn<Row>): string | undefined => {
    if (!footerTooltipConfig) return undefined
    const content = footerTooltipConfig.content?.(col)
    return content === '' || content == null ? undefined : content
  }

  // Header filter trigger (vxe filterConfig parity, batch I): a small icon
  // button at the end of the title; active (--iris-primary) when the column
  // has a non-empty checked set. stopPropagation keeps it from sorting.
  const renderFilterTrigger = (col: IrisTableColumn<Row>, leaf: boolean): React.ReactNode => {
    if (!leaf || !col.filterable) return null
    const active = (filterValues?.[col.key]?.length ?? 0) > 0
    return (
      <button
        type="button"
        data-iris-filter-trigger={col.key}
        aria-label={t('table.filter')}
        aria-haspopup="true"
        aria-expanded={
          filterPanelState?.open === true && filterPanelState.colKey === col.key
            ? 'true'
            : undefined
        }
        data-iris-filter-active={active ? 'true' : undefined}
        onClick={(e) => openFilterPanel(e, col.key)}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          marginInlineStart: 'var(--iris-space-xxs, 4px)',
          fontSize: 'var(--iris-font-size-xs, 12px)',
          lineHeight: 1,
          color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
        }}
      >
        ⏷
      </button>
    )
  }

  // Each row is its own CSS grid (sharing `gridTemplateColumns`) rather than the
  // root being one grid — this keeps columns aligned while letting the virtual
  // scroller absolutely-position rows. `extraStyle` lets the virtual window set
  // a row's height to fill its slot.
  // Batch BD collaborative presence (iris 独有 — vxe has no cursor sharing):
  // group the controlled entries by cellKey once per render, so each visible
  // cell costs a single Map lookup. A NEW `presence` array reference
  // re-renders (in-place mutation does not — same contract as `data` /
  // `annotations`). Pure display: no state, store or effect anywhere.
  const presenceByCell = React.useMemo(
    () =>
      presence && presence.length > 0
        ? presence.reduce((m, e) => {
            const list = m.get(e.cellKey)
            if (list) list.push(e)
            else m.set(e.cellKey, [e])
            return m
          }, new Map<string, IrisTablePresenceEntry[]>())
        : null,
    [presence],
  )

  const renderRow = (
    row: Row,
    idx: number,
    extraStyle?: React.CSSProperties,
    treeMeta?: TreeRow<Row>,
  ): React.ReactElement => {
    const k = rowKeyOf(row, idx)
    const selected = displaySelection.includes(k)
    return (
      <div
        key={String(k ?? idx)}
        role="row"
        aria-selected={selectable !== 'none' ? selected : undefined}
        // Tree depth/position for screen readers (1-based); the toggle button
        // carries aria-expanded for the control itself.
        aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
        aria-setsize={treeMeta ? treeMeta.setSize : undefined}
        aria-posinset={treeMeta ? treeMeta.posInset : undefined}
        data-iris-table-row={String(k ?? idx)}
        data-iris-table-row-selected={selected ? 'true' : undefined}
        data-iris-row-editing={rowMode && rowEditing?.k === k ? 'true' : undefined}
        data-iris-row-current={currentRowKey === k ? 'true' : undefined}
        data-iris-row-added={compareDiff?.status.get(k) === 'added' ? 'true' : undefined}
        data-iris-row-removed={compareDiff?.status.get(k) === 'removed' ? 'true' : undefined}
        data-iris-row-changed={compareDiff?.status.get(k) === 'changed' ? 'true' : undefined}
        onClick={() => {
          onRowClick?.(row, idx)
          if (onCurrentRowChange && k != null) {
            if (beforeCurrentRowChange?.(k, row) !== false) onCurrentRowChange(k, row)
          }
        }}
        onDoubleClick={() => {
          onRowDblClick?.(row, idx)
        }}
        className={rowClassName?.(row, idx)}
        style={{
          display: 'grid',
          gridTemplateColumns,
          ...extraStyle,
          ...(rowStyle?.(row, idx) ?? null),
        }}
      >
        {rowDrag ? (
          <div
            role="cell"
            data-iris-table-cell="__drag"
            data-iris-row-drag-active={rowDragActiveId === String(k ?? idx) ? 'true' : undefined}
            data-iris-row-drag-over={rowDragOverId === String(k ?? idx) ? 'true' : undefined}
            onPointerDown={(e) => handleRowDragPointerDown(e, String(k ?? idx))}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              cursor: 'grab',
              color: 'var(--iris-muted)',
              borderBottom: borderStyle,
              background:
                rowDragActiveId === String(k ?? idx)
                  ? 'var(--iris-surface-hover)'
                  : rowDragOverId === String(k ?? idx)
                    ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
                    : 'transparent',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 'var(--iris-font-size-sm, 13px)' }}>
              ⠿
            </span>
          </div>
        ) : null}
        {showRowNumbers ? (
          <div
            role="cell"
            data-iris-table-cell={seq ? '__seq' : '__row-ref'}
            data-iris-row-ref={showCellRefs && !seq ? '' : undefined}
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              color: 'var(--iris-muted)',
              borderBottom: borderStyle,
              userSelect: 'none',
            }}
          >
            {seqMethod
              ? seqMethod({ rowIndex: idx, columnIndex: 0 })
              : proxy && proxyConfig?.seq && seq
                ? (proxyState.params.page - 1) * proxyState.params.pageSize + idx + 1
                : idx + seqStartIndex}
          </div>
        ) : null}
        {hasDetail ? (
          <div
            role="cell"
            data-iris-table-cell="__expand"
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              background: 'var(--iris-cell-bg, transparent)',
              borderBottom: borderStyle,
            }}
          >
            {isRowExpandable(row, idx) ? (
              <button
                type="button"
                data-iris-table-expand-toggle=""
                aria-expanded={expandedKeys.includes(String(k))}
                aria-label={t(
                  expandedKeys.includes(String(k)) ? 'treeSelect.collapse' : 'treeSelect.expand',
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  expansion.toggle(String(k))
                  // vxe toggle-row-expand parity: `expanded` is the NEW state.
                  onExpandChange?.(row, !expandedKeys.includes(String(k)))
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit',
                  color: 'var(--iris-foreground)',
                  transform: expandedKeys.includes(String(k)) ? 'rotate(90deg)' : 'none',
                  transition: 'transform 150ms',
                }}
              >
                ▶
              </button>
            ) : null}
          </div>
        ) : null}
        {selectable !== 'none' ? (
          <div
            role="cell"
            data-iris-table-cell="__selection"
            onClick={
              checkboxRange || selectionDrag
                ? (e: React.MouseEvent) => {
                    // selectionDrag (batch BT): once the threshold is crossed
                    // the press cell holds pointer capture, so the trailing
                    // click after pointerup is retargeted HERE — consuming the
                    // armed flag. preventDefault is belt-and-braces: under
                    // capture the label never receives the click anyway, and
                    // in jsdom (no capture retargeting) it also blocks a
                    // trailing label→input activation double-toggle.
                    if (selectionDragSuppressRef.current) {
                      selectionDragSuppressRef.current = false
                      e.preventDefault()
                      return
                    }
                    // vxe checkboxConfig isShiftKey parity: shift-click toggles
                    // the whole range between the anchor and this row. The
                    // label forwards a second click to the <input> —
                    // preventDefault on the original click cancels the
                    // forwarded one AND the single-toggle change event, so the
                    // target row is not toggled twice (the range covers it).
                    if (checkboxRange && e.shiftKey && checkboxAnchorRef.current !== null) {
                      e.preventDefault()
                      toggleRowRange(checkboxAnchorRef.current, k)
                    }
                    // Always move the anchor — even without shift.
                    if (checkboxRange) checkboxAnchorRef.current = k ?? null
                  }
                : undefined
            }
            onPointerDown={
              selectionDrag
                ? (e: React.PointerEvent) => handleSelectionDragPointerDown(e, k ?? idx)
                : undefined
            }
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              background: 'var(--iris-cell-bg, transparent)',
              borderBottom: borderStyle,
            }}
          >
            {selectable === 'multi' ? (
              <IrisCheckbox
                checked={selected}
                disabled={checkMethod ? !checkMethod(row, idx) : false}
                onChange={() => toggleRow(row, idx)}
                aria-label={t('table.selectRow', { key: String(k ?? idx) })}
              />
            ) : (
              // Single mode renders a native radio circle (vxe type='radio'
              // column parity): accent-color drives the checked ring via the
              // primary token; same aria/disabled/onChange semantics as the
              // checkbox; the header cell stays empty (unchanged).
              <input
                type="radio"
                data-iris-table-radio=""
                checked={selected}
                disabled={checkMethod ? !checkMethod(row, idx) : false}
                onChange={() => toggleRow(row, idx)}
                aria-label={t('table.selectRow', { key: String(k ?? idx) })}
                style={{ accentColor: 'var(--iris-primary)', margin: 0, cursor: 'pointer' }}
              />
            )}
          </div>
        ) : null}
        {leafColumns.map((col, ci) => {
          if (visibleColSet && !visibleColSet.has(ci)) return null
          const spanKey = `${idx}:${ci}`
          if (spanMethod && spanOccupyRef.current.has(spanKey)) return null
          const span = spanMethod?.({ rowIndex: idx, columnIndex: ci })
          const rowspan = span?.rowspan ?? 1
          const colspan = span?.colspan ?? 1
          if (rowspan > 1) {
            for (let r = 1; r < rowspan; r++) spanOccupyRef.current.add(`${idx + r}:${ci}`)
          }
          if (colspan > 1) {
            for (let c = 1; c < colspan; c++) spanOccupyRef.current.add(`${idx}:${ci + c}`)
          }
          const raw = getCellValue(row, col)
          // Batch AY: the display chain reads the MASKED value — mask first,
          // formatter second. Every display branch below (render/html/link/
          // formatter/raw fallback) sees the masked value; editing and
          // validation start from `getCellValue` directly and stay RAW.
          const displayValue = applyCellMask(raw, col)
          // Batch AO: a formula column is display-only even when `editable` —
          // one guard extracted so the cell branch stays under the complexity
          // budget while every editing entry point reads the same condition.
          const editableLive = isEditableColumn(col)
          // Batch BE: locked = read-only cell (attr + cursor). Fail-inert —
          // selection, range, copy/export and FNR find keep working.
          const lockedLive = isCellLocked(row, col)
          // Batch BJ: permission-readonly — same throat, DYNAMIC (re-evaluated
          // per render); locked wins visually when both.
          const readonlyLive = isCellReadonly(row, col)
          const lockedRender = cellPermissionRender(
            lockedLive,
            readonlyLive,
            editableLive,
            !!cellRange,
          )
          const editing = rowMode
            ? rowSessions.has(cellId(k, col.key))
            : cellEdit.isEditing(cellId(k, col.key), col.key)
          // Batch Q (vxe editDirtyConfig parity): dirty flag + rendered
          // marker for this cell (attr, class, relative positioning).
          const dirtyInfo = dirtyCellState(editDirtyConfig, dirtyCellsRef.current, k, col.key)
          // Batch AU compare view: the changed cell for this (row, column) —
          // resolved via the same dataIndex ?? key indirect layer getCellValue
          // uses, so a dataIndex column matches its object key. Formula
          // columns are computed display values (documented simplification:
          // their own diffs are not flagged — the referenced fields are).
          const compareChange = cellChangeOf(k, col)
          // Batch AZ cell annotations (iris 独有): note = cellNote (dynamic,
          // wins) ?? annotations[cellId(k, col.key)] — badge, attr and title
          // all flow from this single resolution (zero nodes when absent);
          // the note case adds position relative so the badge anchors (see
          // CELL_NOTE_STYLE: pinned sticky cells override it, which is fine).
          const noteInfo = cellNoteState(annotations, cellNote, row, col, k)
          // Batch BD collaborative presence (iris 独有): the entries on this
          // cell (one Map lookup) — outline (first-wins color) + corner name
          // labels; null when the cell has no presence (zero nodes).
          const presenceEntries = presenceOf(presenceByCell, k, col.key)
          const presenceInfo = presenceStyle(presenceEntries)
          const fnrCellKey = `${idx}:${ci}`
          const fnrCellActive = fnrActiveKey === fnrCellKey
          const fnrCellMatched = fnrMatchSet.has(fnrCellKey)
          // Batch AQ drag fill: the handle renders inside the range's
          // bottom-right cell; cells between the range edge and the drag end
          // (excluding the source range) highlight while dragging.
          const fillHandleCell = isRangeFillHandleCell(rangeFill, activeRange, idx, ci)
          const fillTargetCell = isRangeFillTarget(idx, ci)
          // Batch CE copy flash: SNAPSHOT semantics — the rect was captured
          // at copy time, so the highlight does not chase a changed selection
          // (spec “复制成功后…选中单元格短暂高亮”).
          return (
            <div
              key={col.key}
              role="cell"
              data-iris-table-cell={col.key}
              data-iris-table-pinned={pinOf(col)}
              data-editable={editableLive ? '' : undefined}
              data-editing={editing ? '' : undefined}
              data-iris-cell-dirty={dirtyInfo.attr}
              data-iris-cell-changed={compareCellAttr(compareChange)}
              data-iris-cell-note={noteInfo.attr}
              data-iris-cell-locked={lockedRender.lockedAttr}
              data-iris-cell-readonly={lockedRender.readonlyAttr}
              data-iris-presence={presenceInfo ? 'true' : undefined}
              title={cellTitle(editing, noteInfo.note, compareChange, row, col, notePopover)}
              className={
                [cellClassName?.(row, col, idx), dirtyInfo.dirtyClass].filter(Boolean).join(' ') ||
                undefined
              }
              {...(keyboardNavigation
                ? {
                    'data-grid-row': idx,
                    'data-grid-col': ci,
                    tabIndex: (
                      focusedCell
                        ? focusedCell.row === idx && focusedCell.col === ci
                        : idx === 0 && ci === 0
                    )
                      ? 0
                      : -1,
                    onFocus: () => setFocusedCell({ row: idx, col: ci }),
                  }
                : null)}
              {...(cellRange
                ? {
                    'data-iris-cell-row': idx,
                    'data-iris-cell-col': ci,
                    'data-iris-cell-selected': isInRange(idx, ci) ? 'true' : undefined,
                    'data-iris-copy-flash': copyFlashCellAttr(copyFlashRange, idx, ci),
                    'data-iris-range-fill-target': rangeFillTargetAttr(fillTargetCell),
                  }
                : null)}
              {...(fnrHighlighting
                ? {
                    'data-iris-fnr-match': fnrCellMatched ? 'true' : undefined,
                    'data-iris-fnr-active': fnrCellActive ? 'true' : undefined,
                  }
                : null)}
              {...notePopoverCellHandlers(
                notePopover,
                noteInfo.note,
                k,
                col.key,
                openNotePopover,
                closeNotePopover,
              )}
              onDoubleClick={
                onCellDblClick || rowMode || editableLive
                  ? () => {
                      // Internal behavior first (vxe parity): row mode opens the
                      // row editor, editable columns begin the cell edit — then
                      // the informational event fires for EVERY column (batch T).
                      if (rowMode) {
                        if (k != null) switchRowEdit(row, idx, col.key)
                      } else if (editableLive) {
                        beginEdit(row, col, k, idx)
                      }
                      onCellDblClick?.({ row, column: col, rowIndex: idx, columnIndex: ci })
                    }
                  : undefined
              }
              onContextMenu={
                contextMenu ? (e) => handleContextMenu(e, row, col, idx, ci) : undefined
              }
              onClick={
                onCellClick || rowMode
                  ? (e: React.MouseEvent) => {
                      handleCellClick(e, row, col, k, idx, ci)
                    }
                  : cellRange
                    ? (e: React.MouseEvent) => {
                        if (e.shiftKey) cellRangeCtrl.extendRange(idx, ci)
                        else cellRangeCtrl.startRange(idx, ci)
                        updateRangeToolbarAnchor()
                      }
                    : editableLive && editConfig?.trigger === 'click'
                      ? () => beginEdit(row, col, k, idx)
                      : undefined
              }
              style={{
                ...baseCellStyle,
                ...dirtyInfo.posStyle,
                ...noteInfo.posStyle,
                ...presenceInfo,
                ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                ...(colspan > 1 ? { gridColumnEnd: `span ${colspan}` } : null),
                ...(rowspan > 1 ? { gridRowEnd: `span ${rowspan}` } : null),
                justifyContent:
                  (col.align ?? (typeof getCellValue(row, col) === 'number' ? 'right' : 'left')) ===
                  'right'
                    ? 'flex-end'
                    : col.align === 'center'
                      ? 'center'
                      : 'flex-start',
                ...fnrCellStyle(
                  fnrCellActive,
                  fnrCellMatched,
                  cellRange && isInRange(idx, ci),
                  striped && idx % 2 === 1,
                ),
                ...rangeFillCellStyle(fillHandleCell, fillTargetCell),
                // Batch CG: the charCount corner badge anchors to a relative
                // cell (editing cell + selection badge host) — spread AFTER
                // rangeFillCellStyle so the handle host keeps its zIndex 2
                // (relative is idempotent there).
                ...charCountCellStyle(editing, charCount, activeRange, idx, ci),
                // Batch CE: the copy-flash background sits AFTER the
                // fnr/range-fill backgrounds (flash wins while active) but
                // BEFORE lockedRender.style (BE discipline: lock stripes /
                // readonly dots re-assert last). Longhand only — never
                // clobbers background-image.
                ...copyFlashCellStyle(copyFlashRange, idx, ci),
                borderBottom: borderStyle,
                cursor: lockedRender.cursor,
                ...(editing ? { padding: '4px 8px' } : null),
                ...pinnedStyle(col.key),
                ...(cellStyle?.(row, col, idx) ?? null),
                ...conditionalCellStyle(conditionalStyles, row, col.key, raw),
                // Batch BE+BJ: re-assert the lock stripes / readonly dots AFTER
                // every background shorthand above (range-fill/conditional/
                // user) — an inline `background` shorthand resets
                // background-image.
                ...lockedRender.style,
              }}
            >
              {treeMeta && ci === 0 ? (
                <span
                  data-iris-table-tree-indent=""
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flex: 'none',
                    paddingLeft: treeMeta.depth * 16,
                  }}
                >
                  {treeMeta.hasChildren ||
                  (lazyLoad !== undefined && !lazyChildrenRef.current.has(treeMeta.key)) ? (
                    <button
                      type="button"
                      data-iris-table-tree-toggle=""
                      data-iris-tree-loading={lazyLoading.has(treeMeta.key) ? '' : undefined}
                      aria-expanded={treeMeta.expanded}
                      aria-label={t(
                        treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (treeMeta.hasChildren) {
                          expansion.toggle(treeMeta.key)
                          // vxe toggle-tree-expand parity: `expanded` is the NEW state.
                          onTreeExpandChange?.(row, !treeMeta.expanded)
                          return
                        }
                        // Lazy leaf: first expand fetches the children. Loading
                        // is tracked in state (drives the spinner caret); a
                        // throwing load stays retryable (the key is not cached).
                        if (lazyLoading.has(treeMeta.key)) return
                        setLazyLoading((prev) => new Set(prev).add(treeMeta.key))
                        const clearLoading = () =>
                          setLazyLoading((prev) => {
                            const next = new Set(prev)
                            next.delete(treeMeta.key)
                            return next
                          })
                        try {
                          const epoch = lazyEpochRef.current
                          lazyLoad!(row, (children) => {
                            // Stale fetch: the data source changed while this
                            // load was in flight — drop the result so the
                            // cleared cache is not re-seeded (and do NOT clear
                            // the loading flag, which may belong to a newer
                            // fetch of the same key).
                            if (epoch !== lazyEpochRef.current) return
                            lazyChildrenRef.current.set(treeMeta.key, children)
                            if (children && children.length > 0) {
                              expansion.toggle(treeMeta.key)
                              // Lazy load resolved children: the row just expanded.
                              onTreeExpandChange?.(row, true)
                            }
                            clearLoading()
                          })
                        } catch {
                          clearLoading()
                        }
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 0,
                        marginRight: 4,
                        font: 'inherit',
                        color: 'var(--iris-foreground)',
                        transform: treeMeta.expanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 150ms',
                      }}
                    >
                      ▶
                    </button>
                  ) : (
                    <span style={{ display: 'inline-block', width: 16 }} aria-hidden="true" />
                  )}
                </span>
              ) : null}
              {editing ? (
                rowMode ? (
                  (() => {
                    const session = rowSessions.get(cellId(k, col.key))!
                    const id = cellId(k, col.key)
                    return (
                      <EditorSurface
                        session={session}
                        col={col}
                        errorId={`${id}-error`}
                        showError={validConfig?.showMessage !== false}
                        registerRef={registerRowEditorRef(col.key)}
                        onTab={(e, dir) => moveRowEditOnTab(e, dir, col, row)}
                        onCommit={() => commitWithSummaryIntent(session)}
                        onCancel={cancelRowEdit}
                        onSessionIdle={() => onRowSessionIdle(id)}
                        focusToken={rowFocus.colKey === col.key ? rowFocus.seq : 0}
                        suggestOptions={suggestOptions}
                        editAutoHeight={editAutoHeight}
                        charCount={charCount}
                        t={t}
                      />
                    )
                  })()
                ) : (
                  <EditorSurface
                    session={cellEdit}
                    col={col}
                    errorId={`${cellId(k, col.key)}-error`}
                    showError={validConfig?.showMessage !== false}
                    registerRef={setEditorRef}
                    onTab={moveEditOnTab}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    onSessionIdle={undefined}
                    focusToken={0}
                    suggestOptions={suggestOptions}
                    editAutoHeight={editAutoHeight}
                    charCount={charCount}
                    t={t}
                  />
                )
              ) : sparklineCell(col, raw) ? (
                // Batch BI (iris 独有): the per-prefix sparkline wins over
                // render/html/link/formatter/raw — display-only, mask inert,
                // editing/copy/export/summary untouched (documented fiat).
                renderSparkline(sparklineSeries(sparklineData, row, col), col.key)
              ) : col.render ? (
                col.render(displayValue, row, idx)
              ) : col.html ? (
                <span
                  // vxe type=html parity — opt-in; the caller guarantees the
                  // content is trusted (XSS risk, matching the vxe docs warning).
                  dangerouslySetInnerHTML={{ __html: String(displayValue ?? '') }}
                />
              ) : col.link ? (
                (() => {
                  // vxe cell link parity (batch L): wraps the formatted/raw text
                  // in an anchor; null/undefined falls through to formatter/raw.
                  const link = col.link(displayValue, row)
                  if (!link) {
                    return col.formatter
                      ? col.formatter(displayValue, row)
                      : (displayValue as React.ReactNode)
                  }
                  const href = typeof link === 'string' ? link : link.href
                  const label = typeof link === 'string' ? undefined : link.label
                  const target = typeof link === 'string' ? undefined : link.target
                  return (
                    <a
                      data-iris-table-link=""
                      href={href}
                      target={target}
                      rel={target === '_blank' ? 'noreferrer' : undefined}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {label ??
                        (col.formatter
                          ? col.formatter(displayValue, row)
                          : (displayValue as React.ReactNode))}
                    </a>
                  )
                })()
              ) : autoLink ? (
                // Batch CA (iris 独有): auto-detected whole-text URL/email
                // links — evaluated AFTER `col.link` (an explicit link column
                // still wins), BEFORE the formatter/raw branches (a
                // non-matching text falls through byte-identically).
                renderAutoLinkCell(row, col)
              ) : col.formatter ? (
                // vxe formatter parity (batch I): display-only — sorting,
                // filtering, editing and summary all read the raw value. The
                // formatter receives the MASKED value (batch AY: mask first).
                // Batch CK: searchHighlight wraps the formatter output string.
                applySearchHighlight(col.formatter(displayValue, row), searchHighlight)
              ) : (
                // Batch CK: searchHighlight wraps the raw string fallback.
                applySearchHighlight(displayValue as React.ReactNode, searchHighlight)
              )}
              {renderRangeFillHandle(fillHandleCell, idx, ci, handleRangeFillPointerDown)}
              {/* Batch CG (iris 独有): the selection badge at the range's
              bottom-right cell — count (+ sum when numeric data exists),
              reusing the rangeStatsData memo the stats panel consumes. */}
              {renderRangeCharCountBadge(
                charCount,
                activeRange,
                rangeStatsData,
                aggregateAccuracy,
                idx,
                ci,
                fillHandleCell,
                t,
              )}
              {renderCellNoteBadge(noteInfo.note)}
              {renderPresenceLabels(presenceEntries)}
            </div>
          )
        })}
      </div>
    )
  }

  // Batch-M group header row (vxe group-config parity): spans every grid
  // track (`gridColumn: 1 / -1`), shows the group value + row count. Batch BH
  // (iris 独有): a native `data-iris-group-toggle` button (▸/▾) collapses the
  // group — the header keeps its FULL count and `data-iris-group-collapsed`
  // marks the collapsed state; rows + per-group summary drop out of the plan.
  // In the virtual path `extraStyle` fills the fixed-height slot.
  const renderGroupHeader = (
    entry: { groupKey: string; count: number; depth?: number; value?: string },
    extraStyle?: React.CSSProperties,
  ): React.ReactElement => {
    const collapsed = collapsedSet.has(entry.groupKey)
    // Batch BS: nested group headers indent by depth with a token step — the
    // composite key stays the collapse identity (`data-iris-group-key`), the
    // displayed value is this level's own. `data-iris-group-depth` carries the
    // nesting level for tests/consumers.
    const depth = entry.depth ?? 0
    return (
      <div
        key={`group:${entry.groupKey}`}
        role="row"
        data-iris-group-row=""
        data-iris-group-key={entry.groupKey}
        data-iris-group-depth={depth}
        data-iris-group-collapsed={collapsed ? 'true' : undefined}
        style={{
          display: 'grid',
          gridTemplateColumns,
          background: 'var(--iris-surface)',
          borderBottom: borderStyle,
          fontWeight: 600,
          ...extraStyle,
        }}
      >
        <div
          role="cell"
          data-iris-group-cell=""
          style={{
            gridColumn: '1 / -1',
            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            paddingInlineStart: `calc(var(--iris-space-sm, 12px) + var(--iris-space-sm, 12px) * ${depth})`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-space-xs, 8px)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-foreground)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <button
            type="button"
            data-iris-group-toggle=""
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('table.groupExpand') : t('table.groupCollapse')}
            onClick={() => toggleGroupCollapse(entry.groupKey)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--iris-space-md, 16px)',
              height: 'var(--iris-space-md, 16px)',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--iris-muted)',
              cursor: 'pointer',
              fontSize: 'var(--iris-font-size-xs, 12px)',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          <span data-iris-group-value="">{entry.value ?? entry.groupKey}</span>
          <span
            data-iris-group-count=""
            style={{ color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' }}
          >
            ({entry.count})
          </span>
        </div>
      </div>
    )
  }

  // One body entry (data row or its detail wrap), grouped or not: keeps the
  // row's ORIGINAL bodyData index so seq/striped/span/checkMethod semantics
  // are identical to the ungrouped map.
  const renderBodyEntry = (row: Row, idx: number): React.ReactNode => {
    if (spanMethod && idx === 0) spanOccupyRef.current.clear()
    // Batch BN: the non-virtual path applies `rowHeight` inline on the data
    // row (fixed = uniform, fn = per-bodyData-index); detail wraps and group
    // headers keep content height. The virtual path never calls this — slots
    // fill via `height: '100%'` from the same throat.
    const main = renderRow(row, idx, rowHeightStyleOf(effectiveRowHeight, idx), flatTree?.[idx])
    if (
      !hasDetail ||
      !isRowExpandable(row, idx) ||
      !expandedKeys.includes(String(rowKeyOf(row, idx)))
    )
      return main
    // Full-width detail panel beneath the row (spans all grid tracks).
    return (
      <React.Fragment key={`${String(rowKeyOf(row, idx))}::wrap`}>
        {main}
        <div
          role="row"
          data-iris-table-row-detail={String(rowKeyOf(row, idx))}
          style={{ display: 'grid', gridTemplateColumns }}
        >
          <div
            role="cell"
            data-iris-table-detail-cell=""
            style={{ gridColumn: '1 / -1', padding: '8px 12px', borderBottom: borderStyle }}
          >
            {renderDetail!(row, idx)}
          </div>
        </div>
      </React.Fragment>
    )
  }

  // Detail panel as ONE virtual slot (batch AE): the panel fills its slot at
  // itemHeight; content taller than the slot scrolls INSIDE the detail cell
  // (overflow auto), so tree/detail virtual rows stay uniform-height and the
  // closed-form fixed window stays exact. Only the virtual body renders this
  // — the non-virtual path keeps renderBodyEntry's inline wrap above.
  const renderDetailSlot = (row: Row, idx: number): React.ReactElement => (
    <div
      role="row"
      data-iris-table-row-detail={String(rowKeyOf(row, idx))}
      style={{ display: 'grid', gridTemplateColumns, height: '100%' }}
    >
      <div
        role="cell"
        data-iris-table-detail-cell=""
        style={{
          gridColumn: '1 / -1',
          padding: '8px 12px',
          borderBottom: borderStyle,
          overflow: 'auto',
          height: '100%',
        }}
      >
        {renderDetail!(row, idx)}
      </div>
    </div>
  )

  // Footer merge plan (batch R, vxe-grid mergeFooterItems parity): declarative
  // span entries in the SAME coordinate space as footerSpanMethod — `row` is
  // the 0-based index over the rendered footer stack (footerMethod rows →
  // summary row → footerData rows), `col` the leaf-column index; both start
  // at 0. `rowspan` is INERT (review fix, mirrors footerSpanMethod/header
  // rowspan): each footer row is its own grid container, so a span can never
  // cover later rows — only the SAME row's right-hand cells are marked
  // occupied (colspan). The FUNCTION wins: when footerSpanMethod is
  // provided, mergeFooterItems is ignored entirely. Entries outside the
  // rendered stack never match → no-op.
  const footerMergePlan = React.useMemo(() => {
    if (footerSpanMethod || !mergeFooterItems || mergeFooterItems.length === 0) return null
    const byCell = new Map<string, { colspan?: number }>()
    const occupied = new Set<string>()
    for (const m of mergeFooterItems) {
      if (m.row < 0 || m.col < 0) continue
      const key = `${m.row}:${m.col}`
      if (byCell.has(key)) continue
      byCell.set(key, { colspan: m.colspan })
      const colspan = m.colspan ?? 1
      // Inert rowspan: covered cells of LATER rows keep their own data (a
      // null would let the remaining cells auto-place into earlier tracks);
      // only same-row colspan cells to the right are covered.
      for (let c = 1; c < colspan; c++) occupied.add(`${m.row}:${m.col + c}`)
    }
    return { byCell, occupied }
  }, [mergeFooterItems, footerSpanMethod])

  // Footer cell span state shared by every footer path (summary /
  // footer-method / footer-data). footerSpanMethod (function) wins over
  // mergeFooterItems when both are provided. `skipped` cells render null;
  // `spanStyle` carries the grid span — gridRowEnd cannot cross the per-row
  // grid containers, so rowspan (from either source) is inert: no span
  // styles, no occupy-marking of later rows' cells.
  const footerCellSpan = (
    rowIndex: number,
    ci: number,
  ): { skipped: boolean; colspan: number; spanStyle: React.CSSProperties | null } => {
    if (footerSpanMethod && footerOccupyRef.current.has(`${rowIndex}:${ci}`))
      return { skipped: true, colspan: 1, spanStyle: null }
    if (footerMergePlan && footerMergePlan.occupied.has(`${rowIndex}:${ci}`))
      return { skipped: true, colspan: 1, spanStyle: null }
    const fspan = footerSpanMethod
      ? footerSpanMethod({ rowIndex, columnIndex: ci, columns: leafColumns, data: bodyData })
      : null
    const mergeSpan = footerMergePlan?.byCell.get(`${rowIndex}:${ci}`)
    const colspan = footerSpanMethod ? (fspan?.colspan ?? 1) : (mergeSpan?.colspan ?? 1)
    if (footerSpanMethod && colspan > 1) {
      for (let c = 1; c < colspan; c++) footerOccupyRef.current.add(`${rowIndex}:${ci + c}`)
    }
    const spanStyle = footerSpanMethod
      ? colspan > 1
        ? { gridColumnEnd: `span ${colspan}` }
        : null
      : mergeSpan && mergeSpan.colspan && mergeSpan.colspan > 1
        ? { gridColumnEnd: `span ${mergeSpan.colspan}` }
        : null
    return { skipped: false, colspan, spanStyle }
  }

  // Summary row material (global footer + per-group footers, batch M): the
  // same `aggregate` ops as before, computed over the passed rows. A group
  // summary carries `data-iris-group-summary`; the global footer does not.
  const renderSummaryRow = (
    rows: Row[],
    groupKey?: string,
    extraStyle?: React.CSSProperties,
    footerRowIndex?: number,
  ): React.ReactElement => (
    <div
      role="row"
      data-iris-table-row="summary"
      data-iris-group-summary={groupKey !== undefined ? groupKey : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns,
        fontWeight: 600,
        borderTop: '2px solid var(--iris-border)',
        background: 'var(--iris-surface)',
        ...extraStyle,
      }}
    >
      {selectable !== 'none' ? (
        <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
      ) : null}
      {leafColumns.map((col, ci) => {
        if (visibleColSet && !visibleColSet.has(ci)) return null
        // footerSpanMethod (batch P) / mergeFooterItems (batch R): the same
        // occupy-skip pattern; `footerRowIndex` is 0-based over the rendered
        // footer stack. Only the global footer passes an index — group
        // summaries are not spanned/merged.
        const fspanState = footerRowIndex !== undefined ? footerCellSpan(footerRowIndex, ci) : null
        if (fspanState?.skipped) return null
        const op = col.summary
        const rawValue = op ? aggregate(rows, (r) => getCellValue(r, col), op) : null
        // aggregateAccuracy (batch P): the single rounding point for summary
        // values (global + per-group) — finite numbers only, before
        // `renderSummary` so custom renderers see the rounded value. Values
        // outside 0–100 are ignored (toFixed RangeError guard).
        const accuracy =
          aggregateAccuracy !== undefined && aggregateAccuracy >= 0 && aggregateAccuracy <= 100
            ? aggregateAccuracy
            : undefined
        const value =
          rawValue != null && accuracy !== undefined && Number.isFinite(rawValue)
            ? Number(rawValue.toFixed(accuracy))
            : rawValue
        return (
          <div
            key={col.key}
            role="cell"
            data-iris-table-cell={col.key}
            data-iris-table-summary-cell={op ? '' : undefined}
            title={footerTooltip(col)}
            style={{
              ...baseCellStyle,
              ...(showFooterOverflow ? null : cellOverflowOverride),
              ...(fspanState?.spanStyle ?? null),
              justifyContent: justifyFor(footerAlign ?? col.align),
              ...pinnedStyle(col.key),
            }}
          >
            {op != null && value != null
              ? col.renderSummary
                ? col.renderSummary(value, rows)
                : String(value)
              : null}
          </div>
        )
      })}
    </div>
  )

  // Batch-M toolbar action: read once so the closure below stays narrowed
  // (no non-null assertions needed).
  const batchAction = toolbar?.batch
  // ── Batch edit panel (iris 独有, batch AL) ────────────────────────────
  // `toolbar.batch.edit` turns the batch button into the built-in panel:
  // an editable-column select (the SAME `c.editable` gating inline editing
  // uses) + value input + 应用. Apply = ONE commitRowList that writes the
  // value into every selected row (paste parity: values stay strings,
  // editRules are not re-validated, selection untouched); the panel closes
  // on apply / Escape / outside pointer-down.
  const [batchEditOpen, setBatchEditOpen] = React.useState(false)
  const [batchEditColKey, setBatchEditColKey] = React.useState('')
  const [batchEditValue, setBatchEditValue] = React.useState('')
  const batchEditCols = React.useMemo(
    () => leafColumns.filter((c) => c.editable && !c.formula),
    [leafColumns],
  )
  const applyBatchEdit = (): void => {
    const col = batchEditCols.find((c) => c.key === batchEditColKey)
    if (!col) return
    const keyField = rowKey
    const rows = externalDataRef.current ?? []
    if (!keyField || rows.length === 0) return
    const keys = new Set(displaySelectionRef.current)
    // Batch BE: locked cells of selected rows stay untouched — the patch
    // applies to the unlocked ones only; ALL locked → nothing changed → no
    // commitRowList at all (panel still closes, zero event pollution).
    let changed = false
    const next = rows.map((r) => {
      const selected = keys.has((r as Record<string, unknown>)[keyField] as string | number)
      if (selected && !isCellLocked(r, col) && !isCellReadonly(r, col)) changed = true
      return selected && !isCellLocked(r, col) && !isCellReadonly(r, col)
        ? { ...r, [col.key]: batchEditValue }
        : r
    })
    if (changed) commitRowList(next, 'batch')
    setBatchEditOpen(false)
  }
  // Escape / outside pointer-down close the panel (the trigger button is
  // excluded — clicking it toggles).
  React.useEffect(() => {
    if (!batchEditOpen) return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && target.closest('[data-iris-batch-edit-panel], [data-iris-table-toolbar-batch]'))
        return
      setBatchEditOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setBatchEditOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [batchEditOpen])
  // Fixed height (batch N): any of height/min/max makes the root a vertical
  // scroll container; the injected stylesheet pins the header row. Batch Q:
  // `autoResize` with a positive measure engages the same machinery so the
  // auto-filled root scrolls/sticks exactly like an explicit-height table.
  // Batch U zoom: the zoomed overlay is its own viewport (fixed + inset 0 +
  // overflow auto) — the sticky header + scroll machinery engage exactly
  // like an explicit height.
  const fixedHeight =
    height !== undefined ||
    minHeight !== undefined ||
    maxHeight !== undefined ||
    ((autoResize || syncResize) && autoSize !== null) ||
    zoomed
  // Virtual body items: always typed as plan entries (rows wrapped with their
  // ORIGINAL bodyData index) so the `kind` discriminant narrows cleanly — a
  // generic `Row` type param defeats `'kind' in` narrowing. In detail mode
  // (batch AE) each expandable + expanded row contributes ONE extra `detail`
  // slot right after its row — expansion toggles change `expandedKeys`, which
  // flows into this plan and thus into `items.length` (the virtualizer rebuilds
  // on count change and re-clamps, so the scroll stays sane on collapse).
  const virtualItems = React.useMemo<BodyPlanEntry[]>(() => {
    if (groupPlan) return groupPlan
    // Only the virtual body consumes this plan (the non-virtual path renders
    // detail wraps inline via renderBodyEntry); gate the detail slots on
    // virtualScroll so plain detail tables keep the O(n) flat map.
    if (!virtualScroll || !hasDetail) {
      return bodyData.map((row, rowIndex) => ({ kind: 'row' as const, row, rowIndex }))
    }
    const plan: BodyPlanEntry[] = []
    for (let i = 0; i < bodyData.length; i += 1) {
      const row = bodyData[i]!
      plan.push({ kind: 'row', row, rowIndex: i })
      if (isRowExpandable(row, i) && expandedKeys.includes(String(rowKeyOf(row, i)))) {
        plan.push({ kind: 'detail', row, rowIndex: i })
      }
    }
    return plan
  }, [groupPlan, virtualScroll, hasDetail, bodyData, expandedKeys, rowKeyOf, isRowExpandable])

  // Footer stack (batch P): footerMethod rows → summary row → footerData rows
  // — in that order, whichever render (footerMethod REPLACES the summary op
  // row; footerData renders below, even with an empty body). footerSpanMethod
  // receives a 0-based rowIndex over this rendered stack; spans share the
  // occupy-skip pattern of spanMethod but use their own ref so body keys never
  // collide. Group summary rows are not part of the stack.
  const renderFooterStack = (): React.ReactNode => {
    if (tableError || tableLoading) return null
    if (footerSpanMethod) footerOccupyRef.current.clear()
    const nodes: React.ReactNode[] = []
    let fi = 0
    if (bodyData.length > 0) {
      const methodRows = footerMethod
        ? footerMethod({ columns: leafColumns, data: bodyData })
        : null
      if (methodRows) {
        for (const footerRow of methodRows) {
          const rowIndex = fi
          fi += 1
          nodes.push(
            <div
              key={String((footerRow as Record<string, unknown>)[rowKey] ?? rowIndex)}
              role="row"
              data-iris-table-row="summary"
              data-iris-table-footer-method-row={String(rowIndex)}
              style={{
                display: 'grid',
                gridTemplateColumns,
                fontWeight: 600,
                borderTop: rowIndex === 0 ? '2px solid var(--iris-border)' : borderStyle,
                background: 'var(--iris-surface)',
              }}
            >
              {selectable !== 'none' ? (
                <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
              ) : null}
              {leafColumns.map((col, ci) => {
                if (visibleColSet && !visibleColSet.has(ci)) return null
                const fspanState = footerCellSpan(rowIndex, ci)
                if (fspanState.skipped) return null
                const value = getCellValue(footerRow, col)
                return (
                  <div
                    key={col.key}
                    role="cell"
                    data-iris-table-cell={col.key}
                    data-iris-table-footer-method-cell=""
                    className={footerCellClassName?.(col, rowIndex)}
                    title={footerTooltip(col)}
                    style={{
                      ...baseCellStyle,
                      ...(showFooterOverflow ? null : cellOverflowOverride),
                      ...(fspanState.spanStyle ?? null),
                      justifyContent: justifyFor(footerAlign ?? col.align),
                      ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                      ...(footerCellStyle?.(col, rowIndex) ?? null),
                    }}
                  >
                    {String(value ?? '')}
                  </div>
                )
              })}
            </div>,
          )
        }
      } else if (leafColumns.some((c) => c.summary)) {
        const rowIndex = fi
        fi += 1
        nodes.push(
          <React.Fragment key={`summary:${rowIndex}`}>
            {renderSummaryRow(bodyData, undefined, undefined, rowIndex)}
          </React.Fragment>,
        )
      }
    }
    if (footerData && footerData.length > 0) {
      nodes.push(
        <div key="iris-table-footer-data" data-iris-table-footer="" style={{ display: 'contents' }}>
          {footerData.map((footerRow, fd) => {
            const rowIndex = fi
            fi += 1
            return (
              <div
                key={String((footerRow as Record<string, unknown>)[rowKey] ?? fd)}
                role="row"
                data-iris-table-row={`footer-${fd}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns,
                  fontWeight: 600,
                  background: 'var(--iris-surface)',
                }}
              >
                {selectable !== 'none' ? (
                  <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
                ) : null}
                {leafColumns.map((col, ci) => {
                  if (visibleColSet && !visibleColSet.has(ci)) return null
                  const fspanState = footerCellSpan(rowIndex, ci)
                  if (fspanState.skipped) return null
                  const value = getCellValue(footerRow, col)
                  return (
                    <div
                      key={col.key}
                      role="cell"
                      data-iris-table-cell={col.key}
                      data-iris-table-footer-cell=""
                      className={footerCellClassName?.(col, fd)}
                      title={footerTooltip(col)}
                      style={{
                        ...baseCellStyle,
                        ...(showFooterOverflow ? null : cellOverflowOverride),
                        ...(fspanState.spanStyle ?? null),
                        justifyContent: justifyFor(
                          footerAlign ??
                            col.align ??
                            (typeof value === 'number' ? 'right' : 'left'),
                        ),
                        ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                        ...(footerCellStyle?.(col, fd) ?? null),
                      }}
                    >
                      {String(value ?? '')}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>,
      )
    }
    return nodes.length > 0 ? nodes : null
  }

  return (
    <>
      {formConfig && layouts?.form !== 'hidden' ? (
        <form
          data-iris-table-form=""
          onSubmit={handleFormSubmit}
          onReset={handleFormReset}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            borderBottom: 'none',
            background: 'var(--iris-surface)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          {formConfig.fields.map((field) => (
            <div key={field.key} data-iris-table-form-field={field.key} style={{ minWidth: 180 }}>
              <IrisFormField label={field.label} size="sm">
                {field.type === 'select' ? (
                  <IrisSelect
                    items={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                    value={formDraft[field.key] ?? ''}
                    onValueChange={(v) => setFormValue(field.key, String(v ?? ''))}
                    placeholder={field.placeholder ?? t('select.placeholder')}
                    size="sm"
                  />
                ) : (
                  <IrisInput
                    value={formDraft[field.key] ?? ''}
                    onChange={(e) => setFormValue(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    size="sm"
                  />
                )}
              </IrisFormField>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 'var(--iris-space-xs, 8px)' }}>
            <IrisButton type="submit" size="sm" data-iris-table-form-submit="">
              {formConfig.submitText ?? t('table.formSubmit')}
            </IrisButton>
            <IrisButton type="reset" variant="outline" size="sm" data-iris-table-form-reset="">
              {formConfig.resetText ?? t('table.formReset')}
            </IrisButton>
          </div>
        </form>
      ) : null}
      {(toolbar ||
        views ||
        query !== undefined ||
        undo ||
        chartPreview ||
        freshness ||
        validationSummary ||
        auditLog ||
        perfStats ||
        versionHistory ||
        shortcutHints) &&
      layouts?.toolbar !== 'hidden' ? (
        <div
          data-iris-table-toolbar=""
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            borderBottom: 'none',
            borderTopLeftRadius: 'var(--iris-radius-md, 6px)',
            borderTopRightRadius: 'var(--iris-radius-md, 6px)',
            background: 'var(--iris-surface)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            position: 'relative',
            // Batch U zoom: lift the toolbar above the fixed overlay while
            // zoomed so the ✕ exit button stays reachable (vxe parity — vxe
            // keeps its toolbar inside the zoomed root). The toolbar is a
            // sibling rendered BEFORE the root, so without this the overlay
            // (z-index popover) would paint on top of it.
            ...(zoomed ? { zIndex: 'calc(var(--iris-z-popover, 1000) + 1)' } : null),
          }}
        >
          {toolbar?.title ? (
            <span style={{ fontWeight: 600, color: 'var(--iris-foreground)' }}>
              {toolbar?.title}
            </span>
          ) : null}
          {/* Batch AS (iris 独有): freshness stamp — re-stamped on every live
              data change (initial arrival, refetch, edits, row ops, undo).
              Hidden until the first row exists. */}
          {freshness && freshnessAt > 0 && liveData.length > 0 ? (
            <span
              data-iris-freshness=""
              style={{
                fontSize: 'var(--iris-font-size-xs, 12px)',
                color: 'var(--iris-muted)',
              }}
            >
              {t('table.freshness', { time: formatClock(new Date(freshnessAt)) })}
            </span>
          ) : null}
          {/* Batch AL (iris 独有): built-in undo/redo buttons after the title.
              Disabled from canUndo/canRedo — the tick state re-reads them on
              every push/undo/redo (the stack is a plain controller, not an
              observable store). */}
          {undo ? (
            <>
              <button
                type="button"
                data-iris-table-undo=""
                onClick={() => {
                  const prev = undoStack.undo()
                  if (prev !== undefined) {
                    bumpUndoTick()
                    applyUndoSnapshot(prev, 'undo')
                  }
                }}
                disabled={!undoStack.canUndo()}
                aria-label={t('table.undo')}
                title={t('table.undo')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: undoStack.canUndo() ? 'pointer' : 'default',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                }}
              >
                ↶
              </button>
              <button
                type="button"
                data-iris-table-redo=""
                onClick={() => {
                  const next = undoStack.redo()
                  if (next !== undefined) {
                    bumpUndoTick()
                    applyUndoSnapshot(next, 'redo')
                  }
                }}
                disabled={!undoStack.canRedo()}
                aria-label={t('table.redo')}
                title={t('table.redo')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: undoStack.canRedo() ? 'pointer' : 'default',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                }}
              >
                ↷
              </button>
            </>
          ) : null}
          {/* Batch AI: the natural-language query input renders after the title
              (left side) whenever the controlled `query` prop is present. The
              error hint (last-valid-parse keeps filtering) shows muted below. */}
          {query !== undefined ? (
            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 4,
              }}
            >
              <input
                ref={queryInputRef}
                data-iris-table-query-input=""
                value={query}
                onChange={(e) => onQueryChange?.(e.target.value)}
                placeholder={t('table.queryPlaceholder')}
                aria-label={t('table.queryPlaceholder')}
                style={{
                  border: '1px solid var(--iris-border)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  padding: '4px 8px',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                  color: 'var(--iris-foreground)',
                  background: 'var(--iris-surface)',
                  outline: 'none',
                  width: 220,
                }}
              />
              {queryError !== null ? (
                <span
                  data-iris-query-error=""
                  style={{
                    fontSize: 'var(--iris-font-size-xs, 12px)',
                    color: 'var(--iris-muted)',
                    maxWidth: 220,
                  }}
                >
                  {queryError}
                </span>
              ) : null}
            </div>
          ) : null}
          <div style={{ flex: 1 }} />
          {toolbar?.onRefresh ? (
            <button
              type="button"
              data-iris-table-toolbar-refresh=""
              onClick={() => {
                toolbar.onRefresh?.()
                // proxy mode: the built-in refresh also re-queries (vxe parity)
                if (proxyRef.current) proxyRef.current.refetch()
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.refresh')}
              title={t('table.refresh')}
            >
              ↻
            </button>
          ) : null}
          {toolbar?.onImport ? (
            <>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button
                type="button"
                data-iris-table-toolbar-import=""
                onClick={() => importFileRef.current?.click()}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                }}
                aria-label={t('table.import')}
                title={t('table.import')}
              >
                ⇪
              </button>
            </>
          ) : null}
          {toolbar?.onExport ? (
            <button
              type="button"
              data-iris-table-toolbar-export=""
              onClick={() => toolbar.onExport?.()}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.export')}
              title={t('table.export')}
            >
              ⇩
            </button>
          ) : null}
          {toolbar?.columnSettings && columnVisibility ? (
            <>
              <button
                type="button"
                data-iris-table-toolbar-columns=""
                onClick={toggleColumnSettings}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                }}
                aria-label={t('table.columnSettings')}
                title={t('table.columnSettings')}
              >
                ☰
              </button>
              {columnSettingsOpen ? (
                <div
                  data-iris-table-column-settings=""
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setColumnSettingsOpen(false)
                    }
                  }}
                  onPointerMove={handleCustomDragPointerMove}
                  onPointerUp={handleCustomDragPointerUp}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    zIndex: 'var(--iris-z-popover, 1000)',
                    background: 'var(--iris-surface-floating, var(--iris-surface))',
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    boxShadow: 'var(--iris-shadow-lg)',
                    padding: 'var(--iris-space-xs, 8px)',
                    minWidth: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--iris-space-xs, 8px)',
                  }}
                >
                  <input
                    type="text"
                    data-iris-table-column-settings-search=""
                    aria-label={t('table.customConfig.search')}
                    placeholder={t('table.customConfig.search')}
                    value={customSearch}
                    onChange={(e) => setCustomSearch(e.target.value)}
                    style={{
                      border: '1px solid var(--iris-border)',
                      borderRadius: 'var(--iris-radius-sm, 4px)',
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                      fontSize: 'var(--iris-font-size-sm, 13px)',
                      outline: 'none',
                    }}
                  />
                  <div
                    data-iris-table-column-settings-list=""
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--iris-space-xxs, 4px)',
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}
                  >
                    {customPanelColumns.map((col) => (
                      <div
                        key={col.key}
                        data-iris-table-column-settings-row={col.key}
                        data-iris-column-settings-drag-active={
                          customDragActiveId === col.key ? 'true' : undefined
                        }
                        data-iris-column-settings-drag-over={
                          customDragOverId === col.key ? 'true' : undefined
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--iris-space-xs, 8px)',
                          cursor: 'pointer',
                          padding: 'var(--iris-space-xxs, 4px)',
                          borderRadius: 'var(--iris-radius-sm, 4px)',
                          background:
                            customDragActiveId === col.key
                              ? 'var(--iris-surface-hover)'
                              : customDragOverId === col.key
                                ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
                                : 'transparent',
                        }}
                      >
                        <span
                          data-iris-table-column-settings-handle=""
                          aria-hidden="true"
                          onPointerDown={(e) => handleCustomDragPointerDown(e, col.key)}
                          style={{
                            cursor: 'grab',
                            color: 'var(--iris-muted)',
                            fontSize: 'var(--iris-font-size-sm, 13px)',
                            userSelect: 'none',
                          }}
                        >
                          ⠿
                        </span>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--iris-space-xs, 8px)',
                            cursor: 'pointer',
                            flex: 1,
                            color: 'var(--iris-foreground)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={columnVisibility?.[col.key] !== false}
                            onChange={() => toggleColumnVisibility(col.key)}
                          />
                          {col.title ?? col.key}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 'var(--iris-space-xs, 8px)',
                      borderTop: '1px solid var(--iris-border)',
                      paddingTop: 'var(--iris-space-xs, 8px)',
                    }}
                  >
                    <IrisButton
                      size="sm"
                      variant="outline"
                      data-iris-table-column-settings-reset=""
                      onClick={handleCustomReset}
                    >
                      {toolbar.customConfig?.resetText ?? t('table.customConfig.reset')}
                    </IrisButton>
                    <IrisButton
                      size="sm"
                      variant="solid"
                      data-iris-table-column-settings-confirm=""
                      onClick={handleCustomConfirm}
                    >
                      {t('table.filterConfirm')}
                    </IrisButton>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {selectable === 'multi' && selectionSummary === true && displaySelection.length > 0 ? (
            <div
              data-iris-selection-summary=""
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--iris-space-xxs, 4px)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                color: 'var(--iris-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{t('table.selectionSummary', { count: String(displaySelection.length) })}</span>
              {(() => {
                const selected = new Set(displaySelection)
                const selectedRows = bodyData.filter((row, i) => selected.has(rowKeyOf(row, i)))
                return leafColumns
                  .filter((col) => col.summary === 'sum')
                  .map((col) => {
                    const rawValue = aggregate(selectedRows, (r) => getCellValue(r, col), 'sum')
                    // Same aggregateAccuracy rounding point as the summary row
                    // (renderSummaryRow, batch P) — finite numbers only.
                    const accuracy =
                      aggregateAccuracy !== undefined &&
                      aggregateAccuracy >= 0 &&
                      aggregateAccuracy <= 100
                        ? aggregateAccuracy
                        : undefined
                    const value =
                      rawValue != null && accuracy !== undefined && Number.isFinite(rawValue)
                        ? Number(rawValue.toFixed(accuracy))
                        : rawValue
                    if (value == null) return null
                    return (
                      <span key={col.key}>
                        · {t('table.selectionSummarySum')} {String(value)}
                      </span>
                    )
                  })
              })()}
              <button
                type="button"
                data-iris-selection-clear=""
                onClick={() => {
                  // The shared clearSelection path (handle parity): re-base on
                  // the controlled prop, then clear the model.
                  rebaseToProp()
                  selModel.clear()
                }}
                aria-label={t('table.clearSelection')}
                title={t('table.clearSelection')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ) : null}
          {selectable === 'multi' && displaySelection.length > 0 && batchAction ? (
            <button
              type="button"
              data-iris-table-toolbar-batch=""
              onClick={() => {
                // Batch AL: `toolbar.batch.edit` opens the built-in batch
                // edit panel instead of firing the external action (clicking
                // the trigger again toggles it closed).
                if (batchEditOpen) {
                  setBatchEditOpen(false)
                  return
                }
                if (batchAction.edit) {
                  setBatchEditColKey(batchEditCols[0]?.key ?? '')
                  setBatchEditValue('')
                  setBatchEditOpen(true)
                  return
                }
                batchAction.onClick([...displaySelection])
              }}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground)',
                fontSize: 'var(--iris-font-size-md, 14px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--iris-space-xxs, 4px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
              }}
              aria-label={batchAction.label}
              title={batchAction.label}
            >
              {batchAction.icon ? (
                <span aria-hidden="true" style={{ fontSize: 'var(--iris-font-size-sm, 13px)' }}>
                  {batchAction.icon}
                </span>
              ) : null}
              {batchAction.label}
            </button>
          ) : null}
          {batchEditOpen ? (
            <div
              data-iris-batch-edit-panel=""
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                zIndex: 'var(--iris-z-popover, 1000)',
                background: 'var(--iris-surface-floating, var(--iris-surface))',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-md, 6px)',
                boxShadow: 'var(--iris-shadow-lg)',
                padding: 'var(--iris-space-sm, 12px)',
                minWidth: 220,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--iris-space-xs, 8px)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--iris-space-xxs, 4px)',
                  color: 'var(--iris-foreground)',
                }}
              >
                {t('table.batchEdit.column')}
                <select
                  data-iris-batch-edit-column=""
                  value={batchEditColKey}
                  onChange={(e) => setBatchEditColKey(e.target.value)}
                  aria-label={t('table.batchEdit.column')}
                  style={{
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    background: 'var(--iris-surface)',
                    color: 'var(--iris-foreground)',
                    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    outline: 'none',
                  }}
                >
                  {batchEditCols.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.title ?? col.key}
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                data-iris-batch-edit-value=""
                value={batchEditValue}
                onChange={(e) => setBatchEditValue(e.target.value)}
                aria-label={t('table.batchEdit.apply')}
                placeholder={t('table.batchEdit.apply')}
                style={{
                  border: '1px solid var(--iris-border)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  background: 'var(--iris-surface)',
                  color: 'var(--iris-foreground)',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                data-iris-batch-edit-apply=""
                onClick={applyBatchEdit}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--iris-primary)',
                  color: 'var(--iris-primary-foreground)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                }}
              >
                {t('table.batchEdit.apply')}
              </button>
            </div>
          ) : null}
          {columnWidthsReset ? (
            <button
              type="button"
              data-iris-table-toolbar-reset-widths=""
              onClick={resetColumnWidths}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.resetColumnWidths')}
              title={t('table.resetColumnWidths')}
            >
              {'⇔'}
            </button>
          ) : null}
          {zoomConfig?.showButton ? (
            <button
              type="button"
              data-iris-table-zoom=""
              onClick={() => setZoomed((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: zoomed ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={zoomed ? t('table.zoomOut') : t('table.zoomIn')}
              title={zoomed ? t('table.zoomOut') : t('table.zoomIn')}
            >
              {zoomed ? '✕' : '⛶'}
            </button>
          ) : null}
          {chartPreview ? (
            <button
              ref={chartAnchorRef}
              type="button"
              data-iris-chart-trigger=""
              onClick={() => setChartOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: chartOpen ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.chart')}
              title={t('table.chart')}
            >
              ▤
            </button>
          ) : null}
          {auditLog ? (
            <button
              ref={auditAnchorRef}
              type="button"
              data-iris-audit-trigger=""
              onClick={() => setAuditOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: auditOpen ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.audit')}
              title={t('table.audit')}
            >
              ☰
            </button>
          ) : null}
          {versionHistory ? (
            <button
              ref={historyAnchorRef}
              type="button"
              data-iris-history-trigger=""
              onClick={() => setHistoryOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: historyOpen ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.history')}
              title={t('table.history')}
            >
              ⏱
            </button>
          ) : null}
          {perfStats ? (
            <button
              ref={perfAnchorRef}
              type="button"
              data-iris-perf-trigger=""
              onClick={() => setPerfOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: perfOpen ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.perf')}
              title={t('table.perf')}
            >
              ⚡
            </button>
          ) : null}
          {/* Batch CJ (iris 独有): shortcut-hints `?` trigger after the perf
              trigger — opens the read-only keymap reference panel. */}
          {shortcutHints ? (
            <button
              ref={hintsAnchorRef}
              type="button"
              data-iris-shortcut-hints-trigger=""
              onClick={() => setHintsOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: hintsOpen ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.shortcuts')}
              title={t('table.shortcuts')}
            >
              ?
            </button>
          ) : null}
          {/* Batch BR (iris 独有): validationSummary — muted editRules
              commit-outcome ledger (ok = passed and landed, fail = rejected).
              Hidden until at least one outcome is counted; freshness-style
              token stamp, after the perf trigger and before custom buttons. */}
          {validationSummary && validationCounts.ok + validationCounts.fail > 0 ? (
            <span
              data-iris-validation-summary=""
              style={{
                fontSize: 'var(--iris-font-size-xs, 12px)',
                color: 'var(--iris-muted)',
              }}
            >
              {t('table.validationSummary', {
                ok: validationCounts.ok,
                fail: validationCounts.fail,
              })}
            </span>
          ) : null}
          {toolbar?.buttons && toolbar.buttons.length > 0
            ? toolbar.buttons.map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  data-iris-table-toolbar-button={btn.key}
                  {...{ [`data-iris-table-toolbar-button-${btn.key}`]: '' }}
                  onClick={btn.onClick}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--iris-foreground)',
                    fontSize: 'var(--iris-font-size-md, 14px)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--iris-space-xxs, 4px)',
                    padding: '0 var(--iris-space-xxs, 4px)',
                  }}
                  aria-label={btn.label}
                  title={btn.label}
                >
                  {btn.icon ? (
                    <span aria-hidden="true" style={{ fontSize: 'var(--iris-font-size-sm, 13px)' }}>
                      {btn.icon}
                    </span>
                  ) : null}
                  {btn.label}
                </button>
              ))
            : null}
          {views ? (
            <TableViews
              config={views}
              views={tableViews.views}
              activeKey={tableViews.activeKey}
              onSelect={tableViews.selectView}
              onSave={tableViews.saveView}
              onDelete={tableViews.deleteView}
              t={t}
            />
          ) : null}
        </div>
      ) : null}
      {fnr && fnrOpen ? (
        <div
          data-iris-fnr-bar=""
          onKeyDown={(e) => {
            // Only the find input steps matches; Enter in the replace input
            // keeps its default (insert line break) and buttons stay clickable.
            const target = e.target as HTMLElement | null
            if (target?.dataset.irisFnrFind === undefined) return
            if (e.key !== 'Enter') return
            e.preventDefault()
            stepFnrMatch(e.shiftKey ? -1 : 1)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-space-xs, 8px)',
            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            borderBottom: 'none',
            background: 'var(--iris-surface)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          <IrisInput
            ref={fnrFindRef}
            data-iris-fnr-find=""
            value={fnrQuery}
            onChange={(e) => setFnrQuery(e.target.value)}
            placeholder={t('fnr.find')}
            aria-label={t('fnr.find')}
            style={{ width: 180 }}
          />
          <IrisInput
            data-iris-fnr-replace=""
            value={fnrReplace}
            onChange={(e) => setFnrReplace(e.target.value)}
            placeholder={t('fnr.replace')}
            aria-label={t('fnr.replace')}
            style={{ width: 180 }}
          />
          <button
            type="button"
            data-iris-fnr-prev=""
            onClick={() => stepFnrMatch(-1)}
            aria-label={t('fnr.prev')}
            title={t('fnr.prev')}
            style={FNR_BUTTON_STYLE}
          >
            ↑
          </button>
          <button
            type="button"
            data-iris-fnr-next=""
            onClick={() => stepFnrMatch(1)}
            aria-label={t('fnr.next')}
            title={t('fnr.next')}
            style={FNR_BUTTON_STYLE}
          >
            ↓
          </button>
          <button
            type="button"
            data-iris-fnr-replace-btn=""
            onClick={replaceFnrActive}
            style={FNR_BUTTON_STYLE}
          >
            {t('fnr.replace')}
          </button>
          <button
            type="button"
            data-iris-fnr-replace-all=""
            onClick={replaceAllFnrMatches}
            style={FNR_BUTTON_STYLE}
          >
            {t('fnr.replaceAll')}
          </button>
          <button
            type="button"
            data-iris-fnr-close=""
            onClick={() => setFnrOpen(false)}
            aria-label={t('dialog.close')}
            title={t('dialog.close')}
            style={FNR_BUTTON_STYLE}
          >
            ×
          </button>
          <span data-iris-fnr-count="" style={{ color: 'var(--iris-muted)' }}>
            {fnrMatches.length > 0 ? `${fnrActiveIndex + 1}/${fnrMatches.length}` : '0/0'}
          </span>
        </div>
      ) : null}
      <div
        ref={rootRef}
        // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
        // grid/table role as before (treegrid implies managed cell focus).
        role={keyboardNavigation ? (treeMode ? 'treegrid' : 'grid') : 'table'}
        data-iris-table=""
        data-size={size}
        data-printable={printable ? 'true' : undefined}
        data-bordered={bordered ? 'true' : undefined}
        data-striped={striped ? 'true' : undefined}
        data-column-virtualized={columnVirtualization ? 'true' : undefined}
        data-iris-table-fixed-height={fixedHeight ? 'true' : undefined}
        data-iris-table-zoomed={zoomed ? 'true' : undefined}
        data-iris-scrollbar-thin={scrollbarConfig?.theme === 'thin' ? 'true' : undefined}
        data-iris-auto-resize={autoResize ? 'true' : undefined}
        data-iris-no-hover={highlightHoverRow ? undefined : 'true'}
        className={className}
        onKeyDown={
          keyboardNavigation || cellRange || tableShortcuts || rangeFill || query !== undefined
            ? (e) => {
                if (keyboardNavigation) handleGridKey(e)
                if (cellRange) handleCellRangeKey(e)
                if (tableShortcuts) handleTableShortcutKey(e)
                // Batch BG keymap (iris 独有): Ctrl+D fills one step DOWN
                // through the existing range-fill pipeline (zero new mutation
                // logic); Ctrl+K focuses the query input. Both strictly gated
                // on their feature flags — a keymap never enables a disabled
                // feature. First-handler-wins: a root handler that already
                // claimed the key preventDefault'd it, so the fill/query
                // branches (and, via defaultPrevented, the window undo/clip
                // listeners) skip. Never while an inline editor is open — the
                // editor's own keys win (mirrors the sibling gates in
                // handleTableShortcutKey and the undo/clip listeners);
                // without this, Ctrl+D would fill under an uncommitted draft
                // and Ctrl+K would steal focus and close the session.
                if (e.defaultPrevented) return
                if (editTarget.editing !== null || rowEditing !== null) return
                if (rangeFill && matchTableKey(e, keyBindings.fill)) {
                  const range = cellRangeCtrl.getRange()
                  if (range) {
                    e.preventDefault()
                    fillRangeFromHandle(range.end.row + 1, range.end.col)
                  }
                } else if (query !== undefined && matchTableKey(e, keyBindings.query)) {
                  e.preventDefault()
                  queryInputRef.current?.focus()
                }
              }
            : undefined
        }
        onPointerMove={
          rowDrag || columnDrag || rangeFill || selectionDrag
            ? (e) => {
                handleRowDragPointerMove(e)
                handleColDragPointerMove(e)
                handleRangeFillPointerMove(e)
                handleSelectionDragPointerMove(e)
              }
            : undefined
        }
        onPointerUp={
          rowDrag || columnDrag || rangeFill || selectionDrag
            ? (e) => {
                handleRowDragPointerUp()
                resolveColDrag(e.clientX, e.clientY)
                handleRangeFillPointerUp()
                handleSelectionDragPointerUp()
              }
            : undefined
        }
        onPointerLeave={rowDrag ? handleRowDragPointerLeave : undefined}
        onPointerCancel={
          rangeFill || selectionDrag || rowDrag
            ? () => {
                // Aborted drag → drop the target highlight, nothing committed.
                // Re-arm dismissal too (same stale-flag fix as pointerup).
                suppressRangeDismissRef.current = false
                setFillTarget(null)
                // Aborted selection drag: drop the pending press / active
                // anchor (nothing committed) and clear the suppression arm —
                // no trailing click follows a cancel, so an armed flag must
                // not swallow the next click.
                selectionDragSuppressRef.current = false
                selectionDragPendingRef.current = null
                selectionDragAnchorRef.current = null
                selectionDragSeenRef.current = null
                selectionDragPressCellRef.current = null
                // Batch CD: aborted row drag → drop the insertion line + its
                // resolve ref and cancel the controller (previously a
                // pointercancel could leave the row drag stuck in activeId).
                if (rowDrag) {
                  if (rowDragCtrl.getState().activeId !== null) rowDragCtrl.cancel()
                  rowDropRef.current = null
                  setRowDropTarget(null)
                }
              }
            : undefined
        }
        onScroll={
          columnVirtualization
            ? (e) => {
                const el = e.currentTarget as HTMLDivElement
                setScrollLeft(el.scrollLeft)
                // Batch V (vxe scroll parity): extend the virtualization
                // handler to also report the root scroll coordinates.
                onScrollRef.current?.({ scrollTop: el.scrollTop, scrollLeft: el.scrollLeft })
              }
            : undefined
        }
        {...rest}
        style={{
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          border: borderStyle,
          borderRadius:
            bordered && round ? 'var(--iris-radius-lg, 10px)' : 'var(--iris-radius-md, 6px)',
          // Batch P: the `padding` prop overrides every cell's padding through
          // the --iris-cell-pad var (BASE_CELL_STYLE fallback chain).
          ...(padding ? ({ '--iris-cell-pad': padding } as React.CSSProperties) : null),
          // Column virtualization turns the table into a horizontal scroll container.
          overflow: fixedHeight ? 'auto' : columnVirtualization ? 'auto' : 'hidden',
          ...(fixedHeight ? { height, maxHeight, minHeight } : null),
          // Batch Q (vxe auto-resize parity): with no explicit `height` the
          // root uses `height: 100%` so it fills AND tracks its parent (a
          // measured-px pin would freeze the root, and the RO observes the
          // root — later container growth would never be seen). The measure
          // still gates `fixedHeight` above, so the scroll machinery engages
          // once a positive size lands. When `height` IS set the explicit
          // height wins (no visible change).
          ...((autoResize || syncResize) && height === undefined ? { height: '100%' } : null),
          // Batch R (vxe-grid zIndex parity): CSS z-index is inert on static
          // elements, so `position: relative` rides along. Rendered before
          // `...style` — a caller-provided style can still override.
          ...(zIndex !== undefined ? { position: 'relative', zIndex } : null),
          ...style,
          // Batch BU watermark: the layer is sticky, but its containing block
          // is this root — the root must be a positioning context, forced
          // AFTER `...style` so a caller-provided style cannot unanchor the
          // layer (zoom's position: fixed below still wins when zoomed, so
          // the watermark rides the fixed overlay as intended).
          ...(watermark ? { position: 'relative' } : null),
          // Batch CD: the row-drag insertion line is absolutely positioned
          // in this root — same forced-anchor precedent as the BU watermark,
          // also AFTER `...style` so a caller style cannot unanchor it.
          ...(rowDrag ? { position: 'relative' } : null),
          // Batch U zoom (vxe toolbar zoom parity): the stylesheet pins the
          // root fixed (data-iris-table-zoomed); the inline height: 100%
          // keeps the fixed-height machinery engaged so the sticky header
          // and the overlay scroll work exactly like an explicit-height
          // table. position: fixed is forced inline AFTER `...style` so a
          // caller style or the zIndex prop (position: relative) cannot
          // unpin the overlay while zoomed. Zoom wins over caller heights.
          ...(zoomed ? { height: '100%', position: 'fixed' } : null),
        }}
      >
        {/* Batch BU watermark (iris 独有): rotated tiled text over the static
          rows / footer / pager. FIRST child + sticky (top: 0; height: 100%)
          pins it to the scroll viewport from scroll 0 — it stays put while
          rows scroll beneath. Positioned z-auto paints it above static
          content but below the sticky header (z 2), pinned columns (z 1) and
          the floating panels; presence-gated so no prop = zero nodes. */}
        {watermark ? renderTableWatermark(watermark) : null}

        {/* Batch CD row-drag insertion indicator (iris 独有): the 1px primary
          line between rows while a rowDrag is active. Absolute in the root
          (rowDrag forces position: relative AFTER ...style, BU-watermark
          precedent), full-width via logical inset props (RTL-safe), painted
          above the static body but below the sticky header / pinned columns
          (z 2). pointerEvents none so the drag never loses the pointer;
          presence-gated → zero nodes when idle. */}
        {rowDropTarget ? (
          <div
            data-iris-row-drag-indicator=""
            data-iris-row-drag-side={rowDropTarget.side}
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetInlineStart: 0,
              insetInlineEnd: 0,
              height: '1px',
              background: 'var(--iris-primary)',
              top: rowDropTarget.top,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        ) : null}

        {/* Multi-level (grouped) header: a CSS grid of `headerMatrix.length` rows;
          each cell placed by its leaf-column span (colStart/colSpan) and row span. */}
        {showHeader && grouped && headerMatrix ? (
          <div
            role="row"
            data-iris-table-row="header"
            data-iris-table-header-grouped=""
            style={{
              display: 'grid',
              gridTemplateColumns,
              gridTemplateRows: `repeat(${headerMatrix.length}, auto)`,
            }}
          >
            {rowDrag ? (
              <div
                role="columnheader"
                data-iris-table-header="__drag"
                style={{ gridColumn: '1', gridRow: '1 / -1' }}
              />
            ) : null}
            {showRowNumbers ? (
              <div
                role="columnheader"
                data-iris-table-header={seq ? '__seq' : '__row-ref'}
                style={{
                  gridColumn: String((rowDrag ? 1 : 0) + 1),
                  gridRow: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                }}
              />
            ) : null}
            {hasDetail ? (
              <div
                role="columnheader"
                style={{
                  gridColumn: String((rowDrag ? 1 : 0) + (showRowNumbers ? 1 : 0) + 1),
                  gridRow: '1 / -1',
                }}
              />
            ) : null}
            {selectable !== 'none' ? (
              <div
                role="columnheader"
                data-iris-table-header=""
                style={{
                  gridColumn: String(
                    (rowDrag ? 1 : 0) + (showRowNumbers ? 1 : 0) + (hasDetail ? 2 : 1),
                  ),
                  gridRow: '1 / -1',
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                  justifyContent: 'center',
                }}
              >
                {selectable === 'multi' ? (
                  <IrisCheckbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onChange={toggleAll}
                    aria-label={t('table.selectAll')}
                  />
                ) : null}
                {selectable === 'multi' && displaySelection.length > 0 ? (
                  <span
                    data-iris-table-selected-count=""
                    style={{
                      marginInlineStart: 'var(--iris-space-xs, 8px)',
                      fontSize: 'var(--iris-font-size-sm, 13px)',
                      color: 'var(--iris-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('table.selectedCount', { count: String(displaySelection.length) })}
                  </span>
                ) : null}
              </div>
            ) : null}
            {headerMatrix.flatMap((cells) =>
              cells.map((cell) => {
                const col = cell.column
                const isLeaf = !col.children || col.children.length === 0
                const sortable = isLeaf && col.sortable
                const multiIdx =
                  multiSort && sortable ? multiSortState.findIndex((s) => s.key === col.key) : -1
                const isSortKey = sortable && (multiSort ? multiIdx >= 0 : sort?.key === col.key)
                const dir: IrisTableSortDirection | undefined = isSortKey
                  ? multiSort
                    ? multiSortState[multiIdx]!.direction
                    : sort?.direction
                  : undefined
                const lead =
                  (rowDrag ? 1 : 0) +
                  (showRowNumbers ? 1 : 0) +
                  (hasDetail ? 1 : 0) +
                  (selectable !== 'none' ? 1 : 0)
                return (
                  <div
                    key={`${col.key}-${cell.level}`}
                    role="columnheader"
                    data-iris-table-header={col.key}
                    data-iris-table-header-group={isLeaf ? undefined : ''}
                    data-iris-table-pinned={isLeaf ? pinOf(col) : undefined}
                    data-iris-col-drag-active={colDragActive === col.key ? 'true' : undefined}
                    data-iris-col-drag-over={colDragOver === col.key ? 'true' : undefined}
                    className={headerCellClassName?.(col)}
                    title={headerTooltip(col)}
                    onPointerDown={
                      columnDrag && isLeaf ? (e) => handleColDragPointerDown(e, col.key) : undefined
                    }
                    aria-colspan={cell.colSpan}
                    aria-sort={
                      isSortKey
                        ? dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : sortable
                          ? 'none'
                          : undefined
                    }
                    tabIndex={sortable ? 0 : undefined}
                    onClick={
                      sortable
                        ? () => {
                            cycleHeaderSort(col)
                            // vxe header-click parity: informational — after the sort toggle.
                            onHeaderClick?.(col)
                          }
                        : () => onHeaderClick?.(col)
                    }
                    onKeyDown={sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                    onContextMenu={
                      columnPinMenu && isLeaf ? (e) => handleHeaderContextMenu(e, col) : undefined
                    }
                    style={{
                      gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
                      gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
                      ...baseCellStyle,
                      ...(showHeaderOverflow ? null : cellOverflowOverride),
                      justifyContent: isLeaf
                        ? justifyFor(headerAlign ?? col.align ?? 'left')
                        : justifyFor(headerAlign ?? 'center'),
                      background: 'var(--iris-surface)',
                      borderBottom: borderStyle,
                      borderInlineEnd: isLeaf ? 'none' : borderStyle,
                      cursor: sortable ? 'pointer' : 'default',
                      fontWeight: 600,
                      userSelect: sortable ? 'none' : 'auto',
                      ...(headerCellStyle?.(col) ?? null),
                      position: isLeaf ? 'relative' : undefined,
                      // Pinned leaf header keeps a solid surface bg + sticky
                      // position (flat-header precedent; group cells never pin).
                      ...(isLeaf && pinnedStyle(col.key)
                        ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                        : null),
                    }}
                  >
                    <span>
                      {col.titlePrefix}
                      {col.title}
                      {col.titleSuffix}
                    </span>
                    {showCellRefs && isLeaf ? (
                      <span
                        aria-hidden="true"
                        data-iris-cell-ref=""
                        style={{
                          marginInlineStart: 'var(--iris-space-xxs, 4px)',
                          fontSize: 'var(--iris-font-size-xs, 12px)',
                          color: 'var(--iris-muted)',
                          fontWeight: 400,
                        }}
                      >
                        {columnLetter(cell.colStart - 1)}
                      </span>
                    ) : null}
                    {sortable ? (
                      <span
                        aria-hidden="true"
                        data-iris-table-sort-indicator=""
                        style={{
                          marginInlineStart: 'var(--iris-space-xs, 8px)',
                          fontSize: 'var(--iris-font-size-xs, 12px)',
                          color: dir ? 'var(--iris-primary)' : 'var(--iris-muted)',
                        }}
                      >
                        {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
                      </span>
                    ) : null}
                    {renderFilterTrigger(col, isLeaf)}
                    {/* Multi mode: non-primary sort columns show their click-order
                      sequence number (vxe sort-config sequence parity). */}
                    {multiSort && multiIdx > 0 ? (
                      <span
                        data-iris-sort-seq=""
                        style={{
                          marginInlineStart: 'var(--iris-space-xxs, 4px)',
                          fontSize: 'var(--iris-font-size-xs, 12px)',
                          color: 'var(--iris-muted)',
                        }}
                      >
                        {multiIdx + 1}
                      </span>
                    ) : null}
                  </div>
                )
              }),
            )}
          </div>
        ) : showHeader ? (
          /* Header row (flat) */
          <div
            role="row"
            data-iris-table-row="header"
            style={{ display: 'grid', gridTemplateColumns }}
          >
            {rowDrag ? (
              <div
                role="columnheader"
                data-iris-table-header="__drag"
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                }}
              />
            ) : null}
            {showRowNumbers ? (
              <div
                role="columnheader"
                data-iris-table-header={seq ? '__seq' : '__row-ref'}
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                  justifyContent: 'center',
                }}
              />
            ) : null}
            {hasDetail ? (
              <div
                role="columnheader"
                data-iris-table-header="__expand"
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                }}
              />
            ) : null}
            {selectable === 'multi' ? (
              <div
                role="columnheader"
                data-iris-table-header=""
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                  justifyContent: 'center',
                }}
              >
                <IrisCheckbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onChange={toggleAll}
                  aria-label={t('table.selectAll')}
                />
              </div>
            ) : selectable === 'single' ? (
              <div
                role="columnheader"
                data-iris-table-header=""
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                }}
              />
            ) : null}
            {displayColumns.map((col, ci) => {
              if (visibleColSet && !visibleColSet.has(ci)) return null
              // Header merge (batch P): covered cells render null; a merge
              // origin cell gets gridColumnEnd/gridRowEnd spans (row 0 only).
              // Fail-closed under columnVirtualization (JSDoc parity): the
              // visible-window track shift would misalign the spans.
              const mergeActive = !!mergeHeaderCells && !columnVirtualization
              if (mergeActive && headerMergePlan.occupied.has(`0:${ci}`)) return null
              const mergedCell = mergeActive ? headerMergePlan.byCol.get(ci) : undefined
              const multiIdx = multiSort ? multiSortState.findIndex((s) => s.key === col.key) : -1
              const isSortKey = multiSort ? multiIdx >= 0 : sort?.key === col.key
              const dir: IrisTableSortDirection | undefined = isSortKey
                ? multiSort
                  ? multiSortState[multiIdx]!.direction
                  : sort?.direction
                : undefined
              return (
                <div
                  key={col.key}
                  role="columnheader"
                  aria-sort={
                    isSortKey
                      ? dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : col.sortable
                        ? 'none'
                        : undefined
                  }
                  tabIndex={col.sortable ? 0 : undefined}
                  onClick={
                    col.sortable
                      ? () => {
                          cycleHeaderSort(col)
                          setCurrentColumn(col)
                          // vxe header-click parity: informational — after the sort toggle.
                          onHeaderClick?.(col)
                        }
                      : () => {
                          setCurrentColumn(col)
                          onHeaderClick?.(col)
                        }
                  }
                  onKeyDown={col.sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                  onContextMenu={columnPinMenu ? (e) => handleHeaderContextMenu(e, col) : undefined}
                  data-iris-table-header={col.key}
                  data-iris-table-pinned={pinOf(col)}
                  data-iris-col-current={currentColumnKey === col.key ? 'true' : undefined}
                  data-iris-col-drag-active={colDragActive === col.key ? 'true' : undefined}
                  data-iris-col-drag-over={colDragOver === col.key ? 'true' : undefined}
                  onPointerDown={
                    columnDrag ? (e) => handleColDragPointerDown(e, col.key) : undefined
                  }
                  className={headerCellClassName?.(col)}
                  title={headerTooltip(col)}
                  data-sortable={col.sortable ? 'true' : undefined}
                  data-sort-direction={dir}
                  style={{
                    ...baseCellStyle,
                    ...(showHeaderOverflow ? null : cellOverflowOverride),
                    ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                    ...(mergedCell && (mergedCell.colspan ?? 1) > 1
                      ? { gridColumnEnd: `span ${mergedCell.colspan}` }
                      : null),
                    ...(mergedCell && (mergedCell.rowspan ?? 1) > 1
                      ? { gridRowEnd: `span ${mergedCell.rowspan}` }
                      : null),
                    justifyContent: justifyFor(headerAlign ?? col.align ?? 'left'),
                    background: 'var(--iris-surface)',
                    borderBottom: borderStyle,
                    cursor: col.sortable ? 'pointer' : 'default',
                    fontWeight: 600,
                    userSelect: col.sortable ? 'none' : 'auto',
                    ...(headerCellStyle?.(col) ?? null),
                    ...(editConfig?.showAsterisk && col.editRules?.some((r) => r.required)
                      ? { '::after': undefined }
                      : {}),
                    position: 'relative',
                    // Pinned header keeps a solid surface bg + sticky position
                    // (overrides position: relative above for the sticky edge).
                    ...(pinnedStyle(col.key)
                      ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                      : null),
                  }}
                >
                  <span>
                    {col.titlePrefix}
                    {col.title}
                    {col.titleSuffix}
                  </span>
                  {showCellRefs ? (
                    <span
                      aria-hidden="true"
                      data-iris-cell-ref=""
                      style={{
                        marginInlineStart: 'var(--iris-space-xxs, 4px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: 'var(--iris-muted)',
                        fontWeight: 400,
                      }}
                    >
                      {columnLetter(ci)}
                    </span>
                  ) : null}
                  {col.sortable ? (
                    <span
                      aria-hidden="true"
                      data-iris-table-sort-indicator=""
                      style={{
                        marginInlineStart: 'var(--iris-space-xs, 8px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: dir ? 'var(--iris-primary)' : 'var(--iris-muted)',
                      }}
                    >
                      {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
                    </span>
                  ) : null}
                  {renderFilterTrigger(col, true)}
                  {/* Multi mode: non-primary sort columns show their click-order
                    sequence number (vxe sort-config sequence parity). */}
                  {multiSort && multiIdx > 0 ? (
                    <span
                      data-iris-sort-seq=""
                      style={{
                        marginInlineStart: 'var(--iris-space-xxs, 4px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: 'var(--iris-muted)',
                      }}
                    >
                      {multiIdx + 1}
                    </span>
                  ) : null}
                  {resizableColumns ? (
                    <ColumnResizeHandle
                      colKey={col.key}
                      label={col.title}
                      width={columnWidths[col.key]}
                      minWidth={col.minWidth ?? 60}
                      maxWidth={col.maxWidth ?? Infinity}
                      onResize={setColumnWidth}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Body — state precedence: error → loading → empty → rows. */}
        {tableError ? (
          <div role="row" data-iris-table-row="error" style={STATE_ROW_STYLE}>
            <span style={{ marginInlineEnd: retry ? 'var(--iris-space-sm, 12px)' : 0 }}>
              {errorState ?? t('table.error')}
            </span>
            {retry ? (
              <button
                type="button"
                data-iris-table-retry=""
                onClick={retry}
                style={{
                  border: '1px solid var(--iris-border)',
                  background: 'var(--iris-surface)',
                  color: 'var(--iris-foreground)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                  cursor: 'pointer',
                }}
              >
                {t('table.retry')}
              </button>
            ) : null}
          </div>
        ) : tableLoading ? (
          <div role="row" aria-busy="true" data-iris-table-row="loading" style={STATE_ROW_STYLE}>
            {loadingState ?? t('table.loading')}
          </div>
        ) : bodyData.length === 0 ? (
          <div role="row" data-iris-table-row="empty" style={STATE_ROW_STYLE}>
            {renderEmptyState(emptyState, t('table.empty'))}
          </div>
        ) : virtualScroll ? (
          // Virtualize flat, tree, detail AND tree+detail (batch AE): every
          // virtual row occupies one uniform itemHeight slot — tree rows via
          // the flattened `flatTree` meta, detail panels as `kind: 'detail'`
          // plan entries (content taller than the slot scrolls inside the
          // detail cell). `bodyData` is the flattened visible rows (=`sortedData`
          // in flat mode); `flatTree?.[idx]` supplies each row's tree meta
          // (depth + toggle), with `idx` the absolute row index from the
          // scroller. Expansion toggles change `items.length`; the virtualizer
          // rebuilds on count change and re-clamps the scroll (see
          // IrisVirtualScroll's re-clamp effect). Batch BN: `rowHeight` (when
          // set) wins over `virtualScroll.itemHeight` as the slot-height
          // source — number = uniform closed-form window, fn = variable
          // heights through the core offset tree.
          <IrisVirtualScroll
            items={virtualItems}
            itemHeight={effectiveRowHeight ?? virtualScroll.itemHeight}
            height={virtualScroll.height}
            buffer={virtualScroll.buffer}
            keyOf={(item) =>
              item.kind === 'group-header'
                ? `group:${item.groupKey}`
                : item.kind === 'group-summary'
                  ? `group-summary:${item.groupKey}`
                  : item.kind === 'detail'
                    ? `${String(rowKeyOf(item.row, item.rowIndex))}::detail`
                    : String(rowKeyOf(item.row, item.rowIndex))
            }
            renderItem={(item) =>
              item.kind === 'group-header'
                ? renderGroupHeader(item, { height: '100%' })
                : item.kind === 'group-summary'
                  ? renderSummaryRow(item.rows, item.groupKey, { height: '100%' })
                  : item.kind === 'detail'
                    ? renderDetailSlot(item.row, item.rowIndex)
                    : renderRow(
                        item.row,
                        item.rowIndex,
                        { height: '100%' },
                        flatTree?.[item.rowIndex],
                      )
            }
          />
        ) : groupPlan ? (
          // Batch M: grouped body — for each group a full-width header row, the
          // group's rows (existing render path, original bodyData indices), then
          // a per-group summary row when any column has a `summary` op.
          groupPlan.map((entry) => {
            if (entry.kind === 'group-header') return renderGroupHeader(entry)
            if (entry.kind === 'group-summary')
              return (
                <React.Fragment key={`group-summary:${entry.groupKey}`}>
                  {renderSummaryRow(entry.rows, entry.groupKey)}
                </React.Fragment>
              )
            return renderBodyEntry(entry.row, entry.rowIndex)
          })
        ) : (
          bodyData.map((row, idx) => renderBodyEntry(row, idx))
        )}

        {/* Footer stack (batch P): footerMethod rows → summary row →
          footerData rows — whichever render, in that order; footerSpanMethod
          spans across it with a stack-wide 0-based rowIndex. */}
        {renderFooterStack()}

        {/* Server-side pager (vxe-grid proxyConfig parity): driven by the
          controller's page/pageSize/total; page changes call setParams and
          proxyConfig.onPageChange. */}
        {contextMenu && contextMenuState ? (
          <TableContextMenu
            key={contextMenuSeq}
            open={contextMenuState.open}
            anchorRef={contextAnchorRef}
            items={contextMenuState.items}
            params={contextMenuState.params}
            onSelect={(key, params) => {
              // Batch AM: the built-in distribution item never reaches the
              // user callback — it opens the panel at the menu's anchor.
              if (key === DISTRIBUTION_MENU_KEY) openDistribution(params)
              // Batch AW: same interception for the built-in summary item.
              else if (key === SUMMARY_MENU_KEY) openSummary(params)
              // Batch BB: annotate add/edit open the annotate panel at the
              // same anchor; the remove item deletes the cell's note.
              else if (key === ANNOTATE_MENU_KEY || key === ANNOTATE_EDIT_MENU_KEY)
                openAnnotate(params)
              else if (key === ANNOTATE_REMOVE_MENU_KEY) {
                const k = rowKeyOf(params.row, params.rowIndex)
                removeAnnotationKey(cellId(k, params.column.key))
              } else if (key === COPY_VALUE_MENU_KEY) copyContextValue(params)
              else if (key === CLEAR_CELL_MENU_KEY) clearContextCell(params)
              else contextMenu.onSelect(key, params)
            }}
            onClose={closeContextMenu}
          />
        ) : null}
        {/* Column header pin menu (batch BX, iris 独有): a second, independent
          floating instance gated by `columnPinMenu` — same TableContextMenu
          host, virtual cursor anchor, ONE built-in item per the column's
          CURRENT pin state. Every key is intercepted here (the pin menu has
          no user items); `setColumnPinned` handles the dual channel. */}
        {columnPinMenu && pinMenuState ? (
          <TableContextMenu
            key={`pin-${pinMenuSeq}`}
            open={pinMenuState.open}
            anchorRef={pinMenuAnchorRef}
            items={
              pinOf(pinMenuState.col)
                ? [{ key: UNPIN_MENU_KEY, label: t('table.unpin') }]
                : [{ key: PIN_LEFT_MENU_KEY, label: t('table.pinLeft') }]
            }
            params={{
              row: undefined as unknown as Row,
              column: pinMenuState.col,
              rowIndex: -1,
              columnIndex: leafColumns.findIndex((c) => c.key === pinMenuState.col.key),
            }}
            onSelect={(key) => {
              if (key === PIN_LEFT_MENU_KEY) setColumnPinned(pinMenuState.col.key, 'left')
              else if (key === UNPIN_MENU_KEY) setColumnPinned(pinMenuState.col.key, null)
            }}
            onClose={closePinMenu}
          />
        ) : null}
        {distributionState ? (
          <TableDistributionPanel
            key={`distribution-${distributionSeq}`}
            open={distributionState.open}
            anchorRef={distributionAnchorRef}
            columnTitle={distributionState.columnTitle}
            rows={bodyData}
            valueKey={distributionState.colKey}
            onClose={closeDistribution}
            t={t}
          />
        ) : null}
        {summaryState ? (
          <TableSummaryPanel
            key={`summary-${summarySeq}`}
            open={summaryState.open}
            anchorRef={summaryAnchorRef}
            columnTitle={summaryState.columnTitle}
            rows={bodyData}
            valueKey={summaryState.colKey}
            onClose={closeSummary}
            t={t}
          />
        ) : null}
        {annotateState ? (
          <TableAnnotatePanel
            key={`annotate-${annotateSeq}`}
            open={annotateState.open}
            anchorRef={annotateAnchorRef}
            cellKey={annotateState.cellKey}
            current={annotations?.[annotateState.cellKey]}
            onSave={(text) => saveAnnotation(annotateState.cellKey, text)}
            onRemove={() => removeAnnotationKey(annotateState.cellKey)}
            onClose={closeAnnotate}
            t={t}
          />
        ) : null}
        {notePopover && noteHover ? (
          <TableNotePopover
            open
            anchorRef={noteHoverAnchorRef}
            cellKey={noteHover.cellKey}
            text={noteHover.text}
            onClose={closeNotePopover}
          />
        ) : null}
        {chartPreview && chartOpen ? (
          <TableChartPanel
            open
            anchorRef={chartAnchorRef}
            rows={filteredData}
            columns={chartNumericColumns}
            onClose={() => setChartOpen(false)}
            t={t}
          />
        ) : null}
        {auditLog && auditOpen ? (
          <TableAuditPanel
            open
            anchorRef={auditAnchorRef}
            audit={audit}
            onClear={() => audit.clear()}
            onClose={() => setAuditOpen(false)}
            t={t}
          />
        ) : null}
        {versionHistory && historyOpen ? (
          <TableVersionHistoryPanel
            open
            anchorRef={historyAnchorRef}
            history={history}
            onRestore={(index) => {
              restoreVersion(index)
              setHistoryOpen(false)
            }}
            onClose={() => setHistoryOpen(false)}
            t={t}
          />
        ) : null}
        {perfStats && perfOpen ? (
          <TablePerfPanel
            open
            anchorRef={perfAnchorRef}
            perf={perf}
            audit={auditLog ? audit : null}
            onClose={() => setPerfOpen(false)}
            t={t}
          />
        ) : null}
        {shortcutHints && hintsOpen ? (
          <TableShortcutHintsPanel
            open
            anchorRef={hintsAnchorRef}
            bindings={keyBindings}
            onClose={() => setHintsOpen(false)}
            t={t}
          />
        ) : null}
        {cellRange && activeRange ? (
          <RangeToolbar
            key={rangeToolbarSeq}
            open
            anchorRef={rangeToolbarAnchorRef}
            onCopy={copyActiveRange}
            onExport={() => void downloadCsv('table-range.csv', exportActiveRangeCsv())}
            onClear={clearActiveRange}
            onDismiss={dismissRange}
            t={t}
            statsOpen={rangeStatsOpen}
            onToggleStats={() => setRangeStatsOpen((o) => !o)}
            stats={rangeStatsData}
          />
        ) : null}
        {filterPanelState
          ? (() => {
              const fcol = displayColumns.find((c) => c.key === filterPanelState.colKey)
              if (!fcol || !fcol.filterable) return null
              return (
                <TableFilterPanel
                  key={filterPanelSeq}
                  open={filterPanelState.open}
                  anchorRef={filterAnchorRef}
                  columnKey={fcol.key}
                  options={fcol.filterOptions ?? []}
                  initialChecked={filterValues?.[fcol.key] ?? []}
                  onApply={applyFilterValues}
                  onClear={clearFilterValues}
                  onClose={closeFilterPanel}
                  t={t}
                  recent={recentFilters ? recent.list() : []}
                  onApplyRecent={applyRecentFilter}
                  columns={displayColumns}
                />
              )
            })()
          : null}
        {proxy && layouts?.pager !== 'hidden' ? (
          <div
            data-iris-table-pager=""
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
              borderTop: borderStyle,
              background: 'var(--iris-surface)',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}
            >
              {pagerConfig?.showTotal ? (
                <span
                  data-iris-table-total=""
                  style={{ color: 'var(--iris-muted)', whiteSpace: 'nowrap' }}
                >
                  {t('table.total', { total: proxyState.total })}
                </span>
              ) : null}
              {pagerConfig?.pageSizes && pagerConfig.pageSizes.length > 0 ? (
                <IrisSelect
                  items={pagerConfig.pageSizes.map((s) => ({
                    value: String(s),
                    label: `${s} / ${t('table.page')}`,
                  }))}
                  value={String(proxyState.params.pageSize)}
                  onValueChange={(v) => {
                    const size = Number(v)
                    proxyRef.current?.setParams({ pageSize: size, page: 1 })
                    proxyConfig?.onPageChange?.(1, size)
                  }}
                  aria-label={t('table.pageSize')}
                />
              ) : null}
              <IrisPagination
                total={proxyState.total}
                pageSize={proxyState.params.pageSize}
                value={proxyState.params.page}
                onValueChange={(page) => {
                  proxyRef.current?.setParams({ page })
                  proxyConfig?.onPageChange?.(page, proxyState.params.pageSize)
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
