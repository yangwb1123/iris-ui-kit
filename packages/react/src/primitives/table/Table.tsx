import * as React from 'react'
import {
  aggregate,
  buildFormValues,
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
} from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { IrisInput } from '../input/Input'
import { IrisButton } from '../button/Button'
import { useStore } from '../../useStore'
import {
  cloneRowInList,
  columnLetter,
  createCellEdit,
  createSortable,
  detectColumnType,
  insertRowInList,
  matchTableKey,
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
  type DetectedColumnType,
  type FormulaTables,
  type SortableRect,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { usePrefersReducedMotion } from '../../motion'
import { TableForm, TablePager } from './table-chrome'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type { IrisTableDensity, IrisTableProps } from './props'
import type { IrisTableHandle } from './types'
import { downloadCsv, exportCsv, applyCellMask } from './exportCsv'
import { compareStates as compareStatesDiff } from '@iris-ui-kit/core'
import { TableChartPanel } from './ChartPanel'
import { TableAuditPanel } from './AuditPanel'
import { TableEditHistoryPanel } from './EditHistoryPanel'
import { TableVersionHistoryPanel } from './VersionHistoryPanel'
import { TablePerfPanel } from './PerfPanel'
import { TableShortcutHintsPanel } from './ShortcutHintsPanel'
import {
  COLUMN_TOTALS_STYLE,
  DEFAULT_PINNED_WIDTH,
  EXPAND_COL_WIDTH,
  SELECTION_COL_WIDTH,
  STATE_ROW_STYLE,
} from './styles'
import { TABLE_ROW_CSS } from './table-css'
import {
  cellNoteState,
  copyTargetAttr,
  copyTargetCellStyle,
  dirtyCellState,
  dirtyKey,
  isCopyTargetCell,
  isRangeCopyGripCell,
  justifyFor,
  notePopoverCellHandlers,
  presenceOf,
  presenceStyle,
  rangeCopyCellStyle,
  renderCellNoteBadge,
  renderPresenceLabels,
  renderRangeCopyGrip,
  renderSparkline,
  renderTableWatermark,
  resolveCopyTarget,
  rowHeightStyleOf,
  sparklineCell,
  sparklineSeries,
  type IrisRangeCopyTarget,
  type SparklineData,
} from './cell-helpers'
import { EditorSurface } from './editor-surface'
export { autoHeightSize } from './editor-surface'
import { renderEmptyState } from './empty-state'
import { TableAnnotatePanel, TableNotePopover } from './annotation-panels'
import {
  applySearchHighlight,
  conditionalCellStyle,
  contextCellText,
  fnrCellStyle,
  parseFnrQuery,
  patternHintStyle,
  readClipboardText,
  renderAutoLinkCell,
  replaceAllOccurrences,
  writeClipboardText,
  type PatternEditActive,
} from './clipboard-display-helpers'
import {
  ColumnResizeHandle,
  isValidColumnWidth,
  leftPinnedCount,
  measureColumnContentWidth,
  pinnedCountFromBudget,
  PinnedDragHandle,
  resolvedColumnWidth,
} from './column-layout'
import {
  cellPermissionRender,
  csvRangeCell,
  hasEditRules,
  isCellLocked,
  isCellReadonly,
  isEditableColumn,
  sameRowList,
  serializeRefRows,
  tsvCell,
  withComputedFormulaCells,
} from './table-value-helpers'
import { mergeFilterValues, mergeQueryIntoFilters, nextRowMajorCell } from './table-query-helpers'
import { buildComparisonCsv } from './comparison-export'
import { useTableProxy } from './useTableProxy'
import { useTableColumns } from './useTableColumns'
import { TableGroupHeader, type TableGroupHeaderEntry } from './group-header'
import { TableSummaryRow } from './summary-row'
import { TableFooterStack, useFooterCellSpan } from './footer-stack'
import { TableFilterTrigger } from './filter-trigger'
import {
  auditDiff,
  charCountCellStyle,
  cellContentIsTruncated,
  clampReorderZone,
  copyFlashCellAttr,
  copyFlashCellStyle,
  expandAnimAttr,
  findTableRowEl,
  isColDragOutLeft,
  isRangeFillHandleCell,
  isRangeMoveGripCell,
  nextDensity,
  previewColumnsFromRows,
  rangeFillCellStyle,
  rangeFillTargetAttr,
  rangeMoveCellStyle,
  renderRangeCharCountBadge,
  renderRangeFillHandle,
  renderRangeMoveGrip,
  resolveRowDragDrop,
  sameStringSet,
  singleKeyDiff,
  virtualItemKeyOf,
  type BodyPlanEntry,
} from './interaction-helpers'
import {
  ANNOTATE_EDIT_MENU_KEY,
  ANNOTATE_MENU_KEY,
  ANNOTATE_REMOVE_MENU_KEY,
  CLEAR_CELL_MENU_KEY,
  COPY_FLASH_MS,
  COPY_VALUE_MENU_KEY,
  DISTRIBUTION_MENU_KEY,
  DRAG_COL_WIDTH,
  EMPTY_QUERY_PARSE,
  FNR_BUTTON_STYLE,
  FORMAT_NUMBER_MENU_KEY,
  FORMAT_UPPER_MENU_KEY,
  getCellValue,
  getFormulaValue,
  PIN_LEFT_MENU_KEY,
  ROW_TARGET_MS,
  SEQ_COL_WIDTH,
  setCurrentFormulaTables,
  SUMMARY_MENU_KEY,
  UNPIN_MENU_KEY,
  coerceEditDraft,
} from './table-constants'

// Layout measurement must happen before paint in the browser, but React's
// server renderer cannot encode useLayoutEffect. Keep the tooltip bridge
// SSR-safe without weakening its client-side timing.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

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
  IrisTableContextMenuParams,
  IrisTableEvent,
  IrisTablePresenceEntry,
  IrisTableSortDirection,
  IrisTableFilterValues,
  IrisTablePersistPiece,
  IrisTablePersistedState,
  IrisTableSortState,
} from './types'

export type { IrisTableProps, IrisTableProxyConfig } from './props'

// ── Batch DV: URL state deep-link (iris 独有 — vxe has no URL-state) ────
// `urlState` serializes the view state into ONE `_table` query param. The wire
// format is a versioned JSON object (`{v:1, sort?, sorts?, filters?,
// filterValues?, page?, pageSize?}`) — `sorts` is the multiSort channel
// (multiSort mode only); `page`/`pageSize` are proxy-only. Decode is
// WHOLE-STATE fail-closed: schema version + per-piece type guards — any
// violation → null, never a partial restore. Encoding uses URLSearchParams
// (set/get are symmetric, exactly-once percent-decoding), preserving every
// other param.
/** URL-state snapshot (batch DV): the pieces `urlState` reads/writes in the
 * `_table` query param. Mirror of `IrisTablePersistedState` minus the
 * layout/expansion pieces — a deep link carries what affects served rows. */
export interface IrisTableUrlState {
  /** Wire schema version — decode rejects anything else (forward-compat). */
  v: 1
  /** Single-column sort (omitted when inactive; null never encoded). */
  sort?: IrisTableSortState | null
  /** Multi-column sort list (multiSort mode only, non-empty). */
  sorts?: IrisTableSortState[]
  /** Text filters (column key → filter text, non-empty map only). */
  filters?: Record<string, string>
  /** Checked filter sets (column key → values, non-empty map only). */
  filterValues?: IrisTableFilterValues
  /** 1-based page (proxy only; omitted when 1). */
  page?: number
  /** Rows per page (proxy only). */
  pageSize?: number
}

/** Query-param key that carries the whole payload. */
export const IRIS_URL_STATE_KEY = '_table'

function isUrlSortState(v: unknown): v is IrisTableSortState {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const s = v as Record<string, unknown>
  return (
    typeof s.key === 'string' && s.key !== '' && (s.direction === 'asc' || s.direction === 'desc')
  )
}

function isUrlStringMap(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  for (const value of Object.values(v)) {
    if (typeof value !== 'string') return false
  }
  return true
}

function isUrlStringArrayMap(v: unknown): v is IrisTableFilterValues {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  for (const value of Object.values(v)) {
    if (!Array.isArray(value)) return false
    for (const item of value) {
      if (typeof item !== 'string') return false
    }
  }
  return true
}

/** Whole-state fail-closed decode of a `_table` payload: corrupt JSON, wrong
 * schema version, or ANY invalid piece → null (never a partial restore). */
export function decodeUrlTableState(raw: string): IrisTableUrlState | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (record.v !== 1) return null
  const out: IrisTableUrlState = { v: 1 }
  if (record.sort !== undefined) {
    if (record.sort !== null && !isUrlSortState(record.sort)) return null
    out.sort = record.sort as IrisTableSortState | null
  }
  if (record.sorts !== undefined) {
    if (!Array.isArray(record.sorts) || !record.sorts.every(isUrlSortState)) return null
    out.sorts = record.sorts as IrisTableSortState[]
  }
  if (record.filters !== undefined) {
    if (!isUrlStringMap(record.filters)) return null
    out.filters = record.filters as Record<string, string>
  }
  if (record.filterValues !== undefined) {
    if (!isUrlStringArrayMap(record.filterValues)) return null
    out.filterValues = record.filterValues as IrisTableFilterValues
  }
  if (record.page !== undefined) {
    if (typeof record.page !== 'number' || !Number.isInteger(record.page) || record.page < 1) {
      return null
    }
    out.page = record.page
  }
  if (record.pageSize !== undefined) {
    if (
      typeof record.pageSize !== 'number' ||
      !Number.isInteger(record.pageSize) ||
      record.pageSize < 1
    ) {
      return null
    }
    out.pageSize = record.pageSize
  }
  return out
}

/** Read + decode the current URL's `_table` param. SSR-guarded: no window →
 * null. Returns null when the param is absent OR the payload is invalid. */
export function readUrlTableState(): IrisTableUrlState | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get(IRIS_URL_STATE_KEY)
  if (raw === null) return null
  return decodeUrlTableState(raw)
}

/** Current raw `_table` param value (the same exactly-once-decoded value the
 * writer serializes — used for idempotent write-skip comparison). */
function readUrlTableParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(IRIS_URL_STATE_KEY)
}

/** Replace the `_table` param (preserving every other param) via
 * `history.replaceState` — never pushes history entries. `null` removes it. */
export function writeUrlTableState(value: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(IRIS_URL_STATE_KEY)
  else url.searchParams.set(IRIS_URL_STATE_KEY, value)
  window.history.replaceState(null, '', url.toString())
}

/** Canonical JSON of a payload (fixed field order, so equal states compare
 * byte-equal). A payload with no pieces serializes to null — the URL's
 * `_table` is then removed. */
export function serializeUrlTableState(state: IrisTableUrlState | null): string | null {
  if (!state) return null
  const hasPiece =
    state.sort !== undefined ||
    state.sorts !== undefined ||
    state.filters !== undefined ||
    state.filterValues !== undefined ||
    state.page !== undefined ||
    state.pageSize !== undefined
  if (!hasPiece) return null
  return JSON.stringify(state)
}

// ── Batch EA back-to-top (iris 独有 — vxe has no back-to-top) ────────
// The floating ↑ button appears once the effective scroller (the fixed-height
// root, or the virtual-scroll viewport when present) passes this threshold — a
// pure threshold flip, no per-pixel state churn (React bails out on a repeated
// boolean).
const SCROLL_TOP_VISIBLE_PX = 200

/** Sticky zero-height endcap: pins the button to the bottom of the scroll
 * viewport (an absolute box would ride the content — the BU watermark
 * precedent); z 3 paints above the sticky header (z 2) / pinned columns
 * (z 1) but below the floating panels. pointerEvents none — the zero-height
 * strip never eats a click. */
const BACK_TOP_ANCHOR_STYLE: React.CSSProperties = {
  position: 'sticky',
  insetBlockEnd: 0,
  height: 0,
  pointerEvents: 'none',
  zIndex: 3,
}

/** 40×40 round ↑ button, bottom-right corner via logical inset props
 * (RTL-safe), token-driven colors/shadow/font — the IrisBackTop recipe
 * (scrollTo-with-fallback, reduced-motion → 'auto', backTop.label i18n)
 * adapted to a container-anchored position. */
const BACK_TOP_BUTTON_STYLE: React.CSSProperties = {
  position: 'absolute',
  insetBlockEnd: 24,
  insetInlineEnd: 24,
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-surface, var(--iris-background))',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  boxShadow: 'var(--iris-shadow-md)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--iris-font-size-xl, 18px)',
  pointerEvents: 'auto',
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
  density,
  densityToggle = false,
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
  autoDetectTypes,
  summaryRowStyle = 'default',
  aggregateAccuracy,
  highlightHoverRow = true,
  showHeaderOverflow = true,
  showFooterOverflow = true,
  watermark,
  height,
  minHeight,
  maxHeight,
  scrollbarConfig,
  scrollbarThumb = false,
  scrollToTop = false,
  headerStats = false,
  editDirtyConfig,
  autoResize = false,
  syncResize = false,
  responsive = false,
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
  onTableEvent,
  bordered = true,
  round = false,
  padding,
  resizableColumns = false,
  widthHint = false,
  autoResizeColumns = false,
  columnWidths: columnWidthsProp,
  defaultColumnWidths,
  onColumnWidthsChange,
  columnWidthsReset,
  columnPinMenu,
  pinnedColumns,
  onColumnPinnedChange,
  pinnedDrag = false,
  onPinnedCountChange,
  onRowClick,
  onRowDblClick,
  onCellEdit,
  onEditStart,
  onEditClosed,
  editAutosave,
  onAutosave,
  editAutoHeight,
  charCount,
  editPreview,
  pattern = false,
  patternFill = false,
  columnTotals,
  expandScrollPreserve = false,
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
  rowDragBetween,
  columnDrag,
  columnVisibility,
  onColumnVisibilityChange,
  columnFade = false,
  columnOrder,
  onColumnOrderChange,
  filters,
  onFiltersChange,
  filterValues,
  onFilterValuesChange,
  formConfig,
  toolbar,
  zoomConfig,
  importPreview,
  layouts,
  tooltipConfig,
  annotations,
  cellNote,
  notePopover,
  annotationEditing,
  onAnnotationsChange,
  exportAnnotations,
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
  editSidebar,
  compareWith,
  autoLink = false,
  recentFilters = false,
  formulaTables,
  exportNames,
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
  expandAnimation = false,
  keyboardNavigation = false,
  tableShortcuts = false,
  editKeys,
  keymap,
  hotkeyScope = true,
  outerScope = false,
  groupBy,
  groupCollapsed,
  defaultGroupCollapsed,
  onGroupCollapseChange,
  cellRange = false,
  rangeFill = false,
  cellDrag = false,
  cellDragCopy = false,
  clipConfig,
  pasteOptions,
  fnr = false,
  searchHighlight,
  undo = false,
  checkboxRange = false,
  selectionDrag = false,
  virtualScroll,
  rowHeight,
  persistState,
  autoSaveState,
  urlState = false,
  views,
  onActiveViewChange,
  tableTabs,
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
  const rowDragEnabled = rowDrag !== undefined || (rowDragBetween?.length ?? 0) > 0
  // Batch DW (iris 独有): unified event stream — ONE subscription merging the
  // cell/row/sort/filter/edit/expand event families. Mirror ref (established
  // onEditStartRef pattern) so mount-time closures (useTableSort, cellEdit,
  // the expansion model) always read the latest handler. The funnel emits
  // AFTER each dedicated callback — a bridge, not a behavior.
  const onTableEventRef = React.useRef(onTableEvent)
  onTableEventRef.current = onTableEvent
  const emitTableEvent = <K extends IrisTableEvent<Row>['type']>(
    type: K,
    detail: Extract<IrisTableEvent<Row>, { type: K }>['detail'],
  ): void => {
    onTableEventRef.current?.({ type, detail })
  }
  // Batch BN (iris 独有): ONE throat for per-row heights — `rowHeight` wins
  // over `virtualScroll.itemHeight`; unset = existing behavior byte-identical
  // (virtual mode falls back to the virtualizer's itemHeight, non-virtual
  // rows keep natural content height). Consumers: renderBodyEntry (inline
  // height), IrisVirtualScroll (slot height source) and PageUp/PageDown
  // (paging step) — all three read this same resolved source.
  const effectiveRowHeight = rowHeight ?? virtualScroll?.itemHeight
  // Batch CL: detail/tree expand animation (iris 独有) — inert in virtual
  // mode: lazy slots mount on scroll and would replay the animation (and the
  // hot path stays untouched). Fail-closed when the prop is off.
  const expandAnimOn = expandAnimation === true && !virtualScroll
  // Batch BC: scope the external tables for this render — every getCellValue
  // / querySortedData evaluation below runs synchronously during THIS render,
  // and React's render walk is atomic per component (assigned before any
  // useMemo body executes; a StrictMode double-render re-assigns idempotently).
  // On-demand handle calls (CSV export) bypass this slot via formulaTablesRef.
  setCurrentFormulaTables(formulaTables)
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('iris-table-row-styles')) return
    const style = document.createElement('style')
    style.id = 'iris-table-row-styles'
    style.textContent = TABLE_ROW_CSS
    document.head.appendChild(style)
  }, [])

  // ── Batch DY: column show/hide fade machine (iris 独有 — vxe has no
  // show/hide transition) ───────────────────────────────────────
  // `columnVisibility` is parent-owned; the machine only decides how a change
  // REACHES the render. Each toggled column gets an overlay entry with a
  // direction and a two-phase clock:
  //   'out': hide — the column STAYS mounted (the effective visibility map
  //     keeps it true) while its track collapses Wpx→0px and opacity 1→0,
  //     then the commit timer drops the overlay entry and the real (hidden)
  //     prop takes over (cells unmount, track removed).
  //   'in': show — the column joins the render at a 0px track + opacity 0
  //     (pending phase), then restores both over the same window; at commit
  //     the entry is dropped (the prop already says visible) with zero visual
  //     change.
  // `pending` is the FIRST paint (the machine's starting layout); `run` is
  // the transition target. The double-rAF flip guarantees the browser painted
  // the pending layout before the target replaces it (React commits the
  // layout-effect-triggered re-render before paint). ONE FADE_DURATION_MS
  // commit timer applies to every entry in flight. Mount-hidden columns never
  // animate (the first diff only records the base map); a mid-fade revert
  // replaces the entry and restarts the fade in the new direction. Reduced
  // motion disables the machine entirely (instant show/hide) — plus the CSS
  // reduced-motion freeze gate in table-css.ts as a backstop.
  const reducedMotion = usePrefersReducedMotion()
  const [fadeOverlay, setFadeOverlay] = React.useState<
    Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }>
  >({})
  const fadeOverlayRef = React.useRef(fadeOverlay)
  fadeOverlayRef.current = fadeOverlay
  const columnVisibilityRef = React.useRef(columnVisibility)
  columnVisibilityRef.current = columnVisibility
  const prevVisibilityRef = React.useRef<Record<string, boolean> | undefined>(undefined)
  const fadeFlipRafRef = React.useRef<number | null>(null)
  const fadeCommitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // Aligned to the `--iris-duration-md, 200ms` fallback the CSS uses; a skin
  // that overrides the token also stretches the CSS transition (documented).
  const FADE_DURATION_MS = 200

  const fadeFlip = (
    current: Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }>,
  ): Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }> | undefined => {
    let changed = false
    const next: Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }> = {}
    for (const [key, entry] of Object.entries(current)) {
      if (entry.phase === 'pending') {
        next[key] = { dir: entry.dir, phase: 'run' }
        changed = true
      } else next[key] = entry
    }
    return changed ? next : undefined
  }
  const fadeCommit = (
    current: Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }>,
  ): Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }> | undefined => {
    let changed = false
    const next: Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }> = {}
    for (const [key, entry] of Object.entries(current)) {
      const committedVisible = (columnVisibilityRef.current ?? {})[key] !== false
      const done = entry.dir === 'out' ? !committedVisible : committedVisible
      if (done) changed = true
      else next[key] = entry
    }
    return changed ? next : undefined
  }

  // Diff the visibility map against the LAST COMMITTED one (not the overlay),
  // so a reversal mid-fade still sees the flip: hide('a') → show('a') while
  // the 'out' entry is in flight replaces it with 'in' (restart semantic).
  React.useLayoutEffect(() => {
    const next = columnVisibilityRef.current ?? {}
    if (prevVisibilityRef.current === undefined) {
      prevVisibilityRef.current = next // mount: record the base, never animate
      return
    }
    const prev = prevVisibilityRef.current
    prevVisibilityRef.current = next
    if (!columnFade || reducedMotion) return
    const overlay = { ...fadeOverlayRef.current }
    let dirty = false
    for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      const was = prev[key] !== false // sparse map: absence = visible
      const is = next[key] !== false
      if (was === is) continue
      overlay[key] = is ? { dir: 'in', phase: 'pending' } : { dir: 'out', phase: 'pending' }
      dirty = true
    }
    if (!dirty) return
    setFadeOverlay(overlay)
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      // Fail-closed: no rAF (SSR) → drop the overlay; the committed
      // visibility map renders immediately (instant show/hide, vxe parity).
      setFadeOverlay({})
      return
    }
    if (fadeFlipRafRef.current === null) {
      fadeFlipRafRef.current = window.requestAnimationFrame(() => {
        fadeFlipRafRef.current = window.requestAnimationFrame(() => {
          fadeFlipRafRef.current = null
          setFadeOverlay((current) => fadeFlip(current) ?? current)
        })
      })
    }
    if (fadeCommitTimerRef.current !== null) clearTimeout(fadeCommitTimerRef.current)
    fadeCommitTimerRef.current = setTimeout(() => {
      fadeCommitTimerRef.current = null
      setFadeOverlay((current) => fadeCommit(current) ?? current)
    }, FADE_DURATION_MS)
  }, [columnFade, reducedMotion, columnVisibility])

  // Machine off (prop off / reduced motion): drop any in-flight overlay so the
  // committed visibility map renders as-is, and re-base the diff.
  React.useEffect(() => {
    if (columnFade && !reducedMotion) return
    prevVisibilityRef.current = columnVisibilityRef.current ?? {}
    setFadeOverlay({})
  }, [columnFade, reducedMotion])

  // Unmount: cancel pending rAF flip + commit timer (no leaks across tests).
  React.useEffect(() => {
    return () => {
      if (fadeFlipRafRef.current !== null) window.cancelAnimationFrame(fadeFlipRafRef.current)
      if (fadeCommitTimerRef.current !== null) clearTimeout(fadeCommitTimerRef.current)
    }
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
  // The root ref is shared by every size-sensitive bridge (virtual columns,
  // auto/sync resize and narrow-width responsive fit). Keeping one ref also
  // means the responsive observer measures the exact element that receives
  // the overflow style below.
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  // Tooltip cells are measured after layout only when showAll is explicitly
  // false.  The callback map keeps ref identities stable across renders (an
  // inline ref would cause a null/node pair on every render and repeatedly
  // schedule measurements).  Virtual rows register as they enter the window.
  const tooltipCellRefs = React.useRef(new Map<string, HTMLElement>())
  const tooltipRefCallbacks = React.useRef(new Map<string, (node: HTMLElement | null) => void>())
  const tooltipMeasureRaf = React.useRef<number | null>(null)
  const [tooltipMeasureVersion, setTooltipMeasureVersion] = React.useState(0)
  const [truncatedTooltipCells, setTruncatedTooltipCells] = React.useState<Set<string>>(
    () => new Set(),
  )
  const scheduleTooltipMeasure = React.useCallback(() => {
    if (tooltipMeasureRaf.current !== null) return
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTooltipMeasureVersion((version) => version + 1)
      return
    }
    tooltipMeasureRaf.current = window.requestAnimationFrame(() => {
      tooltipMeasureRaf.current = null
      setTooltipMeasureVersion((version) => version + 1)
    })
  }, [])
  const tooltipCellRefOf = React.useCallback(
    (id: string): ((node: HTMLElement | null) => void) => {
      const existing = tooltipRefCallbacks.current.get(id)
      if (existing) return existing
      const callback = (node: HTMLElement | null): void => {
        if (node) tooltipCellRefs.current.set(id, node)
        else tooltipCellRefs.current.delete(id)
        if (!node) tooltipRefCallbacks.current.delete(id)
        scheduleTooltipMeasure()
      }
      tooltipRefCallbacks.current.set(id, callback)
      return callback
    },
    [scheduleTooltipMeasure],
  )
  const [responsiveWidth, setResponsiveWidth] = React.useState(0)
  // Batch DY: the fade machine's overlay keeps mid-fade columns in the render —
  // pass it merged on top of the parent's map so `displayColumns` keeps a
  // hiding column mounted until COMMIT, and a showing column is mounted from
  // its first 0px frame. No useTableColumns signature change (same prop).
  const effectiveColumnVisibility = React.useMemo(() => {
    if (Object.keys(fadeOverlay).length === 0) return columnVisibility
    const merged = { ...(columnVisibility ?? {}) }
    for (const key of Object.keys(fadeOverlay)) merged[key] = true
    return merged
  }, [columnVisibility, fadeOverlay])
  const {
    hasDetail,
    safeColumns,
    presetColumns,
    setDetectedTypes,
    detectTypesRef,
    orderedColumns,
    displayColumns,
    columnWidths,
    setColumnWidth,
    resetColumnWidths,
    pinOf,
    setColumnPinned,
    responsiveDisplayColumns,
    responsiveOverflow,
    grouped,
    leafColumns,
    viewColumnsRef,
    headerMatrix,
  } = useTableColumns<Row>({
    columns: columns ?? [],
    renderDetail,
    responsive,
    responsiveWidth,
    rowDrag: rowDragEnabled,
    showRowNumbers,
    selectable,
    autoDetectTypes,
    columnOrder,
    columnVisibility: effectiveColumnVisibility,
    columnWidths: columnWidthsProp,
    defaultColumnWidths,
    onColumnWidthsChange,
    pinnedColumns,
    onColumnPinnedChange,
  })
  // Batch DY: expand the overlay — keyed by TOP-LEVEL column keys (matching
  // `columnVisibility`) — down to leaf keys, so a grouped parent's fade
  // drives ALL of its leaf tracks + leaf cells as one column. Top-level keys
  // that are already leaves map to themselves.
  const fadeByLeaf = React.useMemo(() => {
    if (Object.keys(fadeOverlay).length === 0) return {}
    const out: Record<string, { dir: 'in' | 'out'; phase: 'pending' | 'run' }> = {}
    for (const [key, entry] of Object.entries(fadeOverlay)) {
      const top = orderedColumns.find((c) => c.key === key)
      if (!top) continue
      const leaves = top.children && top.children.length > 0 ? flattenLeafColumns([top]) : [top]
      for (const leaf of leaves) out[leaf.key] = entry
    }
    return out
  }, [fadeOverlay, orderedColumns])
  // Per-cell fade surface: attr for the test/DOM contract, inline opacity 0
  // ONLY on the fade's starting phase. `top-level match first` lets a grouped
  // parent header (not in fadeByLeaf) fade alongside its leaves.
  const columnFadeAttr = (col: IrisTableColumn<Row>): 'in' | 'out' | undefined => {
    const overlayEntry = fadeOverlay[col.key]
    if (overlayEntry) return overlayEntry.dir
    return fadeByLeaf[col.key]?.dir
  }
  const columnFadeStyle = (col: IrisTableColumn<Row>): React.CSSProperties | null => {
    const entry = fadeOverlay[col.key] ?? fadeByLeaf[col.key]
    if (!entry) return null
    const hidden = entry.dir === 'out' ? entry.phase === 'run' : entry.phase === 'pending'
    return hidden ? { opacity: 0 } : null
  }
  const columnFadeActive = columnFade && Object.keys(fadeOverlay).length > 0
  // Column visibility (vxe columnConfig.visible parity): filter hidden
  // columns out of every render path (header, body, summary).
  //
  // Column order (vxe customConfig parity, batch S): a controlled key list
  // that reorders the rendered stack. Keys not named in the order keep their
  // relative position AFTER the ordered ones; unknown order keys are
  // ignored. Reference-preserving: without the prop the result IS
  // `safeColumns` (byte-identical with the pre-order render path). Grouped
  // tables address top-level columns only.
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
  // The framework-free controller and its external-store bridge live in a
  // dedicated hook; this component keeps only lifecycle policy and rendering.
  const remoteSort = proxyConfig?.remoteSort === true
  const remoteFilter = proxyConfig?.remoteFilter === true
  const { proxyRef, createProxySource, proxy, proxyState, tableLoading, tableError, retry } =
    useTableProxy<Row>({
      proxyConfig,
      remoteSort,
      remoteFilter,
      sortProp,
      defaultSort,
      multiSort,
      multiSortState: multiSortStateProp,
      defaultMultiSort,
      filters,
      filterValues,
      queryParsed,
      loading,
      error,
      onRetry,
    })

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
  // Batch DV (urlState): the CURRENT URL's `_table` payload, parsed ONCE during
  // the first render (guarded, idempotent — usePersistState precedent) so the
  // proxy-creation effect can inject page/pageSize BEFORE the first query
  // (URL wins over persistState — the pre-query pageSize channel precedent).
  const urlParsedRef = React.useRef<IrisTableUrlState | null>(null)
  const urlParsedLoadedRef = React.useRef(false)
  if (!urlParsedLoadedRef.current) {
    urlParsedLoadedRef.current = true
    urlParsedRef.current = readUrlTableState()
  }
  React.useEffect(() => {
    let ctrl = proxyRef.current
    if (!ctrl && hasProxy) {
      ctrl = createProxySource()
      proxyRef.current = ctrl
      forceRender()
    }
    if (ctrl) {
      // Batch AG (persistState) + batch DV (urlState): apply the restored
      // page/pageSize + notify BEFORE the default first query — a URL payload
      // WINS over persisted state on conflicts (deep-link intent, the
      // pre-query pageSize channel precedent). request(partial) applies the
      // params and fires exactly ONE query — setParams alone would re-request
      // on its own, double-fetching with the request below. Skipped without
      // proxyConfig.onPageChange (documented: pageSize is only meaningful
      // with it) and when nothing was restored.
      if (!persistPageSizeAppliedRef.current) {
        persistPageSizeAppliedRef.current = true
        const urlState = urlParsedRef.current
        const size =
          (urlState && typeof urlState.pageSize === 'number' && urlState.pageSize > 0
            ? urlState.pageSize
            : undefined) ?? persistParsedRef.current?.pageSize
        if (typeof size === 'number' && size > 0 && proxyConfig?.onPageChange) {
          const page = urlState && typeof urlState.page === 'number' ? urlState.page : 1
          proxyConfig.onPageChange(page, size)
          void ctrl.request({ pageSize: size, page })
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

  // Batch CX (iris 独有): auto-detect column types — ONE-SHOT on the FIRST
  // non-empty liveData arrival (mount-time `data`, the first proxy page, or
  // the first post-hydration data). Each leaf column's kind is inferred by
  // the core `detectColumnType` over its first 50 non-nullish values; the
  // `detectedColumns` memo above then fills align + sortType only where the
  // caller left them undefined. The ref guard makes it one-shot per mount —
  // later data re-feeds / edit write-backs never re-detect (a column's kind
  // is a structural declaration, not per-page noise; in proxy mode the
  // inference thus samples the FIRST page only). Formula columns are skipped
  // — their sortType is the caller's contract on the COMPUTED value (batch
  // AO). SSR-safe: effects never run during renderToString, so server HTML
  // is byte-identical and the fill lands post-hydration.
  React.useEffect(() => {
    if (!autoDetectTypes || detectTypesRef.current) return
    if (liveData.length === 0) return
    detectTypesRef.current = true
    const next: Record<string, DetectedColumnType> = {}
    for (const col of flattenLeafColumns(presetColumns)) {
      if (col.formula) continue
      next[col.key] = detectColumnType(liveData.map((row) => getCellValue(row, col)))
    }
    setDetectedTypes(next)
  }, [autoDetectTypes, liveData, presetColumns])

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
  // Batch DU: export gate + latest annotation sources for the mount-time
  // handle (exportAnnotationsCsv runs on demand, NOT during render — mirror
  // pattern of filteredDataRef/bodyDataRef above). The annotations map and
  // cellNote callback are props, render-scoped; without refs the mount
  // closure would freeze the FIRST render's annotation state.
  const exportAnnotationsRef = React.useRef(exportAnnotations)
  exportAnnotationsRef.current = exportAnnotations
  const annotationsRef = React.useRef(annotations)
  annotationsRef.current = annotations
  const cellNoteRef = React.useRef(cellNote)
  cellNoteRef.current = cellNote
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
      emitTableEvent('sort-change', { sort: next })
      // remoteSort parity: sort changes re-query the server (page resets to 1
      // in the core controller, vxe behavior).
      if (remoteSort) proxyRef.current?.setParams({ sort: next })
    },
    multiSort,
    multiSortState: multiSortStateProp,
    defaultMultiSort,
    onMultiSortChange: (next) => {
      onMultiSortChange?.(next)
      emitTableEvent('multi-sort-change', { sorts: next })
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
        let va = getFormulaValue(col.formula, a)
        let vb = getFormulaValue(col.formula, b)
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
  // (batch CY: the hasDetail declaration itself now lives above the column
  // memos — the responsive width model reads it there; same value.)
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
      onChange: (keys) => {
        onExpandedRowsChange?.(keys)
        emitTableEvent('expanded-rows-change', { expandedKeys: keys })
      },
    })
  }
  const expansion = expansionRef.current
  const expandedKeys = useStore(expansion.store)
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail && (rowExpandable ? rowExpandable(row, idx) : true)

  // Batch CS: expandScrollPreserve (iris 独有) — virtual tables keep the
  // CONTENT anchor (the first visible plan entry + its partial offset) in
  // place across an expansion commit. Pixel scrollTop alone survives the
  // virtualizer rebuild (IrisVirtualScroll's local state), but a node/detail
  // panel expanded ABOVE the viewport shifts every row below by the inserted
  // height — the rows being read jump. Uniform slot heights only (a fn
  // `rowHeight`/`itemHeight` makes the offset tree child-internal →
  // pixel-only preserve); non-virtual tables are inert (documented fiat).
  const slotHeight = effectiveRowHeight ?? virtualScroll?.itemHeight
  const expandScrollOn =
    expandScrollPreserve === true &&
    virtualScroll !== undefined &&
    typeof slotHeight === 'number' &&
    slotHeight > 0
  // Latest viewport scrollTop — IrisVirtualScroll owns the scroll state and
  // the Table does NOT re-render on scroll, so the onScroll wiring below
  // mirrors it into this ref (the transition layout effect reads it).
  const virtualScrollTopRef = React.useRef(0)
  // The recorded content anchor { key, relativeTop } from the last STABLE
  // plan — the transition render skips the re-record so the pre-toggle anchor
  // survives into the transition layout effect. `relativeTop` is the anchor
  // slot's offset past the viewport top (∈ [0, slotHeight)).
  const preserveAnchorRef = React.useRef<{ key: string; relativeTop: number } | null>(null)
  // Expanded keys at the last commit — the render phase reads it to skip
  // anchor recording on the transition render; the layout effect advances it.
  const prevExpandedKeysRef = React.useRef<string[]>(expandedKeys)

  // Batch CY: the column width + pin state above (near safeColumns) is the
  // single throat — see the HOISTED blocks; this old site is intentionally
  // empty so every reader including the responsive fit sees one pinOf.

  // ── Pinned-count boundary drag (batch CV, iris 独有 — vxe has no pinned
  // boundary handle): `pinnedDrag` renders a draggable separator at the LAST
  // left-pinned leaf header's trailing edge. Left-only count — the boundary
  // exists only while ≥1 leaf is pinned left, and never crosses the first
  // right-pinned index (the hard cap). Widths approximate through
  // resolvedColumnWidth (pinnedOffsets' fallback chain — fiat). `resolve`
  // maps a drag dx (boundary displacement) to a count via pinnedCountFromBudget
  // (resolve(0) = the CURRENT count, used by the keyboard nudge); `commit`
  // writes `setColumnPinned('left' | null)` per CHANGED column (the SAME dual-
  // channel throat as the pin menu — controlled parents get
  // `onColumnPinnedChange` per column, no optimistic flip) and fires
  // `onPinnedCountChange` once; no-op drags fire nothing.
  const firstRightPinnedIndex = React.useMemo(() => {
    const i = leafColumns.findIndex((col) => pinOf(col) === 'right')
    return i < 0 ? leafColumns.length : i
  }, [leafColumns, pinOf])
  const pinnedBoundaryCol = React.useMemo(() => {
    if (!pinnedDrag) return null
    for (let i = firstRightPinnedIndex - 1; i >= 0; i -= 1) {
      const col = leafColumns[i]!
      if (pinOf(col) === 'left') return col
    }
    return null
  }, [pinnedDrag, leafColumns, pinOf, firstRightPinnedIndex])
  const resolvePinnedCount = React.useCallback(
    (dx: number): number => {
      const widthOf = (col: IrisTableColumn<Row>): number => resolvedColumnWidth(col, columnWidths)
      // `current` is the leading PREFIX count — the SAME notion commit uses
      // (leftPinnedCount). In a gapped state [A(left), B(null), C(left)] the
      // boundary handle sits on C (last left-pinned leaf) but the count is 1;
      // the budget must start from the PREFIX width only, so resolve(0) ===
      // current in EVERY state and a no-op drag / arrow press commits nothing
      // (pinning B + unpinning C on a zero-dx click was the pre-fix bug).
      const current = leftPinnedCount(leafColumns, pinOf, firstRightPinnedIndex)
      let currentWidth = 0
      for (let i = 0; i < current; i += 1) {
        currentWidth += widthOf(leafColumns[i]!)
      }
      return pinnedCountFromBudget(leafColumns, widthOf, currentWidth + dx, firstRightPinnedIndex)
    },
    [leafColumns, firstRightPinnedIndex, columnWidths, pinOf],
  )
  const commitPinnedCount = React.useCallback(
    (count: number): void => {
      if (!pinnedDrag) return
      const clamped = Math.max(0, Math.min(firstRightPinnedIndex, count))
      const current = leftPinnedCount(leafColumns, pinOf, firstRightPinnedIndex)
      if (clamped === current) return
      for (let i = 0; i < firstRightPinnedIndex; i += 1) {
        const col = leafColumns[i]!
        const target: 'left' | null = i < clamped ? 'left' : null
        if (pinOf(col) === target) continue
        setColumnPinned(col.key, target)
      }
      onPinnedCountChange?.(clamped)
    },
    [pinnedDrag, leafColumns, firstRightPinnedIndex, pinOf, setColumnPinned, onPinnedCountChange],
  )

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
  // Batch DM: periodic full-state snapshots deliberately use their own
  // storage/key and the same JSON contract as exportStateJson. Restore runs
  // before the first timer tick so the mount snapshot is never overwritten.
  const autoSaveInterval = autoSaveState?.intervalMs ?? 0
  const autoSaveStorage = autoSaveState?.storage
  const autoSaveKey = autoSaveState?.key ?? 'iris-table-auto-state'
  React.useEffect(() => {
    if (!Number.isFinite(autoSaveInterval) || autoSaveInterval <= 0) return
    if (autoSaveStorage === false) return
    let storage: Pick<Storage, 'getItem' | 'setItem'> | null = autoSaveStorage ?? null
    if (!storage && typeof window !== 'undefined') {
      try {
        storage = window.localStorage
      } catch {
        storage = null
      }
    }
    if (!storage || typeof window === 'undefined') return
    try {
      const saved = storage.getItem(autoSaveKey)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          applyViewSnapshotRef.current(parsed as IrisTablePersistedState)
        }
      }
    } catch {
      // Storage/JSON failures must never break table rendering.
    }
    const save = (): void => {
      try {
        const snapshot = { ...persistSnapshotRef.current }
        delete (snapshot as { multiSortState?: unknown }).multiSortState
        storage?.setItem(autoSaveKey, JSON.stringify(snapshot))
      } catch {
        // Quota/security failures are intentionally fail-inert.
      }
    }
    const timer = window.setInterval(save, autoSaveInterval)
    return () => window.clearInterval(timer)
  }, [autoSaveInterval, autoSaveKey, autoSaveStorage])
  // Parse runs during the first render (guarded, idempotent); mirror the
  // parsed snapshot into the ref the proxy-creation effect reads above.
  const persistParsed = usePersistState({
    config: persistState,
    state: persistSnapshot,
    restorePiece: restorePersistPiece,
  })
  persistParsedRef.current = persistParsed.parsed

  // ── URL state deep-link (batch DV, iris 独有 — vxe has no URL-state) ────
  // `urlState` mirrors the SELECTED view-state pieces into the browser URL's
  // single `_table` query param (deep-linkable / shareable). Declared AFTER
  // the persistState block so on mount conflicts the URL payload wins. Every
  // piece goes through the SAME per-piece callback gates as
  // `restorePersistPiece` — both directions: encode what can be restored
  // (sort → onSortChange; sorts → multiSort + onMultiSortChange; filters →
  // onFiltersChange; filterValues → onFilterValuesChange; page/pageSize →
  // proxyConfig.onPageChange, proxy-only). An uncontrolled piece is inert
  // both ways — the URL never claims a channel the table cannot replay.
  const urlStateOn = urlState === true
  const urlMountAppliedRef = React.useRef(false)
  const urlLastAppliedRef = React.useRef<string | null>(null)
  /** Replay the NON-pager pieces through the shared gated restore channel. */
  const applyUrlPieces = React.useCallback(
    (state: IrisTableUrlState): void => {
      if (state.sort !== undefined) restorePersistPiece('sort', state.sort)
      if (state.sorts !== undefined) restorePersistPiece('multiSortState', state.sorts)
      if (state.filters !== undefined) restorePersistPiece('filters', state.filters)
      if (state.filterValues !== undefined) restorePersistPiece('filterValues', state.filterValues)
    },
    [restorePersistPiece],
  )
  /** Mid-session page/pageSize reproduction (`applyViewSnapshot` pageSize
   * precedent): notify + exactly ONE request. `page` defaults to 1 and
   * `pageSize` to the proxy default when the payload omits either. */
  const applyUrlPager = React.useCallback(
    (state: IrisTableUrlState): void => {
      const pageChange = proxyConfig?.onPageChange
      if (!pageChange) return
      const page = typeof state.page === 'number' && state.page > 0 ? state.page : 1
      const size =
        typeof state.pageSize === 'number' && state.pageSize > 0
          ? state.pageSize
          : (proxyConfig?.pageSize ?? 10)
      pageChange(page, size)
      void proxyRef.current?.request({ pageSize: size, page })
    },
    [proxyConfig, proxyRef],
  )
  // Mount restore — []-deps with the first-render `urlState` closure; declared
  // AFTER the persist restore (inside usePersistState) so the URL wins on
  // conflicts. page/pageSize are NOT re-applied here: the proxy-creation
  // effect injected them pre-query (exactly one request for an app-start deep
  // link). `urlLastAppliedRef` records the payload so the listener's mount
  // activation (same URL) is an idempotent no-op.
  React.useEffect(() => {
    if (!urlState) return
    const parsed = urlParsedRef.current
    if (!parsed) return
    applyUrlPieces(parsed)
    urlLastAppliedRef.current = serializeUrlTableState(parsed)
    urlMountAppliedRef.current = true
  }, [])
  // URL write — declared after the mount restore so the restored values land
  // first; the first post-restore run is skipped (the restored parent state
  // re-renders and rewrites the URL with the final values — what can be
  // restored is what gets saved). Empties remove `_table`; unchanged payloads
  // skip the replaceState.
  React.useEffect(() => {
    if (!urlStateOn) return
    if (urlMountAppliedRef.current) {
      urlMountAppliedRef.current = false
      return
    }
    // A fully-uncontrolled table (urlState on, ZERO owning callbacks) never
    // writes the URL — a seeded `_table` deep link survives a urlState-only
    // view. The persistState precedent ("Nothing the parent owns → nothing to
    // write") applies verbatim: the URL must not claim a channel the table
    // cannot replay. "Empties remove `_table`" still holds for tables that DO
    // own a channel but currently have nothing to encode.
    const ownsChannel =
      (multiSort ? onMultiSortChange : onSortChange) ||
      onFiltersChange ||
      onFilterValuesChange ||
      (Boolean(proxy) && Boolean(proxyConfig?.onPageChange))
    if (!ownsChannel) return
    const payload: IrisTableUrlState = { v: 1 }
    if (multiSort) {
      if (onMultiSortChange && multiSortState.length > 0) payload.sorts = multiSortState
    } else if (onSortChange && sort) {
      payload.sort = sort
    }
    if (onFiltersChange && filters && Object.keys(filters).length > 0) payload.filters = filters
    if (onFilterValuesChange && filterValues && Object.keys(filterValues).length > 0) {
      payload.filterValues = filterValues
    }
    if (proxy && proxyConfig?.onPageChange) {
      const page = proxyState.params.page
      const size = proxyState.params.pageSize
      if (typeof page === 'number' && page > 1) payload.page = page
      // The proxy default size is the URL's omission threshold — a fresh app
      // start carries NO pager channel at all (empty state removes `_table`),
      // while a user-chosen size round-trips exactly.
      if (typeof size === 'number' && size > 0 && size !== (proxyConfig.pageSize ?? 10)) {
        payload.pageSize = size
      }
    }
    const json = serializeUrlTableState(payload)
    if (json === readUrlTableParam()) return
    writeUrlTableState(json)
  })
  // Mid-session restore: `hashchange` (spec — a pasted/edited share link while
  // the app is open) + `popstate` (documented extension for back/forward). The
  // same serialized-payload idempotency makes an identical URL a no-op; a
  // missing/invalid `_table` is a no-op; application goes through the shared
  // gated channels (pieces × pager reproduction — one request).
  React.useEffect(() => {
    if (!urlStateOn) return
    const apply = (): void => {
      const parsed = readUrlTableState()
      if (!parsed) return
      const serialized = serializeUrlTableState(parsed)
      if (serialized === urlLastAppliedRef.current) return
      applyUrlPieces(parsed)
      applyUrlPager(parsed)
      urlLastAppliedRef.current = serialized
    }
    apply()
    window.addEventListener('hashchange', apply)
    window.addEventListener('popstate', apply)
    return () => {
      window.removeEventListener('hashchange', apply)
      window.removeEventListener('popstate', apply)
    }
  }, [urlStateOn, applyUrlPieces, applyUrlPager])

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

  // ── Table tabs (batch CT, iris 独有 — vxe has no parity) ──────────
  // A role=tablist strip rendered ABOVE the toolbar: clicking a tab applies
  // each view name in `views` IN ORDER through the SAME selectView path the
  // toolbar select uses (unknown names are skipped fail-inert; overlapping
  // pieces resolve in order — later views win, and the toolbar select always
  // mirrors the last applied view). Active tab is internal state — nothing is
  // active until the first click; without the prop the strip never renders
  // and this state never moves (fail-closed). Duplicate keys keep the first
  // occurrence (React key identity and the apply path both read the deduped
  // list).
  const tabs = React.useMemo(
    () => (tableTabs ?? []).filter((tab, i, arr) => arr.findIndex((t) => t.key === tab.key) === i),
    [tableTabs],
  )
  const [activeTabKey, setActiveTabKey] = React.useState<string | null>(null)
  const applyTab = React.useCallback(
    (key: string): void => {
      setActiveTabKey(key)
      const tab = tabs.find((t) => t.key === key)
      for (const name of tab?.views ?? []) tableViews.selectView(name)
    },
    [tabs, tableViews.selectView],
  )

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
  // Single shared coercion — delegates to the module-level coerceEditDraft so
  // the commit/validate path and the batch-CQ live preview can never drift
  // apart on a future editor type.
  const coerceValueFor = (row: Row, col: IrisTableColumn<Row>, draft: unknown): unknown =>
    coerceEditDraft(row, col, draft)
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
  // Batch DH: pattern-edit hint (iris 独有) — resolve the active column + live
  // draft from the shared cell-edit store once per render, so every matching
  // cell in that column highlights AND updates live per keystroke (zero new
  // state). Row-edit mode drafts live in per-column sessions, so row mode is
  // intentionally excluded (documented fiat).
  const patternEdit: PatternEditActive | null =
    (pattern || patternFill) && editingTarget !== null
      ? { columnKey: editingTarget.columnKey, draft: editTarget.draft }
      : null
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
        // Batch DC (iris 独有 — vxe has no frozen-zone-aware reorder): clamp
        // the drop into the dragged column's OWN pin zone through the SAME
        // `pinOf` throat as pinnedOffsets — a pinned column can reorder
        // among its frozen siblings but a cross-zone drop clamps to the
        // zone edge instead of corrupting the sticky offsets. A clamp that
        // lands back on the source index is a net-zero move (only reachable
        // via clamping — a lone-zone drag) and skips onReorder, same
        // precedent as the row drag's net-zero skip.
        const clampedTo = clampReorderZone(next, from, to, (c) => pinOf(c) ?? 'free')
        if (clampedTo !== from) {
          const [moved] = next.splice(from, 1)
          next.splice(clampedTo, 0, moved)
          columnDrag.onReorder(next as IrisTableColumn<Row>[])
          // Batch DK (iris 独有 — vxe has no frozen-zone reorder): emit the
          // new top-level key list through `onColumnOrderChange` TOO — the
          // same durable channel the settings panel uses — so a header
          // frozen-zone reorder is persistable for controlled parents on top
          // of the drag's `onReorder`. Gated to FLAT leaf tables (`columnOrder`
          // is top-level-scoped, so grouped leaf swaps keep `onReorder` only)
          // and to a PINNED mover: the clamp above guarantees a pinned column
          // stays within its own frozen zone (spec's "target also pinned" is
          // the natural subset), while free-zone reorders stay onReorder-only
          // (byte-identical preservation). Full new key list — never undefined.
          if (!grouped && pinOf(moved) !== null && onColumnOrderChange) {
            onColumnOrderChange(next.map((c) => c.key))
          }
        }
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
  // Batch CP density (iris 独有 — vxe has no density concept): local cycling
  // state while the toolbar toggle is shown (zoom precedent) — effective =
  // toggle ? state : prop; invalid prop values fail closed to comfortable.
  const [densityState, setDensityState] = React.useState<IrisTableDensity>('comfortable')
  const densityProp: IrisTableDensity =
    density === 'compact' || density === 'cozy' ? density : 'comfortable'
  const effectiveDensity: IrisTableDensity = densityToggle ? densityState : densityProp
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
  // Batch DB: edit-history sidebar open state (the ⏳ trigger toggles a
  // fixed right-side panel — no anchor: it pins to the viewport edge).
  const [editSidebarOpen, setEditSidebarOpen] = React.useState(false)
  // Batch BL: perf panel open state + toolbar trigger anchor (floating like
  // the audit/chart panels).
  const [perfOpen, setPerfOpen] = React.useState(false)
  const perfAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  // Batch CJ: shortcut-hints panel open state + toolbar trigger anchor (the
  // `?` button after the perf trigger; floating like the chart/audit panels).
  const [hintsOpen, setHintsOpen] = React.useState(false)
  const hintsAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  const importFileRef = React.useRef<HTMLInputElement | null>(null)
  // Batch CW import preview (iris 独有 — vxe has no pre-import preview):
  // when `importPreview` is on, the parsed rows are held in local state and
  // shown in a centered modal BEFORE `onImport` fires; confirm calls
  // `onImport` with the FULL payload, cancel / Esc / backdrop close with
  // zero calls. null = closed. Re-seeded per selection (the file input's
  // value is cleared below, so re-picking the same file re-triggers).
  const [importPreviewRows, setImportPreviewRows] = React.useState<
    Record<string, unknown>[] | null
  >(null)
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
      // Batch CW gate: `importPreview` splits exactly at the call — parse and
      // row-build are unchanged; off means byte-identical direct import.
      if (importPreview) {
        setImportPreviewRows(rows)
      } else {
        toolbar.onImport?.(rows)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  const confirmImportPreview = () => {
    if (!importPreviewRows) return
    toolbar?.onImport?.(importPreviewRows)
    setImportPreviewRows(null)
  }
  const cancelImportPreview = () => setImportPreviewRows(null)
  const importPreviewColumns = previewColumnsFromRows(importPreviewRows)
  // Esc closes the preview while it is open only (zoom precedent — no global
  // listener otherwise).
  React.useEffect(() => {
    if (!importPreviewRows) return
    const onWindowKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setImportPreviewRows(null)
    }
    window.addEventListener('keydown', onWindowKey)
    return () => window.removeEventListener('keydown', onWindowKey)
  }, [importPreviewRows])
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

  // Batch DQ: external drop zones belong to the parent. Hit-testing stays
  // framework-free at the DOM bridge, and the matching callback is resolved
  // from the latest prop on every pointer event.
  const externalRowDropAt = (x: number, y: number): { onDrop: (row: Row) => void } | null => {
    if (!rowDragBetween || typeof document === 'undefined') return null
    const elementFromPoint = document.elementFromPoint
    if (!elementFromPoint) return null
    const target = elementFromPoint.call(document, x, y)
    const zone = target?.closest<HTMLElement>('[data-iris-drop-zone]')
    const key = zone?.getAttribute('data-iris-drop-zone')
    if (key === null || key === undefined) return null
    const entry = rowDragBetween.find((candidate) => candidate.key === key)
    return entry ? { onDrop: entry.onDrop } : null
  }

  const handleRowDragPointerDown = (e: React.PointerEvent, rowId: string) => {
    if (!rowDragEnabled || e.button !== 0) return
    e.preventDefault()
    rowDragCtrl.press(rowId, e.clientX, e.clientY)
  }

  const handleRowDragPointerMove = (e: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    if (!rowDragEnabled) return
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
      if (externalRowDropAt(e.clientX, e.clientY)) {
        rowDragCtrl.over(null)
        rowDropRef.current = null
        setRowDropTarget(null)
        return
      }
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

  const handleRowDragPointerUp = (e?: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    if (!rowDragEnabled) return
    if (rowDragCtrl.isPending()) {
      rowDragCtrl.cancel()
      // Batch CD cleanup: an aborted tap still clears the line + refs.
      rowDropRef.current = null
      setRowDropTarget(null)
      return
    }
    const activeBeforeEnd = rowDragCtrl.getState().activeId
    const external = activeBeforeEnd !== null && e ? externalRowDropAt(e.clientX, e.clientY) : null
    if (activeBeforeEnd !== null && external) {
      const row = bodyDataRef.current.find(
        (candidate, index) => String(rowKeyOf(candidate, index)) === activeBeforeEnd,
      )
      rowDragCtrl.end()
      rowDropRef.current = null
      setRowDropTarget(null)
      rowRectsRef.current = []
      if (row) external.onDrop(row)
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
        rowDrag?.onReorder(rows)
      }
    }
    rowRectsRef.current = []
  }

  const handleRowDragPointerLeave = () => {
    // Batch CD cleanup: leave aborts the drag AND clears the line + refs.
    if (rowDragEnabled && rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.cancel()
    }
    rowDropRef.current = null
    setRowDropTarget(null)
  }

  React.useEffect(() => {
    if (!rowDragBetween || rowDragBetween.length === 0 || rowDragActiveId === null) return
    const onMove = (e: PointerEvent): void => handleRowDragPointerMove(e)
    const onUp = (e: PointerEvent): void => handleRowDragPointerUp(e)
    const onCancel = (): void => {
      if (rowDragCtrl.getState().activeId !== null) rowDragCtrl.cancel()
      rowDropRef.current = null
      setRowDropTarget(null)
      rowRectsRef.current = []
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [rowDragActiveId, rowDragBetween])

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
    const next = { ...(filterValues ?? {}), [colKey]: values }
    onFilterValuesChange?.(next)
    emitTableEvent('filter-value-change', { filterValues: next })
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
    emitTableEvent('filter-value-change', { filterValues: next })
  }
  // Batch BW: 复制值 — the clicked cell's display text (mask → formatter →
  // String, the `contextCellText` chain shared with cellTooltip) via the
  // existing safe clipboard writer (three-channel, no-op when no clipboard).
  const copyContextValue = (params: IrisTableContextMenuParams<Row>): void => {
    void writeClipboardText(contextCellText(params.row, params.column, getCellValue))
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
  // Batch DO: format the live cell range (or the clicked cell when no range is
  // active) in one write-back. Formula, locked and readonly cells are
  // display-only; non-matching values remain byte-identical.
  const formatContextSelection = (
    params: IrisTableContextMenuParams<Row>,
    mode: 'number' | 'upper',
  ): void => {
    const range = cellRangeCtrl.getRange()
    const start = range?.start ?? { row: params.rowIndex, col: params.columnIndex }
    const end = range?.end ?? start
    const rows = bodyDataRef.current
    const cols = liveLeafRef.current
    const current = externalDataRef.current ?? []
    let next = current
    for (let rowIndex = start.row; rowIndex <= end.row; rowIndex += 1) {
      const row = rows[rowIndex]
      if (!row) continue
      const key = rowKeyOf(row, rowIndex)
      if (key == null) continue
      for (let columnIndex = start.col; columnIndex <= end.col; columnIndex += 1) {
        const col = cols[columnIndex]
        if (!col || col.formula || isCellLocked(row, col) || isCellReadonly(row, col)) continue
        const value = getCellValue(row, col)
        const formatted =
          mode === 'number'
            ? typeof value === 'number' && Number.isFinite(value)
              ? value.toFixed(2)
              : value
            : typeof value === 'string'
              ? value.toUpperCase()
              : value
        if (formatted !== value) next = setCellValue(next, rowKey, key, col.key, formatted)
      }
    }
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
    // Batch DO: region formatters are opt-in so the existing context-menu
    // contract remains unchanged unless callers request them explicitly.
    if (contextMenu.formatActions) {
      if (!items.some((i) => i.key === FORMAT_NUMBER_MENU_KEY)) {
        items.push({ key: FORMAT_NUMBER_MENU_KEY, label: t('table.formatNumber') })
      }
      if (!items.some((i) => i.key === FORMAT_UPPER_MENU_KEY)) {
        items.push({ key: FORMAT_UPPER_MENU_KEY, label: t('table.formatUpper') })
      }
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
    emitTableEvent('edit-start', { row, column: col, rowIndex })
  }
  const cancelEdit = () => {
    cellEdit.cancelEdit()
    // Batch V (vxe edit-closed parity): the session ended without a commit.
    const ctx = editCtxRef.current
    if (ctx) {
      onEditClosedRef.current?.({
        row: ctx.row,
        column: ctx.col,
        rowIndex: ctx.rowIndex,
        cancelled: true,
      })
      emitTableEvent('edit-cancel', {
        row: ctx.row,
        column: ctx.col,
        rowIndex: ctx.rowIndex,
        cancelled: true,
      })
    }
  }
  const commitEdit = (): boolean => {
    const ok = commitWithSummaryIntent(cellEdit)
    if (ok) {
      // Batch V (vxe edit-closed parity): committed — the store's validated
      // slot holds the coerced committed value (getDraft is cleared).
      const ctx = editCtxRef.current
      if (ctx) {
        const value = cellEdit.getValidated()
        onEditClosedRef.current?.({
          row: ctx.row,
          column: ctx.col,
          rowIndex: ctx.rowIndex,
          value,
          cancelled: false,
        })
        emitTableEvent('edit-commit', {
          row: ctx.row,
          column: ctx.col,
          rowIndex: ctx.rowIndex,
          value,
          cancelled: false,
        })
      }
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
    const params = { row, column: col, rowIndex: idx, columnIndex: ci }
    onCellClick?.(params)
    emitTableEvent('cell-click', params)
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
  // Batch CZ goToRow (iris 独有 — vxe has no locate flash): the transient
  // row-target highlight timer. The handle runs against the MOUNT-time
  // closure (only refs are read), so this ref is the sole mutable channel —
  // same pattern as the copy-flash timer; the cleanup below is the unmount
  // cancel (the DOM node goes away with the table).
  const rowTargetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    return () => {
      if (rowTargetTimerRef.current !== null) {
        clearTimeout(rowTargetTimerRef.current)
        rowTargetTimerRef.current = null
      }
    }
  }, [])
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
    // viewColumnsRef holds leafColumns: flat mode follows the display list
    // (and the responsive fitted list when active), while grouped mode carries
    // the data-bearing leaves, so the CSV keeps leaf data in both modes.
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
    // Batch DT: explicit row-key export uses the same current body order and
    // serializer as selection export, but does not depend on checkbox state.
    exportRowsCsv: (keys) => {
      const wanted = new Set(keys)
      const rows = bodyDataRef.current.filter((row, i) => wanted.has(rowKeyOf(row, i)))
      if (rows.length === 0) return ''
      return exportCsv(
        withComputedFormulaCells(rows, viewColumnsRef.current, formulaTablesRef.current),
        viewColumnsRef.current,
      )
    },
    getSelection: () => [...displaySelectionRef.current],
    // Batch DI (iris 独有): multi-segment CSV — the current table block + one
    // ref block per exportNames entry, joined by a blank line. Reads the
    // on-demand ref mirrors (exportNamesRef / filteredDataRef / viewColumnsRef /
    // formulaTablesRef) so a mount-time handle sees post-rerender state.
    // empty/absent exportNames → bare current-table CSV (byte-identical to
    // exportCurrentViewCsv, zero regression).
    exportMultiCsv: () => {
      const names = exportNamesRef.current
      const current = exportCsv(
        withComputedFormulaCells(
          [...filteredDataRef.current],
          viewColumnsRef.current,
          formulaTablesRef.current,
        ),
        viewColumnsRef.current,
      )
      if (!names || names.length === 0) return current
      const segments: string[] = [`# current${current ? `\n${current}` : ''}`]
      for (const entry of names) {
        if (!entry.key) continue // '' segment name → skipped entirely
        const refCsv = serializeRefRows(entry.ref())
        segments.push(`# ${entry.key}${refCsv ? `\n${refCsv}` : ''}`)
      }
      return segments.join('\n\n')
    },
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
      // path uses (flat, tree, grouped and virtual rows all carry it).
      // Guarded for jsdom, which does not implement scrollIntoView. Shared
      // locator with goToRow (batch CZ).
      const root = rootRef.current
      if (!root) return
      findTableRowEl(root, key)?.scrollIntoView?.({ block: 'nearest' })
    },
    goToRow: (key) => {
      // Batch CZ (iris 独有 — vxe has no locate flash): scroll the row into
      // view AND flash a transient row-target highlight (`data-iris-row-target`,
      // removed by the ROW_TARGET_MS timer — copyFlash pattern). Single-target
      // semantics: the previously targeted row loses the attribute immediately;
      // re-calling any row restarts the timer. Virtual-window miss / unknown
      // key → no-op (scrollToRow precedent). Fires NO events (orthogonal to
      // onCurrentRowChange — setCurrentRow's own channel stays untouched) and
      // needs no handler to work.
      const root = rootRef.current
      if (!root) return
      const el = findTableRowEl(root, key)
      if (!el) return
      el.scrollIntoView?.({ block: 'nearest' })
      root.querySelector('[data-iris-row-target="true"]')?.removeAttribute('data-iris-row-target')
      el.setAttribute('data-iris-row-target', 'true')
      if (rowTargetTimerRef.current !== null) clearTimeout(rowTargetTimerRef.current)
      rowTargetTimerRef.current = setTimeout(() => {
        rowTargetTimerRef.current = null
        el.removeAttribute('data-iris-row-target')
      }, ROW_TARGET_MS)
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
      if (hasDetail) {
        onExpandChange?.(row, !wasExpanded)
        emitTableEvent('expand-change', { row, expanded: !wasExpanded })
      }
      if (treeMode) {
        onTreeExpandChange?.(row, !wasExpanded)
        emitTableEvent('tree-expand-change', { row, expanded: !wasExpanded })
      }
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
      emitTableEvent('filter-change', { filters: {} })
      onFilterValuesChange?.({})
      emitTableEvent('filter-value-change', { filterValues: {} })
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
    // Batch CO (iris 独有): export the audit trail as CSV — spec-literal 6
    // columns time,type,rowKey,column,old,new. time = formatClock(new
    // Date(at)) (HH:MM:SS local, byte-identical to the audit panel's time
    // cell — display/export consistency; the original `at` stays in
    // getAuditLog); type/rowKey/column/old/new pass through verbatim
    // (undefined → '' via core toCsv, typed numbers stay bare, strings get
    // RFC-4180 quoting + OWASP formula neutralization — audit content is
    // untrusted data). Order = ring order (newest-first — the same view as
    // getAuditLog). Fail-closed family: auditLog off → '' (exportVersionCsv/
    // exportComparisonCsv precedent); on but empty ring → header only
    // (caller distinguishes the two via getAuditLog()).
    exportTimelineCsv: () => {
      if (!auditEnabledRef.current) return ''
      return toCsv(
        audit.list().map((e) => ({
          time: formatClock(new Date(e.at)),
          type: e.type,
          rowKey: e.rowKey,
          column: e.column,
          old: e.oldValue,
          new: e.newValue,
        })),
        [
          { key: 'time', title: 'time' },
          { key: 'type', title: 'type' },
          { key: 'rowKey', title: 'rowKey' },
          { key: 'column', title: 'column' },
          { key: 'old', title: 'old' },
          { key: 'new', title: 'new' },
        ],
      )
    },
    // Batch DU (iris 独有): export the ANNOTATED CELLS as CSV — spec-literal
    // 3 columns rowKey,column,annotation, one line per noted body cell in
    // bodyData order (the same row order as the view). Notes resolve through
    // the SAME cellNoteState path as the cell render (dynamic cellNote wins
    // over the static annotations map — render/export consistency), hidden
    // columns excluded via viewColumnsRef (leaf display columns), keyless
    // rows fall back to the row index (rowKeyOf parity). Serializer = core
    // toCsv (RFC-4180 quoting + OWASP formula neutralization — annotation
    // text is untrusted data). Fail-closed: exportAnnotations off → '' ; on
    // but no notes on the current body → '' (spec-literal 无批注返回空 — the
    // two states are indistinguishable, mirroring exportSelectionCsv).
    exportAnnotationsCsv: () => {
      if (!exportAnnotationsRef.current) return ''
      const notes: Array<{
        rowKey: string | number
        column: string
        annotation: string
      }> = []
      const viewCols = viewColumnsRef.current
      bodyDataRef.current.forEach((row, i) => {
        const k = rowKeyOf(row, i)
        for (const col of viewCols) {
          const noteInfo = cellNoteState(annotationsRef.current, cellNoteRef.current, row, col, k)
          if (noteInfo.note) notes.push({ rowKey: k, column: col.key, annotation: noteInfo.note })
        }
      })
      if (notes.length === 0) return ''
      return toCsv(notes, [
        { key: 'rowKey', title: 'rowKey' },
        { key: 'column', title: 'column' },
        { key: 'annotation', title: 'annotation' },
      ])
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
    // Batch DE (iris 独有): compare two exported-state JSONs and return a
    // field-level diff text — `+` added / `-` removed / `~ old → new`,
    // deterministic by sorted keys + structural deep-equal (order-independent);
    // identical → '', invalid JSON → '! compareStates: invalid JSON' (never
    // throws). Pairs naturally with exportStateJson / importStateJson (T12
    // audit loop: export → compare → import).
    compareStates: (a, b) => compareStatesDiff(a, b),
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
  // Batch DI: mirror the latest exportNames for the mount-time handle
  // (exportMultiCsv runs on demand, NOT during render — the same per-render
  // ref-mirror discipline as formulaTablesRef; the caller must pass a NEW
  // array when the set changes so the ref sees it).
  const exportNamesRef = React.useRef<Array<{ key: string; ref: () => Row[] }> | undefined>(
    exportNames,
  )
  exportNamesRef.current = exportNames
  const bodyData = flatTree ? flatTree.map((t) => t.row) : filteredData
  // Batch DN: header-local numeric statistics are computed from the CURRENT
  // rendered body, not the raw unfiltered input. Only finite number values
  // participate, so text columns and mixed columns stay inert; the footer
  // column-totals feature remains a separate opt-in path.
  const headerStatsByKey = React.useMemo<Record<string, { count: number; average: number }>>(() => {
    const out: Record<string, { count: number; average: number }> = {}
    if (!headerStats) return out
    for (const col of leafColumns) {
      const values = bodyData
        .map((row) => getCellValue(row, col))
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      if (values.length === 0) continue
      out[col.key] = {
        count: values.length,
        average: values.reduce((sum, value) => sum + value, 0) / values.length,
      }
    }
    return out
  }, [headerStats, leafColumns, bodyData])
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
  // Batch CR column totals (iris 独有, Excel status-bar parity): per-leaf
  // column SUM for the totals strip — only `summary === 'sum'` columns,
  // aggregated over the CURRENT body rows with the exact summary-row value
  // pipeline (`aggregate` → `aggregateAccuracy` rounding gate, batch P's
  // single rounding point). Non-sum columns stay absent — the strip renders
  // an empty placeholder to keep track alignment. Empty body → core
  // `aggregate` returns 0 for sum, so the strip shows `0` (fiat). Zero new
  // state; the display applies `renderSummary ?? String` at render (footer
  // parity, byte-for-byte).
  const columnTotalsValues = React.useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    if (!columnTotals) return out
    const accuracy =
      aggregateAccuracy !== undefined && aggregateAccuracy >= 0 && aggregateAccuracy <= 100
        ? aggregateAccuracy
        : undefined
    for (const col of leafColumns) {
      if (col.summary !== 'sum') continue
      const rawValue = aggregate(bodyData, (r) => getCellValue(r, col), 'sum')
      out[col.key] =
        rawValue != null && accuracy !== undefined && Number.isFinite(rawValue)
          ? Number(rawValue.toFixed(accuracy))
          : rawValue
    }
    return out
  }, [columnTotals, leafColumns, bodyData, aggregateAccuracy])
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
  // aggregate ops as the footer, computed over the group's rows). The
  // `BodyPlanEntry` shape lives at module scope (batch CS hoist) so the
  // anchor helper shares it — one type for plan constructor + key helper.
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
  const groupPlan = React.useMemo<BodyPlanEntry<Row>[] | null>(() => {
    if (treeMode) return null
    if (groupByKeys) {
      const indexOf = new Map<Row, number>()
      bodyData.forEach((r, i) => indexOf.set(r, i))
      const plan: BodyPlanEntry<Row>[] = []
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
    const plan: BodyPlanEntry<Row>[] = []
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
    if (rowDragEnabled) widths.push(`${DRAG_COL_WIDTH}px`)
    if (showRowNumbers) widths.push(`${SEQ_COL_WIDTH}px`)
    if (hasDetail) widths.push(`${EXPAND_COL_WIDTH}px`)
    if (selectable !== 'none') widths.push('40px')
    for (const col of leafColumns) {
      const fade = fadeByLeaf[col.key]
      if (
        fade &&
        ((fade.dir === 'out' && fade.phase === 'run') ||
          (fade.dir === 'in' && fade.phase === 'pending'))
      ) {
        // Batch DY: the fade's collapsed phase — the track goes to 0px while
        // the cell stays mounted (opacity handled by the cell helper); the
        // run of the opposite phase restores the normal width below.
        widths.push('0px')
        continue
      }
      const override = columnWidths[col.key]
      if (isValidColumnWidth(override)) widths.push(`${override}px`)
      else if (isValidColumnWidth(col.width)) widths.push(`${col.width}px`)
      // Batch M: `width: 'auto'` sizes the track to its widest cell content
      // (vxe width=auto parity). Pinned offsets / column virtualization keep
      // the DEFAULT_PINNED_WIDTH (140) approximation — they need a number
      // (documented limitation).
      else if (col.width === 'auto') widths.push('minmax(max-content, max-content)')
      else if (typeof col.width === 'string') widths.push(col.width)
      else widths.push('minmax(0, 1fr)')
    }
    return widths.join(' ')
  }, [leafColumns, selectable, columnWidths, hasDetail, showRowNumbers, rowDragEnabled, fadeByLeaf])

  // Sticky offsets for pinned columns: each accumulates the resolved widths of
  // the pinned columns between it and its edge (plus the selection column on
  // the left). Requires a numeric width; falls back to a default.
  const pinnedOffsets = React.useMemo(() => {
    const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
    const widthOf = (col: IrisTableColumn<Row>): number =>
      columnWidths[col.key] ?? (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH)
    let left =
      (rowDragEnabled ? DRAG_COL_WIDTH : 0) +
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
  }, [leafColumns, columnWidths, selectable, hasDetail, showRowNumbers, rowDragEnabled, pinOf])

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
  // Batch DR: an explicit editKeys prop extends the F2 edit affordance with
  // Enter and/or Space. It is intentionally handled before navigation so an
  // opted-in Enter starts an editor instead of moving the roving cell down.
  const handleConfiguredEditKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!keyboardNavigation || editKeys === undefined) return
    if (editTarget.editing !== null || rowEditing !== null) return
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined || !focusedCell) return
    const matches = editKeys.some((key) =>
      key === 'F2'
        ? e.key === 'F2'
        : key === 'Enter'
          ? e.key === 'Enter'
          : e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space',
    )
    // F2 is the default and is always retained when the prop is present.
    if (!matches && e.key !== 'F2') return
    const row = bodyData[focusedCell.row]
    const col = leafColumns[focusedCell.col]
    if (!row || !col || !col.editable || col.formula) return
    if (isCellLocked(row, col) || isCellReadonly(row, col)) return
    e.preventDefault()
    beginEdit(row, col, rowKeyOf(row, focusedCell.row), focusedCell.row)
  }

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
  // Batch CU (iris 独有 — vxe clipboard-config always copies raw values, no
  // format-preserving copy): `copyWithFormat` swaps formatter columns onto the
  // `contextCellText` display chain (mask → formatter → String — the SAME chain
  // as the context-menu 复制值), so the range copy carries the formatted text;
  // non-formatter columns stay byte-identical on the batch-AY mask/exportRaw
  // path. The formatted STRING still flows through the same serializers below
  // (RFC-4180 quoting + OWASP neutralization apply to formatted text too).
  const buildRangeCopy = React.useCallback(
    (range: CellRange, format: 'tsv' | 'csv' | 'html', copyWithFormat: boolean): string => {
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
            // `exportRaw` opts out — all three copy formats agree. Batch CU:
            // `copyWithFormat` supersedes `exportRaw`'s copy-path skip on
            // formatter columns only (mask → formatter always — the
            // formatter input contract, batch AY); non-formatter columns keep
            // the byte-identical path.
            const value = getCellValue(row, col)
            // The row is keyed by the SAME effective read key toHtml uses
            // (string `dataIndex` else `key` — exportCsv shadow-row
            // convention verbatim; a numeric dataIndex falls back to `key`).
            out[typeof col.dataIndex === 'string' ? col.dataIndex : col.key] =
              copyWithFormat && col.formatter
                ? contextCellText(row, col, getCellValue)
                : col.exportRaw
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
          // `exportRaw` opts out — clipboard and CSV export agree. Batch CU:
          // `copyWithFormat` swaps formatter columns to the display-text chain
          // (`contextCellText`), then the formatted STRING still goes through
          // the same serializers (RFC-4180 quoting + OWASP neutralization
          // apply to formatted text too); non-formatter columns stay
          // byte-identical (a raw negative number still bypasses
          // neutralization — the formatter-gate blast radius).
          const value = getCellValue(row, col)
          const masked = col.exportRaw ? value : applyCellMask(value, col)
          const cellText =
            copyWithFormat && col.formatter ? contextCellText(row, col, getCellValue) : masked
          cells.push(format === 'csv' ? csvRangeCell(cellText) : tsvCell(cellText))
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
      const newRows: Record<string, unknown>[] = []
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
        // cells beyond the last row/col are ignored. With `pasteOptions
        // .insertIfOverflow` (iris 独有 batch DF) lines past the last table row are
        // APPENDED as brand-new rows (auto-id keys via insertRowInList); otherwise
        // overflow is dropped (batch-O default).
        let overflowStart = -1
        for (let i = 0; i < lines.length; i += 1) {
          const rowIdx = range.start.row + i
          if (rowIdx >= body.length) {
            overflowStart = i
            break
          }
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
        // Batch DF: append overflow clipboard lines as new rows when enabled.
        if (pasteOptions?.insertIfOverflow && overflowStart >= 0) {
          for (let i = overflowStart; i < lines.length; i += 1) {
            const cells = lines[i]!.split('\t')
            const nr: Record<string, unknown> = {}
            for (let j = 0; j < cells.length; j += 1) {
              const colIdx = range.start.col + j
              if (colIdx >= cols.length) break
              const col = cols[colIdx]!
              // Batch BE: locked cells stay read-only under an overflow-inserted row.
              if (isCellLocked(nr as Row, col) || isCellReadonly(nr as Row, col)) continue
              nr[col.key] = cells[j]!
            }
            newRows.push(nr)
          }
        }
      }
      if (byKey.size === 0 && newRows.length === 0) return
      const keyField = rowKey
      let next = (externalDataRef.current ?? []).map((r) => {
        const k = (r as Record<string, unknown>)[keyField]
        const patch = k != null ? byKey.get(k as string | number) : undefined
        return patch ? { ...r, ...patch } : r
      })
      for (const nr of newRows) next = insertRowInList(next, rowKey, nr as Row)
      commitRowList(next, 'paste')
    },
    [rowKey, commitRowList, pasteOptions],
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

  // ── Batch DJ shortcut scope (iris 独有): the unified gate for the table's
  // WINDOW keydown listeners. `outerScope` → global (fire from anywhere);
  // `hotkeyScope: false` → permissive (no containment check — the legacy
  // anywhere behavior); default → only when the focus is INSIDE the table. The
  // table's own floating surfaces (fnr bar, batch-edit panel and friends, all
  // rendered outside `rootRef` and marked `data-iris-table-surface`) count as
  // in-scope so Esc/closing keeps working from within them. Focus is read live
  // from the keydown `e.target` — no extra focus/blur state.
  const inShortcutScope = React.useCallback(
    (target: EventTarget | null): boolean => {
      if (outerScope) return true
      const el = target as HTMLElement | null
      if (hotkeyScope === false) return true
      if (!el) return true
      return (
        rootRef.current?.contains(el) === true || el.closest('[data-iris-table-surface]') !== null
      )
    },
    [hotkeyScope, outerScope],
  )

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
      if (!inShortcutScope(target)) return
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
  }, [
    undo,
    editingTarget,
    rowEditing,
    undoStack,
    applyUndoSnapshot,
    bumpUndoTick,
    keyBindings,
    inShortcutScope,
  ])

  React.useEffect(() => {
    if (!clipConfig) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      // Never hijack keys outside the table or on text inputs (editors, the
      // fnr bar, external fields) or select editors.
      const target = e.target as HTMLElement | null
      if (!inShortcutScope(target)) return
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
        void writeClipboardText(
          buildRangeCopy(range, clipConfig?.copyFormat ?? 'tsv', !!clipConfig?.copyWithFormat),
        ).then((ok) => {
          if (ok) flashCopyFeedback(range)
        })
      } else if (matchTableKey(e, keyBindings.paste)) {
        if (clipConfig.paste === false) return
        e.preventDefault()
        void pasteIntoRange(range)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    clipConfig,
    cellRangeCtrl,
    buildRangeCopy,
    pasteIntoRange,
    keyBindings,
    flashCopyFeedback,
    inShortcutScope,
  ])

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

  // ── Cell drag-move (batch CN, iris 独有 — vxe has no cell-move parity) ──
  // The move grip (data-iris-range-move, 12×4 primary pill) renders on the
  // range's TOP edge at its top-left cell; dragging it to another cell
  // CUT-MOVES the whole block there (剪切移动 — source cells not covered by
  // the destination rect are cleared; locked/readonly and formula cells
  // survive both phases) and the selection follows the moved block (Excel
  // parity). `cellDragTarget` holds the drag-end cell while dragging: the
  // SAME hit-testing mold as the fill handle — elementFromPoint →
  // closest('[data-iris-cell-row][data-iris-cell-col]') (leaf cells only).
  const [cellDragTarget, setCellDragTarget] = React.useState<{
    row: number
    col: number
  } | null>(null)

  const handleCellDragPointerDown = (e: React.PointerEvent, row: number, col: number): void => {
    if (e.button !== 0) return
    // preventDefault stops the compatibility click → the cell's onClick
    // (startRange/extendRange) never fires from a grip press.
    e.preventDefault()
    e.stopPropagation()
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* jsdom has no real pointer capture */
    }
    setCellDragTarget({ row, col })
  }

  const handleCellDragPointerMove = (e: React.PointerEvent): void => {
    if (cellDragTarget === null) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cellEl = el?.closest('[data-iris-cell-row][data-iris-cell-col]') as HTMLElement | null
    if (!cellEl) return // outside the body → keep the last resolved drag end
    const r = Number(cellEl.dataset.irisCellRow)
    const c = Number(cellEl.dataset.irisCellCol)
    if (Number.isNaN(r) || Number.isNaN(c)) return
    setCellDragTarget((prev) =>
      prev && prev.row === r && prev.col === c ? prev : { row: r, col: c },
    )
  }

  const handleCellDragPointerUp = (): void => {
    // Batch AQ fix mirrored: the drag is over, so the next Escape / outside
    // press must dismiss the range again (self-cleaning suppression flag).
    suppressRangeDismissRef.current = false
    if (cellDragTarget === null) return
    const { row, col } = cellDragTarget
    setCellDragTarget(null)
    moveRangeFromHandle(row, col)
  }

  /** Cut-move of the whole range block to (targetRow, targetCol): the drag
   * end CLAMPS so the block always fits (越界 — Excel parity), a clamped
   * destination equal to the source block is a zero-commit no-op, and the
   * two phases (writable source → writable dest writes + clears of source
   * cells NOT covered by the dest rect) land in ONE commitRowList — an
   * overlap-safe atomic slide. Formula columns are never read/written/
   * cleared; locked/readonly cells survive both phases (batch BE); keyless
   * rows are skipped. Selection follows the moved block. */
  const moveRangeFromHandle = React.useCallback(
    (targetRow: number, targetCol: number): void => {
      const range = cellRangeCtrl.getRange()
      if (!range || !rowKey) return
      const body = liveBodyRef.current
      const cols = liveLeafRef.current
      if (body.length === 0 || cols.length === 0) return
      const h = range.end.row - range.start.row + 1
      const w = range.end.col - range.start.col + 1
      const dstRow = Math.min(Math.max(targetRow, 0), body.length - h)
      const dstCol = Math.min(Math.max(targetCol, 0), cols.length - w)
      if (dstRow === range.start.row && dstCol === range.start.col) return
      const byKey = new Map<string | number, Record<string, unknown>>()
      for (let r = 0; r < h; r += 1) {
        const srcRow = body[range.start.row + r]
        const dstRowObj = body[dstRow + r]
        if (!srcRow || !dstRowObj) continue
        const srcKey = rowKeyOf(srcRow)
        const dstKey = rowKeyOf(dstRowObj)
        if (srcKey == null || dstKey == null) continue // keyless rows skipped
        for (let c = 0; c < w; c += 1) {
          const srcCol = cols[range.start.col + c]
          const dstColObj = cols[dstCol + c]
          if (!srcCol || !dstColObj) continue
          // Formula columns are display-only: never read, written or cleared.
          if (srcCol.formula || dstColObj.formula) continue
          const srcLocked = isCellLocked(srcRow, srcCol) || isCellReadonly(srcRow, srcCol)
          // Phase 1: writable source → writable dest (locked/readonly survive).
          if (
            !srcLocked &&
            !isCellLocked(dstRowObj, dstColObj) &&
            !isCellReadonly(dstRowObj, dstColObj)
          ) {
            const value = getCellValue(srcRow, srcCol)
            byKey.set(dstKey, { ...byKey.get(dstKey), [dstColObj.key]: value })
          }
          // Phase 2: clear the source cell unless the dest rect covers it
          // (overlap-safe slide) — locked/readonly survive the clear too.
          const srcRowIdx = range.start.row + r
          const srcColIdx = range.start.col + c
          const covered =
            dstRow <= srcRowIdx &&
            srcRowIdx <= dstRow + h - 1 &&
            dstCol <= srcColIdx &&
            srcColIdx <= dstCol + w - 1
          if (!covered && !srcLocked) {
            byKey.set(srcKey, { ...byKey.get(srcKey), [srcCol.key]: '' })
          }
        }
      }
      if (byKey.size === 0) return
      const keyField = rowKey
      const next = (externalDataRef.current ?? []).map((row) => {
        const k = (row as Record<string, unknown>)[keyField]
        const patch = k != null ? byKey.get(k as string | number) : undefined
        return patch ? { ...row, ...patch } : row
      })
      commitRowList(next, 'edit')
      // Excel parity: the selection follows the moved block.
      cellRangeCtrl.startRange(dstRow, dstCol)
      cellRangeCtrl.extendRange(dstRow + h - 1, dstCol + w - 1)
      updateRangeToolbarAnchor()
    },
    [cellRangeCtrl, rowKey, commitRowList, updateRangeToolbarAnchor],
  )

  // ── Cell drag-copy (batch DZ, iris 独有 — vxe has no cell-copy parity) ──
  // The copy grip (data-iris-range-copy, 12×4 primary pill) renders on the
  // range's BOTTOM edge at its top-left cell (the CN move grip owns the top
  // edge — zero collision); dragging it to another cell COPIES the whole
  // block there (源块不动 — the source never changes, unlike cut-move) and
  // the selection stays on the source block (Excel parity). The drag end
  // must FIT the whole block inside the table (越界忽略 — no clamp, the
  // deliberate divergence from CN's move): `cellDragCopyRect` stores the
  // resolved destination rectangle directly (null = not dragging OR the
  // block does not fit → no outline, zero-commit release). The SAME
  // hit-testing mold as the move grip — elementFromPoint →
  // closest('[data-iris-cell-row][data-iris-cell-col]') (leaf cells only).
  const cellDragCopyArmRef = React.useRef(false)
  const [cellDragCopyRect, setCellDragCopyRect] = React.useState<IrisRangeCopyTarget | null>(null)

  const handleCellDragCopyPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    // preventDefault stops the compatibility click → the cell's onClick
    // (startRange/extendRange) never fires from a grip press.
    e.preventDefault()
    e.stopPropagation()
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* jsdom has no real pointer capture */
    }
    cellDragCopyArmRef.current = true
    setCellDragCopyRect(null)
  }

  const handleCellDragCopyPointerMove = (e: React.PointerEvent): void => {
    if (!cellDragCopyArmRef.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cellEl = el?.closest('[data-iris-cell-row][data-iris-cell-col]') as HTMLElement | null
    if (!cellEl) return // outside the body → keep the last resolved rect
    const r = Number(cellEl.dataset.irisCellRow)
    const c = Number(cellEl.dataset.irisCellCol)
    if (Number.isNaN(r) || Number.isNaN(c)) return
    setCellDragCopyRect(
      resolveCopyTarget(r, c, cellRangeCtrl.getRange(), bodyData.length, leafColumns.length),
    )
  }

  const handleCellDragCopyPointerUp = (): void => {
    // Batch AQ fix mirrored: the drag is over, so the next Escape / outside
    // press must dismiss the range again (self-cleaning suppression flag).
    suppressRangeDismissRef.current = false
    if (!cellDragCopyArmRef.current) return
    cellDragCopyArmRef.current = false
    const rect = cellDragCopyRect
    setCellDragCopyRect(null)
    if (rect === null) return // 越界忽略: no outline seen, zero commit
    copyRangeFromHandle(rect)
  }

  /** Copy of the whole range block into the resolved destination rectangle
   * (this is the CN commit minus phase 2 — the source block is NEVER
   * touched). The rect already fits by construction (resolveCopyTarget
   * returns null otherwise — 越界忽略); the destination EQUAL to the source
   * block is a zero-commit no-op. Formula columns are never read/written;
   * locked/readonly destination cells survive; keyless rows skipped; ONE
   * commitRowList. The selection stays on the source block (copy does not
   * move it). */
  const copyRangeFromHandle = React.useCallback(
    (rect: IrisRangeCopyTarget): void => {
      const range = cellRangeCtrl.getRange()
      if (!range || !rowKey) return
      const body = liveBodyRef.current
      const cols = liveLeafRef.current
      if (body.length === 0 || cols.length === 0) return
      const refit = resolveCopyTarget(rect.row, rect.col, range, body.length, cols.length)
      if (refit === null) return // race-safety: the table shrank mid-drag
      const h = range.end.row - range.start.row + 1
      const w = range.end.col - range.start.col + 1
      if (refit.row === range.start.row && refit.col === range.start.col) return
      const byKey = new Map<string | number, Record<string, unknown>>()
      for (let r = 0; r < h; r += 1) {
        const srcRow = body[range.start.row + r]
        const dstRowObj = body[refit.row + r]
        if (!srcRow || !dstRowObj) continue
        const srcKey = rowKeyOf(srcRow)
        const dstKey = rowKeyOf(dstRowObj)
        if (srcKey == null || dstKey == null) continue // keyless rows skipped
        for (let c = 0; c < w; c += 1) {
          const srcCol = cols[range.start.col + c]
          const dstColObj = cols[refit.col + c]
          if (!srcCol || !dstColObj) continue
          // Formula columns are display-only: never read or written.
          if (srcCol.formula || dstColObj.formula) continue
          // Locked/readonly destination cells survive the copy.
          if (isCellLocked(dstRowObj, dstColObj) || isCellReadonly(dstRowObj, dstColObj)) continue
          const value = getCellValue(srcRow, srcCol)
          byKey.set(dstKey, { ...byKey.get(dstKey), [dstColObj.key]: value })
        }
      }
      if (byKey.size === 0) return
      const keyField = rowKey
      const next = (externalDataRef.current ?? []).map((row) => {
        const k = (row as Record<string, unknown>)[keyField]
        const patch = k != null ? byKey.get(k as string | number) : undefined
        return patch ? { ...row, ...patch } : row
      })
      commitRowList(next, 'edit')
      // Copy does NOT move the selection: it stays on the source block.
    },
    [cellRangeCtrl, rowKey, commitRowList],
  )

  const copyActiveRange = React.useCallback((): void => {
    const range = cellRangeCtrl.getRange()
    if (!range) return
    // Batch CE: same success-gated flash as Ctrl/Cmd+C — the range toolbar
    // 复制 button is the second consumption point.
    void writeClipboardText(
      buildRangeCopy(range, clipConfig?.copyFormat ?? 'tsv', !!clipConfig?.copyWithFormat),
    ).then((ok) => {
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
    if (!rangeFill && !cellDrag && !cellDragCopy) return
    const onWindowPointerDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      suppressRangeDismissRef.current = !!target?.closest(
        '[data-iris-range-fill], [data-iris-range-move], [data-iris-range-copy]',
      )
    }
    window.addEventListener('pointerdown', onWindowPointerDown, true)
    return () => window.removeEventListener('pointerdown', onWindowPointerDown, true)
  }, [rangeFill, cellDrag, cellDragCopy])

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

  // Batch DX: `/pattern/` or `/pattern/flags` queries auto-parse to a RegExp
  // (fail-closed to literal substring while typing); one memo feeds find +
  // both replace call sites.
  const fnrParsed = React.useMemo(() => parseFnrQuery(fnrQuery), [fnrQuery])

  const fnrMatches = React.useMemo(() => {
    const out: Array<{ row: number; col: number }> = []
    if (!fnr || !fnrOpen || fnrQuery === '') return out
    const q = fnrQuery.toLowerCase()
    const re = fnrParsed
    bodyData.forEach((row, r) => {
      leafColumns.forEach((col, c) => {
        const v = getCellValue(row, col)
        if (v == null) return
        const text = String(v)
        // Regexp mode: case-sensitive by default, `/i` opt-in; reset
        // lastIndex so each find is stateless. Literal fallback unchanged.
        const hit = re ? ((re.lastIndex = 0), re.test(text)) : text.toLowerCase().includes(q)
        if (hit) out.push({ row: r, col: c })
      })
    })
    return out
  }, [fnr, fnrOpen, fnrQuery, fnrParsed, bodyData, leafColumns])

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

  // Ctrl/Cmd+F opens the bar; Escape closes it. Both fire only while focus
  // is inside the table (window capture, batch DJ scope gate); editors keep
  // their own shortcuts.
  React.useEffect(() => {
    if (!fnr) return
    const onKey = (e: KeyboardEvent): void => {
      if (!inShortcutScope(e.target)) return
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
  }, [fnr, inShortcutScope])

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
    const nextText = replaceAllOccurrences(text, fnrQuery, fnrReplace, fnrParsed)
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
      const nextText = replaceAllOccurrences(text, fnrQuery, fnrReplace, fnrParsed)
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
      leafColumns.map((col) => {
        const override = columnWidths[col.key]
        if (isValidColumnWidth(override)) return override
        if (isValidColumnWidth(col.width)) return col.width
        return DEFAULT_PINNED_WIDTH
      }),
    [leafColumns, columnWidths],
  )

  // Batch CY: responsive mode owns a separate, prop-gated observer. It is
  // intentionally fail-closed when ResizeObserver is unavailable (SSR/jsdom):
  // width stays zero and the core fit returns the original columns.
  React.useEffect(() => {
    if (!responsive) {
      setResponsiveWidth(0)
      return
    }
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      // The root's clientWidth is the contract's sole measurement source.
      // A zero value deliberately keeps the fit fail-closed (including hidden
      // roots and jsdom), rather than trusting a stale ResizeObserver entry.
      setResponsiveWidth(el.clientWidth)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [responsive])

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
    (rowDragEnabled ? 1 : 0) +
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
    const responsiveIndex = new Map<string, number>()
    responsiveDisplayColumns.forEach((col, index) => responsiveIndex.set(col.key, index))
    for (const m of mergeHeaderCells ?? []) {
      if (m.row !== 0) continue
      // `mergeHeaderCells` is authored against the pre-fit flat display
      // order. Remap its origin after responsive tail hiding so a merge never
      // lands on a different surviving column; grouped headers ignore this
      // plan as before.
      const source = displayColumns[m.col]
      const col = source ? responsiveIndex.get(source.key) : m.col
      if (col === undefined) continue
      const requestedColspan = Math.max(1, m.colspan ?? 1)
      let colspan = requestedColspan
      // Tail fitting can remove a column that was part of a merge. Keep the
      // merge contiguous and clamp it to the surviving prefix; otherwise CSS
      // creates an implicit track and the header visually crosses the fit.
      if (source && responsiveDisplayColumns !== displayColumns) {
        colspan = 0
        while (colspan < requestedColspan) {
          const candidate = displayColumns[m.col + colspan]
          if (!candidate || responsiveIndex.get(candidate.key) !== col + colspan) break
          colspan += 1
        }
        if (colspan === 0) continue
      }
      byCol.set(col, { rowspan: m.rowspan, colspan })
      const rowspan = m.rowspan ?? 1
      for (let c = 1; c < colspan; c++) occupied.add(`0:${col + c}`)
      for (let r = 1; r < rowspan; r++) occupied.add(`${r}:${col}`)
    }
    return { byCol, occupied }
  }, [mergeHeaderCells, displayColumns, responsiveDisplayColumns])

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

  // Batch DL: implement vxe's `showAll=false` truncation gate without
  // measuring during render. A ResizeObserver handles column/root changes;
  // the window listener covers layout changes in browsers without the
  // observer. Unknown layout dimensions (SSR/jsdom/hidden roots) are handled
  // by `cellContentIsTruncated`'s fail-open rule, preserving the old title
  // behavior until a real width is available.
  useIsomorphicLayoutEffect(() => {
    if (tooltipConfig?.showAll !== false) {
      setTruncatedTooltipCells((previous) => (previous.size === 0 ? previous : new Set()))
      return
    }
    const measure = (): void => {
      const next = new Set<string>()
      for (const [id, element] of tooltipCellRefs.current) {
        if (cellContentIsTruncated(element)) next.add(id)
      }
      setTruncatedTooltipCells((previous) => (sameStringSet(previous, next) ? previous : next))
    }
    measure()
    window.addEventListener('resize', measure)
    const root = rootRef.current
    let observer: ResizeObserver | null = null
    if (root && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(root)
    }
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [tooltipConfig?.showAll, tooltipMeasureVersion])

  React.useEffect(
    () => () => {
      if (tooltipMeasureRaf.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(tooltipMeasureRaf.current)
        tooltipMeasureRaf.current = null
      }
    },
    [],
  )

  // Cell tooltips (vxe tooltipConfig parity, title mode, batch G): a native
  // `title` on body cells — content from the callback or the raw cell value;
  // editing cells are exempt, and empty content drops the tooltip (vxe
  // empty-content parity). `showAll=false` keeps the title only for cells
  // whose measured content overflows; the no-layout fallback remains
  // fail-open for SSR/jsdom.
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
    tooltipId?: string,
  ): string | undefined =>
    editing
      ? undefined
      : note != null
        ? notePopover
          ? undefined
          : note
        : change
          ? compareTitle(change)
          : (sparkTitle(row, col) ??
            (tooltipConfig?.showAll === false &&
            tooltipId !== undefined &&
            !truncatedTooltipCells.has(tooltipId)
              ? undefined
              : cellTooltip(row, col)))

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
        data-iris-expand-anim={expandAnimAttr(expandAnimOn && (treeMeta?.depth ?? 0) > 0)}
        data-iris-table-row-selected={selected ? 'true' : undefined}
        data-iris-row-editing={rowMode && rowEditing?.k === k ? 'true' : undefined}
        data-iris-row-current={currentRowKey === k ? 'true' : undefined}
        data-iris-row-added={compareDiff?.status.get(k) === 'added' ? 'true' : undefined}
        data-iris-row-removed={compareDiff?.status.get(k) === 'removed' ? 'true' : undefined}
        data-iris-row-changed={compareDiff?.status.get(k) === 'changed' ? 'true' : undefined}
        onClick={() => {
          onRowClick?.(row, idx)
          emitTableEvent('row-click', { row, rowIndex: idx })
          if (onCurrentRowChange && k != null) {
            if (beforeCurrentRowChange?.(k, row) !== false) onCurrentRowChange(k, row)
          }
        }}
        onDoubleClick={() => {
          onRowDblClick?.(row, idx)
          emitTableEvent('row-dblclick', { row, rowIndex: idx })
        }}
        className={rowClassName?.(row, idx)}
        style={{
          display: 'grid',
          gridTemplateColumns,
          ...extraStyle,
          ...(rowStyle?.(row, idx) ?? null),
        }}
      >
        {rowDragEnabled ? (
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
                  const nowExpanded = !expandedKeys.includes(String(k))
                  onExpandChange?.(row, nowExpanded)
                  emitTableEvent('expand-change', { row, expanded: nowExpanded })
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
          // Batch DH (iris 独有): pattern-edit hint for THIS cell — matching
          // RAW value in the edited column (excluding the editing cell itself),
          // resolved live from the shared store (real-time per keystroke).
          const patternHint = patternHintStyle(patternEdit, col.key, editing, raw)
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
          // Batch CN cell drag-move: the 12×4 move grip lives on the range's
          // top edge — its top-left cell (the bottom-right stays the fill
          // handle + charCount badge territory).
          const moveGripCell = isRangeMoveGripCell(cellDrag, activeRange, idx, ci)
          // Batch DZ cell drag-copy: the 12×4 copy grip lives on the SAME
          // top-left cell's BOTTOM edge (the top edge belongs to the move
          // grip — zero collision), and the COPY TARGET outline marks every
          // cell of the resolved destination rectangle while the drag is
          // live (null rect → no outline, 越界忽略).
          const copyGripCell = isRangeCopyGripCell(cellDragCopy, activeRange, idx, ci)
          const copyTargetCell = isCopyTargetCell(cellDragCopyRect, activeRange, idx, ci)
          // Batch CE copy flash: SNAPSHOT semantics — the rect was captured
          // at copy time, so the highlight does not chase a changed selection
          // (spec “复制成功后…选中单元格短暂高亮”).
          return (
            <div
              key={col.key}
              ref={
                tooltipConfig?.showAll === false ? tooltipCellRefOf(cellId(k, col.key)) : undefined
              }
              role="cell"
              data-iris-table-cell={col.key}
              data-iris-column-fade={columnFadeAttr(col)}
              data-iris-table-pinned={pinOf(col)}
              data-editable={editableLive ? '' : undefined}
              data-editing={editing ? '' : undefined}
              data-iris-cell-dirty={dirtyInfo.attr}
              data-iris-cell-changed={compareCellAttr(compareChange)}
              data-iris-cell-note={noteInfo.attr}
              data-iris-cell-locked={lockedRender.lockedAttr}
              data-iris-cell-readonly={lockedRender.readonlyAttr}
              data-iris-input-hint={patternHint.hint ? 'true' : undefined}
              data-iris-presence={presenceInfo ? 'true' : undefined}
              data-iris-tooltip-truncated={
                tooltipConfig?.showAll === false && truncatedTooltipCells.has(cellId(k, col.key))
                  ? 'true'
                  : undefined
              }
              title={cellTitle(
                editing,
                noteInfo.note,
                compareChange,
                row,
                col,
                notePopover,
                cellId(k, col.key),
              )}
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
                    // Batch DZ: the copy drag marks the resolved destination
                    // rectangle (null rect → undefined → hidden, 越界忽略).
                    'data-iris-copy-target': copyTargetAttr(copyTargetCell),
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
                      const params = { row, column: col, rowIndex: idx, columnIndex: ci }
                      onCellDblClick?.(params)
                      emitTableEvent('cell-dblclick', params)
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
                // Batch CN: the move-grip host anchors to a relative cell
                // (spread AFTER rangeFillCellStyle — relative is idempotent,
                // the zIndex 2 stays, same layering discipline).
                ...rangeMoveCellStyle(moveGripCell),
                // Batch DZ: the copy-grip host anchors to a relative cell
                // (same idempotent relative) and the copy-target outline
                // marks the whole resolved destination rectangle (spread
                // AFTER the presence outline so the drag highlight wins).
                ...rangeCopyCellStyle(copyGripCell),
                ...copyTargetCellStyle(copyTargetCell),
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
                // Batch CQ review fix: the editing cell wraps — the editor,
                // live preview and validation error each take a full flex line
                // (flexBasis 100% below), so preview/error stack UNDER the
                // editor instead of squeezing beside it.
                ...(editing ? { padding: '4px 8px', flexWrap: 'wrap' } : null),
                ...pinnedStyle(col.key),
                ...(cellStyle?.(row, col, idx) ?? null),
                ...conditionalCellStyle(conditionalStyles, row, col.key, raw),
                // Batch DH: pattern-edit hint — longhand background-image only
                // (never clobbers background), spread AFTER conditional styles
                // (it wins) but BEFORE lockedRender.style (lock stripes /
                // readonly dots re-assert last — BE discipline).
                ...(patternHint.style ?? null),
                // Batch BE+BJ: re-assert the lock stripes / readonly dots AFTER
                // every background shorthand above (range-fill/conditional/
                // user) — an inline `background` shorthand resets
                // background-image.
                // Batch DY: fade-start opacity (0) — invisible for non-fading
                // cells (helper returns null). AFTER user/conditional styles so
                // the transition target can't be clobbered mid-fade.
                ...(columnFadeStyle(col) ?? null),
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
                          const nowExpanded = !treeMeta.expanded
                          onTreeExpandChange?.(row, nowExpanded)
                          emitTableEvent('tree-expand-change', { row, expanded: nowExpanded })
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
                              emitTableEvent('tree-expand-change', { row, expanded: true })
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
                        coerceDraft={coerceEditDraft}
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
                        editPreview={editPreview}
                        row={row}
                        t={t}
                      />
                    )
                  })()
                ) : (
                  <EditorSurface
                    session={cellEdit}
                    col={col}
                    coerceDraft={coerceEditDraft}
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
                    editPreview={editPreview}
                    row={row}
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
                renderAutoLinkCell(row, col, getCellValue)
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
              {/* Batch CN (iris 独有): the cell-drag-move grip on the range's
              top-left cell top edge — same pointerdown-stops-the-click
              discipline as the fill handle. */}
              {renderRangeMoveGrip(moveGripCell, idx, ci, handleCellDragPointerDown)}
              {/* Batch DZ (iris 独有): the cell-drag-copy grip on the range's
              top-left cell bottom edge — same pointerdown-stops-the-click
              discipline as the move grip. */}
              {renderRangeCopyGrip(copyGripCell, idx, ci, handleCellDragCopyPointerDown)}
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

  const renderGroupHeader = (
    entry: TableGroupHeaderEntry,
    extraStyle?: React.CSSProperties,
  ): React.ReactElement => (
    <TableGroupHeader
      key={`group:${entry.groupKey}`}
      entry={entry}
      gridTemplateColumns={gridTemplateColumns}
      borderStyle={borderStyle}
      collapsed={collapsedSet.has(entry.groupKey)}
      extraStyle={extraStyle}
      onToggle={toggleGroupCollapse}
      t={t}
    />
  )

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
          data-iris-expand-anim={expandAnimAttr(expandAnimOn)}
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

  const footerCellSpan = useFooterCellSpan({
    mergeFooterItems,
    footerSpanMethod,
    leafColumns,
    bodyData,
    footerOccupy: footerOccupyRef,
  })

  // Summary row material (global footer + per-group footers, batch M): the
  // same `aggregate` ops as before, computed over the passed rows. A group
  // summary carries `data-iris-group-summary`; the global footer does not.
  const renderSummaryRow = (
    rows: Row[],
    groupKey?: string,
    extraStyle?: React.CSSProperties,
    footerRowIndex?: number,
  ): React.ReactElement =>
    TableSummaryRow({
      rows,
      groupKey,
      extraStyle,
      footerRowIndex,
      gridTemplateColumns,
      summarySticky: summaryRowStyle === 'sticky' && groupKey === undefined,
      rowDrag: rowDragEnabled,
      showRowNumbers,
      seq,
      hasDetail,
      selectable,
      leafColumns,
      visibleColSet,
      baseCellStyle,
      cellOverflowOverride,
      showFooterOverflow,
      footerAlign,
      aggregateAccuracy,
      colTrack,
      pinnedStyle,
      footerTooltip,
      footerCellSpan,
      columnFadeAttr,
      columnFadeStyle,
      getCellValue,
    })

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
      if (!inShortcutScope(e.target)) return
      if (e.key === 'Escape') setBatchEditOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [batchEditOpen, inShortcutScope])
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
  const virtualItems = React.useMemo<BodyPlanEntry<Row>[]>(() => {
    if (groupPlan) return groupPlan
    // Only the virtual body consumes this plan (the non-virtual path renders
    // detail wraps inline via renderBodyEntry); gate the detail slots on
    // virtualScroll so plain detail tables keep the O(n) flat map.
    if (!virtualScroll || !hasDetail) {
      return bodyData.map((row, rowIndex) => ({ kind: 'row' as const, row, rowIndex }))
    }
    const plan: BodyPlanEntry<Row>[] = []
    for (let i = 0; i < bodyData.length; i += 1) {
      const row = bodyData[i]!
      plan.push({ kind: 'row', row, rowIndex: i })
      if (isRowExpandable(row, i) && expandedKeys.includes(String(rowKeyOf(row, i)))) {
        plan.push({ kind: 'detail', row, rowIndex: i })
      }
    }
    return plan
  }, [groupPlan, virtualScroll, hasDetail, bodyData, expandedKeys, rowKeyOf, isRowExpandable])

  // Batch CS: record the content anchor (first visible plan entry + partial
  // offset) while the plan is STABLE. The transition render skips the write
  // (`prevExpandedKeysRef` still holds the pre-toggle keys), so the pre-toggle
  // anchor survives into the transition layout effect below. The onScroll
  // wiring re-records on every scroll (fresh scrollTop, the plan in the
  // closure is the current stable one); this render-time pass covers mount +
  // plan changes that arrive without a scroll event (proxy page load, …).
  // Fail-closed when the prop is off / non-virtual / variable-height.
  if (expandScrollOn && prevExpandedKeysRef.current === expandedKeys && virtualItems.length > 0) {
    const top = virtualScrollTopRef.current
    const index = Math.min(Math.floor(top / slotHeight), virtualItems.length - 1)
    preserveAnchorRef.current = {
      key: virtualItemKeyOf(virtualItems[index]!, rowKeyOf),
      relativeTop: top - index * slotHeight,
    }
  }

  // Batch CS: the expansion-transition layout effect — runs AFTER
  // IrisVirtualScroll's own re-clamp (child layout effects run before
  // parent), so the DOM viewport already reflects the new plan's clamp
  // bound. A single-key expansion commit re-locates the recorded anchor key
  // in the NEW plan and writes `newIndex × slotHeight + relativeTop` — exact
  // index math, zero delta bookkeeping. Full-set restores (`expandAll` /
  // `persistState` replay) fall back to the virtualizer's re-clamp; an anchor
  // whose slot vanished (a collapsed detail panel — the `::detail` entry is
  // removed from the plan) falls back to the pixel preserve.
  React.useLayoutEffect(() => {
    const prev = prevExpandedKeysRef.current
    if (prev === expandedKeys) return
    prevExpandedKeysRef.current = expandedKeys
    if (!expandScrollOn) return
    if (!singleKeyDiff(prev, expandedKeys)) return
    const anchor = preserveAnchorRef.current
    const viewport = rootRef.current?.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
    if (!anchor || !viewport) return
    const index = virtualItems.findIndex((item) => virtualItemKeyOf(item, rowKeyOf) === anchor.key)
    if (index < 0) return
    // Scrollable bound from the PLAN math (uniform slot heights): a real
    // browser clamps the scrollTop setter to its own range (total − viewport)
    // anyway, and jsdom reports scrollHeight/clientHeight as 0 — so the plan
    // total is the only portable clamp and it is exact for this uniform body.
    const max = Math.max(0, virtualItems.length * slotHeight)
    const top = Math.min(index * slotHeight + anchor.relativeTop, max)
    viewport.scrollTop = top
    virtualScrollTopRef.current = top
  }, [expandedKeys, virtualItems])

  // Batch CS: the virtual viewport's scrollTop mirror + anchor re-record —
  // wired to IrisVirtualScroll's (previously unused) `onScroll`. The Table
  // never re-renders on scroll (scrollTop lives in the child), so the anchor
  // must refresh HERE with the current stable plan from the closure; the
  // transition layout effect above then re-locates it in the new plan.
  const handleVirtualScrollScroll = (top: number): void => {
    virtualScrollTopRef.current = top
    if (!expandScrollOn || slotHeight <= 0 || virtualItems.length === 0) return
    const index = Math.min(Math.floor(top / slotHeight), virtualItems.length - 1)
    preserveAnchorRef.current = {
      key: virtualItemKeyOf(virtualItems[index]!, rowKeyOf),
      relativeTop: top - index * slotHeight,
    }
  }

  // ── Back-to-top (batch EA, iris 独有 — vxe has no back-to-top) ────────
  // Boolean visibility state driven ONLY by the threshold crossing (a repeated
  // boolean bails out, so scrolling never re-renders the table row-by-row).
  // The listener tracks the EFFECTIVE scroller — the virtual-scroll viewport
  // when present, else the fixed-height root — the same resolution the paging
  // keys use (line 5030 precedent), so a virtual table (root never scrolls)
  // and a fixed-height table (no viewport) both work. When neither exists
  // (overflow-hidden non-scrollable root) the listener never fires → lazy
  // zero-node fail-closed. Detail comments below cover the dual attach,
  // event-time resolution and the data-presence re-arm dep.
  const [scrollTopShown, setScrollTopShown] = React.useState(false)
  React.useEffect(() => {
    if (!scrollToTop) return
    const root = rootRef.current
    if (!root) return
    // Resolve the effective scroller at EVENT time, not effect time: the
    // virtual viewport only mounts once data is present, so a handler
    // captured at effect time would read the closed-over (or missing) node.
    const onScroll = (): void => {
      const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      const scroller = viewport ?? root
      setScrollTopShown(scroller.scrollTop >= SCROLL_TOP_VISIBLE_PX)
    }
    // Attach to BOTH potential scrollers — scroll events don't bubble, so a
    // listener stranded on the root never sees the virtual viewport scroll.
    root.addEventListener('scroll', onScroll)
    root
      .querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      ?.addEventListener('scroll', onScroll)
    onScroll()
    return () => {
      root.removeEventListener('scroll', onScroll)
      // Re-query at cleanup: the viewport node may have been replaced.
      root
        .querySelector<HTMLElement>('[data-iris-virtual-scroll]')
        ?.removeEventListener('scroll', onScroll)
    }
    // The data-presence flip (empty → rows) is exactly when a virtual viewport
    // mounts in the canonical async flow, so re-arming on the boolean covers
    // it; the primitive boolean bails out on every ordinary data refresh.
  }, [scrollToTop, Boolean(virtualScroll), fixedHeight, Boolean(bodyData.length)])

  // Click = scroll the same effective scroller back to top: scrollTo with a
  // behavior that honors reduced motion, falling back to scrollTop = 0 (the
  // IrisBackTop recipe — jsdom has no Element.scrollTo, so the fallback also
  // covers test/SSR-like environments).
  const scrollToTopOfTable = React.useCallback((): void => {
    const root = rootRef.current
    if (!root) return
    const scroller = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]') ?? root
    const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth'
    if (typeof scroller.scrollTo === 'function') {
      try {
        scroller.scrollTo({ top: 0, behavior })
        return
      } catch {
        // fall through to the scrollTop assignment
      }
    }
    scroller.scrollTop = 0
  }, [reducedMotion])

  const footerStack = (
    <TableFooterStack
      tableError={tableError}
      tableLoading={tableLoading}
      footerSpanMethod={footerSpanMethod}
      footerMethod={footerMethod}
      footerData={footerData}
      bodyData={bodyData}
      leafColumns={leafColumns}
      rowKey={rowKey}
      summaryRowStyle={summaryRowStyle}
      gridTemplateColumns={gridTemplateColumns}
      borderStyle={borderStyle}
      selectable={selectable}
      visibleColSet={visibleColSet}
      baseCellStyle={baseCellStyle}
      cellOverflowOverride={cellOverflowOverride}
      showFooterOverflow={showFooterOverflow}
      footerAlign={footerAlign}
      footerCellClassName={footerCellClassName}
      footerCellStyle={footerCellStyle}
      footerTooltip={footerTooltip}
      colTrack={colTrack}
      footerCellSpan={footerCellSpan}
      footerOccupy={footerOccupyRef}
      getCellValue={getCellValue}
      renderSummaryRow={renderSummaryRow}
    />
  )

  // Batch DL follow-up: expose the logical grid dimensions for assistive
  // technology when roving keyboard navigation is enabled.  The row count is
  // based on the rendered body plan (group headers/summaries and virtual
  // detail slots included) rather than the current DOM window; the column
  // count follows the same leading-track order as gridTemplateColumns.
  const ariaGridRowCount = keyboardNavigation
    ? (groupPlan ? groupPlan.length : virtualItems.length) + (showHeader ? 1 : 0)
    : undefined
  const ariaGridColumnCount = keyboardNavigation
    ? leafColumns.length +
      (rowDragEnabled ? 1 : 0) +
      (showRowNumbers ? 1 : 0) +
      (hasDetail ? 1 : 0) +
      (selectable !== 'none' ? 1 : 0)
    : undefined

  return (
    <>
      <TableForm
        config={formConfig && layouts?.form !== 'hidden' ? formConfig : undefined}
        draft={formDraft}
        setValue={setFormValue}
        onSubmit={handleFormSubmit}
        onReset={handleFormReset}
        t={t}
      />
      {tabs.length > 0 ? (
        <div
          data-iris-table-tabs=""
          role="tablist"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-space-xs, 8px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            borderBottom: 'none',
            borderTopLeftRadius: 'var(--iris-radius-md, 6px)',
            borderTopRightRadius: 'var(--iris-radius-md, 6px)',
            background: 'var(--iris-surface)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTabKey === tab.key}
              data-iris-table-tab={tab.key}
              data-active={activeTabKey === tab.key ? '' : undefined}
              onClick={() => applyTab(tab.key)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                color: activeTabKey === tab.key ? 'var(--iris-primary)' : 'var(--iris-muted)',
                fontWeight: activeTabKey === tab.key ? 600 : 400,
                boxShadow: activeTabKey === tab.key ? 'inset 0 -2px 0 var(--iris-primary)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
        editSidebar ||
        shortcutHints ||
        densityToggle) &&
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
            // Batch CT: the tabs strip (rendered above) owns the top card
            // radius when present — fail-closed, the no-tabs path keeps the
            // toolbar radius exactly as before.
            ...(tabs.length > 0
              ? {}
              : {
                  borderTopLeftRadius: 'var(--iris-radius-md, 6px)',
                  borderTopRightRadius: 'var(--iris-radius-md, 6px)',
                }),
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
              data-iris-table-surface=""
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
          {/* Batch CW import preview (iris 独有 — vxe has no pre-import
            preview): a fixed centered modal (Dialog backdrop/z-index
            precedent) over the parsed rows. First 5 rows in a plain table
            (headers = the first row's keys, stable by construction); a
            `table.total` note when more; 确认 fires `onImport` with ALL
            rows, 取消 / Esc / backdrop close with zero calls. Presence-gated
            → zero nodes when idle. */}
          {importPreviewRows ? (
            <div
              data-iris-import-preview-backdrop=""
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setImportPreviewRows(null)
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--iris-backdrop, rgba(0, 0, 0, 0.5))',
                zIndex: 'var(--iris-z-modal, 1200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--iris-space-lg, 24px)',
              }}
            >
              <div
                data-iris-import-preview=""
                role="dialog"
                aria-modal="true"
                aria-label={t('table.importPreview.title')}
                style={{
                  background: 'var(--iris-surface-floating, var(--iris-surface))',
                  color: 'var(--iris-foreground)',
                  border: '1px solid var(--iris-border)',
                  borderRadius: 'var(--iris-radius-lg, 8px)',
                  boxShadow: 'var(--iris-shadow-xl)',
                  padding: 'var(--iris-space-lg, 24px)',
                  maxWidth: '90vw',
                  maxHeight: '85vh',
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--iris-space-sm, 12px)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--iris-foreground)' }}>
                  {t('table.importPreview.title')}
                </div>
                {importPreviewColumns.length > 0 ? (
                  <table
                    data-iris-import-preview-table=""
                    style={{
                      borderCollapse: 'collapse',
                      fontSize: 'var(--iris-font-size-sm, 13px)',
                    }}
                  >
                    <thead>
                      <tr>
                        {importPreviewColumns.map((h) => (
                          <th
                            key={h}
                            data-iris-import-preview-header={h}
                            style={{
                              border: '1px solid var(--iris-border)',
                              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                              background: 'var(--iris-surface)',
                              color: 'var(--iris-foreground)',
                              textAlign: 'start',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.slice(0, 5).map((row, ri) => (
                        <tr key={ri}>
                          {importPreviewColumns.map((h) => (
                            <td
                              key={h}
                              data-iris-import-preview-cell={`${ri}:${h}`}
                              style={{
                                border: '1px solid var(--iris-border)',
                                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                                color: 'var(--iris-foreground)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {importPreviewRows.length > 5 ? (
                  <div
                    data-iris-import-preview-total=""
                    style={{
                      color: 'var(--iris-muted)',
                      fontSize: 'var(--iris-font-size-xs, 12px)',
                    }}
                  >
                    {t('table.total', { total: importPreviewRows.length })}
                  </div>
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 'var(--iris-space-xs, 8px)',
                  }}
                >
                  <button
                    type="button"
                    data-iris-import-preview-cancel=""
                    onClick={cancelImportPreview}
                    style={{
                      border: '1px solid var(--iris-border)',
                      cursor: 'pointer',
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      fontSize: 'var(--iris-font-size-sm, 13px)',
                      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                      borderRadius: 'var(--iris-radius-sm, 4px)',
                    }}
                  >
                    {t('table.importPreview.cancel')}
                  </button>
                  <button
                    type="button"
                    data-iris-import-preview-confirm=""
                    onClick={confirmImportPreview}
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
                    {t('table.importPreview.confirm')}
                  </button>
                </div>
              </div>
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
          {densityToggle ? (
            <button
              type="button"
              data-iris-density-toggle=""
              data-iris-density={effectiveDensity}
              onClick={() => setDensityState(nextDensity)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--iris-space-xxs, 4px)',
              }}
              aria-label={`${t('table.density')}: ${t(`table.density.${effectiveDensity}`)}`}
              title={`${t('table.density')}: ${t(`table.density.${effectiveDensity}`)}`}
            >
              {t(`table.density.${effectiveDensity}`)}
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
          {editSidebar ? (
            <button
              type="button"
              data-iris-edit-sidebar-trigger=""
              onClick={() => setEditSidebarOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: editSidebarOpen ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.editSidebar')}
              title={t('table.editSidebar')}
            >
              ⏳
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
      {columnTotals ? (
        <div data-iris-column-totals="" style={{ ...COLUMN_TOTALS_STYLE, gridTemplateColumns }}>
          {selectable !== 'none' ? (
            <div role="cell" data-iris-column-totals-cell="__selection" style={baseCellStyle} />
          ) : null}
          {leafColumns.map((col) => {
            const value = columnTotalsValues[col.key]
            return (
              <div
                key={col.key}
                data-iris-column-totals-cell={col.key}
                data-iris-column-fade={columnFadeAttr(col)}
                style={{
                  ...baseCellStyle,
                  ...(columnFadeStyle(col) ?? null),
                  justifyContent: justifyFor(col.align),
                }}
              >
                {value != null
                  ? col.renderSummary
                    ? col.renderSummary(value, bodyData)
                    : String(value)
                  : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {fnr && fnrOpen ? (
        <div
          data-iris-fnr-bar=""
          data-iris-table-surface=""
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
        aria-rowcount={ariaGridRowCount}
        aria-colcount={ariaGridColumnCount}
        data-iris-table=""
        data-iris-column-fade-active={columnFadeActive ? 'true' : undefined}
        data-size={size}
        data-density={effectiveDensity}
        data-printable={printable ? 'true' : undefined}
        data-bordered={bordered ? 'true' : undefined}
        data-striped={striped ? 'true' : undefined}
        data-column-virtualized={columnVirtualization ? 'true' : undefined}
        data-iris-table-fixed-height={fixedHeight ? 'true' : undefined}
        data-iris-table-zoomed={zoomed ? 'true' : undefined}
        data-iris-scrollbar-thin={scrollbarConfig?.theme === 'thin' ? 'true' : undefined}
        data-iris-scrollbar-thumb={scrollbarThumb ? 'true' : undefined}
        data-iris-auto-resize={autoResize ? 'true' : undefined}
        data-iris-no-hover={highlightHoverRow ? undefined : 'true'}
        className={className}
        onKeyDown={
          keyboardNavigation ||
          cellRange ||
          tableShortcuts ||
          editKeys !== undefined ||
          rangeFill ||
          query !== undefined
            ? (e) => {
                if (editKeys !== undefined) handleConfiguredEditKey(e)
                if (e.defaultPrevented) return
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
          rowDragEnabled || columnDrag || rangeFill || cellDrag || cellDragCopy || selectionDrag
            ? (e) => {
                handleRowDragPointerMove(e)
                handleColDragPointerMove(e)
                handleRangeFillPointerMove(e)
                handleCellDragPointerMove(e)
                handleCellDragCopyPointerMove(e)
                handleSelectionDragPointerMove(e)
              }
            : undefined
        }
        onPointerUp={
          rowDragEnabled || columnDrag || rangeFill || cellDrag || cellDragCopy || selectionDrag
            ? (e) => {
                handleRowDragPointerUp(e)
                resolveColDrag(e.clientX, e.clientY)
                handleRangeFillPointerUp()
                handleCellDragPointerUp()
                handleCellDragCopyPointerUp()
                handleSelectionDragPointerUp()
              }
            : undefined
        }
        onPointerLeave={rowDragEnabled && !rowDragBetween ? handleRowDragPointerLeave : undefined}
        onPointerCancel={
          rangeFill || cellDrag || cellDragCopy || selectionDrag || rowDragEnabled
            ? () => {
                // Aborted drag → drop the target highlight, nothing committed.
                // Re-arm dismissal too (same stale-flag fix as pointerup).
                suppressRangeDismissRef.current = false
                setFillTarget(null)
                // Batch CN: aborted move drag → drop the drag end, nothing
                // committed (same zero-commit discipline as the fill cancel).
                setCellDragTarget(null)
                // Batch DZ: aborted copy drag → drop the drag arm + target
                // rect, nothing committed (same zero-commit discipline).
                cellDragCopyArmRef.current = false
                setCellDragCopyRect(null)
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
                if (rowDragEnabled) {
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
          overflow: responsiveOverflow
            ? 'auto'
            : fixedHeight
              ? 'auto'
              : columnVirtualization
                ? 'auto'
                : 'hidden',
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
          ...(responsiveOverflow ? { overflowX: 'auto' } : null),
          // Batch BU watermark: the layer is sticky, but its containing block
          // is this root — the root must be a positioning context, forced
          // AFTER `...style` so a caller-provided style cannot unanchor the
          // layer (zoom's position: fixed below still wins when zoomed, so
          // the watermark rides the fixed overlay as intended).
          ...(watermark ? { position: 'relative' } : null),
          // Batch CD: the row-drag insertion line is absolutely positioned
          // in this root — same forced-anchor precedent as the BU watermark,
          // also AFTER `...style` so a caller style cannot unanchor it.
          ...(rowDragEnabled ? { position: 'relative' } : null),
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
            {rowDragEnabled ? (
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
                  gridColumn: String((rowDragEnabled ? 1 : 0) + 1),
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
                  gridColumn: String((rowDragEnabled ? 1 : 0) + (showRowNumbers ? 1 : 0) + 1),
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
                    (rowDragEnabled ? 1 : 0) + (showRowNumbers ? 1 : 0) + (hasDetail ? 2 : 1),
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
                  (rowDragEnabled ? 1 : 0) +
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
                    data-iris-column-fade={columnFadeAttr(col)}
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
                      ...(columnFadeStyle(col) ?? null),
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
                    {headerStats && isLeaf && headerStatsByKey[col.key] ? (
                      <span
                        data-iris-header-stats=""
                        aria-label={`count ${headerStatsByKey[col.key]!.count}, average ${headerStatsByKey[col.key]!.average.toFixed(2)}`}
                        style={{
                          marginInlineStart: 'var(--iris-space-xxs, 4px)',
                          fontSize: 'var(--iris-font-size-xs, 12px)',
                          color: 'var(--iris-muted)',
                          fontWeight: 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {`n=${headerStatsByKey[col.key]!.count} · avg=${headerStatsByKey[col.key]!.average.toFixed(2)}`}
                      </span>
                    ) : null}
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
                    {isLeaf ? (
                      <TableFilterTrigger
                        column={col}
                        active={(filterValues?.[col.key]?.length ?? 0) > 0}
                        expanded={
                          filterPanelState?.open === true && filterPanelState.colKey === col.key
                        }
                        ariaLabel={t('table.filter')}
                        onOpen={openFilterPanel}
                      />
                    ) : null}
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
                    {isLeaf && pinnedBoundaryCol && pinnedBoundaryCol.key === col.key ? (
                      <PinnedDragHandle
                        colKey={col.key}
                        label={col.title}
                        resolve={resolvePinnedCount}
                        commit={commitPinnedCount}
                      />
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
            {rowDragEnabled ? (
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
            {responsiveDisplayColumns.map((col, ci) => {
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
                  data-iris-column-fade={columnFadeAttr(col)}
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
                    ...(columnFadeStyle(col) ?? null),
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
                  {headerStats && headerStatsByKey[col.key] ? (
                    <span
                      data-iris-header-stats=""
                      aria-label={`count ${headerStatsByKey[col.key]!.count}, average ${headerStatsByKey[col.key]!.average.toFixed(2)}`}
                      style={{
                        marginInlineStart: 'var(--iris-space-xxs, 4px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: 'var(--iris-muted)',
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {`n=${headerStatsByKey[col.key]!.count} · avg=${headerStatsByKey[col.key]!.average.toFixed(2)}`}
                    </span>
                  ) : null}
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
                  {col.filterable ? (
                    <TableFilterTrigger
                      column={col}
                      active={(filterValues?.[col.key]?.length ?? 0) > 0}
                      expanded={
                        filterPanelState?.open === true && filterPanelState.colKey === col.key
                      }
                      ariaLabel={t('table.filter')}
                      onOpen={openFilterPanel}
                    />
                  ) : null}
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
                  {pinnedBoundaryCol && pinnedBoundaryCol.key === col.key ? (
                    <PinnedDragHandle
                      colKey={col.key}
                      label={col.title}
                      resolve={resolvePinnedCount}
                      commit={commitPinnedCount}
                    />
                  ) : null}
                  {resizableColumns && !(pinnedBoundaryCol && pinnedBoundaryCol.key === col.key) ? (
                    <ColumnResizeHandle
                      colKey={col.key}
                      label={col.title}
                      width={columnWidths[col.key]}
                      minWidth={col.minWidth ?? 60}
                      maxWidth={col.maxWidth ?? Infinity}
                      onResize={setColumnWidth}
                      widthHint={widthHint}
                      onAutoFit={
                        autoResizeColumns
                          ? (key) => {
                              const measured = measureColumnContentWidth(rootRef.current, key)
                              if (measured <= 0) return
                              setColumnWidth(
                                key,
                                Math.max(
                                  col.minWidth ?? 60,
                                  Math.min(col.maxWidth ?? Infinity, Math.round(measured)),
                                ),
                              )
                            }
                          : undefined
                      }
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
            keyOf={(item) => virtualItemKeyOf(item, rowKeyOf)}
            onScroll={handleVirtualScrollScroll}
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
        {footerStack}

        {/* Back-to-top anchor (batch EA, iris 独有): a sticky zero-height
          endcap as the root's LAST child. The root is the fixed-height
          scroll container, so the endcap pins to the bottom of the scroll
          viewport (sticky — an absolute box anchored to the root would ride
          the content up with it, the BU watermark precedent) and the button
          is absolute against that pinned anchor: bottom-right corner,
          logical inset props (RTL-safe), zero layout footprint / no dead
          scroll tail. Presence-gated — off prop, below-threshold scroll,
          non-scrollable root or printable → zero nodes. */}
        {scrollToTop && scrollTopShown && !printable ? (
          <div data-iris-back-top-anchor="" style={BACK_TOP_ANCHOR_STYLE}>
            <button
              type="button"
              data-iris-back-top-table=""
              aria-label={t('backTop.label')}
              title={t('backTop.label')}
              onClick={scrollToTopOfTable}
              style={BACK_TOP_BUTTON_STYLE}
            >
              ↑
            </button>
          </div>
        ) : null}
      </div>

      {responsiveOverflow && !zoomed && !printable ? (
        <div
          data-iris-scroll-hint=""
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-space-xxs, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            color: 'var(--iris-muted)',
            background: 'var(--iris-surface)',
            borderInline: '1px solid var(--iris-border)',
            borderBottom: '1px solid var(--iris-border)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          <span aria-hidden="true">⇆</span>
          <span>{t('table.scrollHint')}</span>
        </div>
      ) : null}

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
            else if (key === FORMAT_NUMBER_MENU_KEY) formatContextSelection(params, 'number')
            else if (key === FORMAT_UPPER_MENU_KEY) formatContextSelection(params, 'upper')
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
      {editSidebar && editSidebarOpen ? (
        <TableEditHistoryPanel
          open
          history={versionHistory ? history : null}
          audit={auditLog ? audit : null}
          onRestore={(index) => {
            restoreVersion(index)
            setEditSidebarOpen(false)
          }}
          onClose={() => setEditSidebarOpen(false)}
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
        <TablePager
          proxyState={proxyState}
          config={pagerConfig}
          borderTop={borderStyle}
          setParams={(partial) => proxyRef.current?.setParams(partial)}
          onPageChange={proxyConfig?.onPageChange}
          t={t}
        />
      ) : null}
    </>
  )
}
