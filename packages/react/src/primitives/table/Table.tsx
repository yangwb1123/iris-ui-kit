import * as React from 'react'
import {
  aggregate,
  buildFormValues,
  buildHeaderMatrix,
  computeVirtualRange,
  createCellRange,
  createExpansion,
  createSelectionModel,
  flattenLeafColumns,
  flattenTree,
  groupRows,
  mergeFormFilters,
  seedFormValues,
  withSortedChildren,
  nextGridCell,
  type CellRange,
  type CellRangeController,
  type ExpansionModel,
  type GridNavKey,
  type SelectionModel,
  type TreeRow,
} from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { IrisInput } from '../input/Input'
import { IrisSelect } from '../select/Select'
import { IrisFormField } from '../form-field/FormField'
import { IrisButton } from '../button/Button'
import { useStore } from '../../useStore'
import {
  copyText,
  createCellEdit,
  createRemoteTableSource,
  createSortable,
  insertRowInList,
  parseCsv,
  removeRowFromList,
  setCellValue,
  updateRowInList,
  validateEditRulesAsync,
  type CellEdit,
  type RemoteTableSource,
  type RemoteTableSourceState,
  type SortableRect,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import { IrisPagination } from '../pagination'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type { IrisTableHandle, IrisTableProps, IrisTableProxyConfig } from './props'

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
`
import { useTableSort } from './useTableSort'
import { TableContextMenu } from './ContextMenu'
import { TableFilterPanel } from './FilterPanel'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableContextMenuParams,
  IrisTableEditDirtyConfig,
  IrisTableSortDirection,
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

export type { IrisTableProps, IrisTableProxyConfig } from './props'

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
        <textarea
          ref={setRef}
          rows={3}
          value={draft}
          data-iris-table-editor=""
          data-iris-table-editor-textarea=""
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && showError ? errorId : undefined}
          onChange={(e) => session.setDraft(e.target.value)}
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
    </>
  )
}

const RESIZE_STEP = 16
const SELECTION_COL_WIDTH = 40
const EXPAND_COL_WIDTH = 40
const DEFAULT_PINNED_WIDTH = 140

/** Shared style for the full-width empty / loading / error state rows. */
const STATE_ROW_STYLE: React.CSSProperties = {
  padding: '32px 12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
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
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
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
 * Write clipboard text — best-effort, ordered: registered host handler
 * (core `copyText`) → `navigator.clipboard.writeText` → hidden-textarea
 * `execCommand('copy')` fallback. In test environments without a clipboard
 * stub every step no-ops safely (never throws).
 */
async function writeClipboardText(text: string): Promise<void> {
  if (await copyText(text)) return
  const nav = navigator as Navigator & { clipboard?: { writeText?: (t: string) => Promise<void> } }
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text)
      return
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
  try {
    document.execCommand('copy')
  } catch {
    /* no-op */
  }
  ta.remove()
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
 */
function fnrCellStyle(
  fnrActive: boolean,
  fnrMatched: boolean,
  rangeSelected: boolean,
  stripedRow: boolean,
): React.CSSProperties {
  return {
    background: fnrActive
      ? 'var(--iris-primary, #6366f1)'
      : fnrMatched || rangeSelected
        ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
        : stripedRow
          ? 'var(--iris-surface)'
          : 'transparent',
    ...(fnrActive ? { color: 'var(--iris-primary-foreground, #fff)' } : null),
  }
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
  showHeader = true,
  footerData,
  footerMethod,
  footerSpanMethod,
  headerAlign,
  footerAlign,
  aggregateAccuracy,
  highlightHoverRow = true,
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
  headerCellStyle,
  footerCellStyle,
  onCellClick,
  bordered = true,
  round = false,
  padding,
  resizableColumns = false,
  columnWidths: columnWidthsProp,
  defaultColumnWidths,
  onColumnWidthsChange,
  onRowClick,
  onCellEdit,
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
  filterValues,
  onFilterValuesChange,
  formConfig,
  toolbar,
  tooltipConfig,
  headerTooltipConfig,
  footerTooltipConfig,
  contextMenu,
  printable = false,
  seq = false,
  spanMethod,
  mergeHeaderCells,
  renderDetail,
  rowExpandable,
  defaultExpandedRowKeys,
  expandAll = false,
  onExpandedRowsChange,
  getSubRows,
  lazyLoad,
  keyboardNavigation = false,
  cellRange = false,
  clipConfig,
  fnr = false,
  checkboxRange = false,
  virtualScroll,
  columnVirtualization = false,
  emptyState,
  loading = false,
  error = false,
  loadingState,
  errorState,
  onRetry,
  proxyConfig,
  style,
  className,
  ...rest
}: IrisTableProps<Row>): React.ReactElement {
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('iris-table-row-styles')) return
    const style = document.createElement('style')
    style.id = 'iris-table-row-styles'
    style.textContent = TABLE_ROW_CSS
    document.head.appendChild(style)
  }, [])

  const { t } = useI18n()
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

  const orderedColumns = React.useMemo(() => {
    if (!columnOrder || columnOrder.length === 0) return safeColumns
    const ordered = safeColumns.filter((c) => columnOrderIndex.has(c.key))
    const rest = safeColumns.filter((c) => !columnOrderIndex.has(c.key))
    ordered.sort((a, b) => columnOrderIndex.get(a.key)! - columnOrderIndex.get(b.key)!)
    return [...ordered, ...rest]
  }, [safeColumns, columnOrder, columnOrderIndex])

  const displayColumns = React.useMemo(() => {
    if (!columnVisibility) return orderedColumns
    return orderedColumns.filter((c) => columnVisibility[c.key] !== false)
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
  const headerMatrix = React.useMemo(
    () => (grouped ? buildHeaderMatrix(displayColumns) : null),
    [grouped, displayColumns],
  )

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
        filters: remoteFilter ? mergeFilterValues(filters ?? {}, filterValues ?? {}) : {},
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
  React.useEffect(() => {
    let ctrl = proxyRef.current
    if (!ctrl && hasProxy) {
      ctrl = createProxySource()
      proxyRef.current = ctrl
      forceRender()
    }
    if (ctrl && proxyConfig?.autoLoad !== false) void ctrl.request()
    return () => {
      if (proxyRef.current === ctrl) proxyRef.current = null
      ctrl?.destroy()
    }
  }, [hasProxy])

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

  // Sort state managed by useTableSort hook (controlled/uncontrolled, comparator, sorted data).
  const {
    sortState: sort,
    cycleSort,
    sortComparator,
    sortedData: localSortedData,
    multiSortState,
    cycleMultiSort,
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
  })
  // remoteSort parity: the server owns the ordering — never re-sort locally.
  const sortedData = remoteSort ? liveData : localSortedData

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
  const mergedProxyFilters = (form: Record<string, string>): Record<string, string> =>
    mergeFilterValues(mergeFormFilters(filters ?? {}, form), filterValues ?? {})
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
  }, [proxy, remoteFilter, filters, filterValues, formApplied])

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
  /** Shared commit write-back for cell AND row edit sessions (batch K): the
   *  live data update + onCellEdit fire, skipping no-op commits. `ctx.row` is
   *  the CURRENT row object (row sessions resolve it by key). */
  const commitValue = (
    ctx: { row: Row; col: IrisTableColumn<Row>; rowIndex: number },
    value: unknown,
  ): void => {
    const oldValue = getCellValue(ctx.row, ctx.col)
    if (value === oldValue) return
    const k = rowKeyOf(ctx.row, ctx.rowIndex)
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
  }
  const cellEdit = React.useMemo(
    () =>
      createCellEdit({
        validate: (draft, _target) => {
          const ctx = editCtxRef.current
          if (!ctx) return null
          // Declarative editRules run async (they may contain async validators);
          // the legacy validate callback stays synchronous for the sync commit
          // path.
          if (ctx.col.editRules && ctx.col.editRules.length > 0) {
            return validateEditRulesAsync(ctx.col.editRules, draft, ctx.row).then((r) =>
              r.valid ? null : (r.messages[0] ?? null),
            )
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
        if (col.editRules && col.editRules.length > 0) {
          return validateEditRulesAsync(col.editRules, draft, row).then((r) =>
            r.valid ? null : (r.messages[0] ?? null),
          )
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
        if (row) commitValue({ row, col, rowIndex }, value)
      },
    })
  const beginRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const k = rowKeyOf(row, rowIndex)
    if (k == null) return
    const editableCols = leafColumns.filter((c) => c.editable)
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
        s.commitEdit()
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
  ): void => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const editing = rowEditing
    const id = editing ? cellId(editing.k, col.key) : ''
    const session = rowSessionsRef.current.get(id)
    if (session) {
      session.commitEdit()
      if (session.getError() !== null) return
    }
    const start = leafColumns.indexOf(col)
    for (let i = start + dir; i >= 0 && i < leafColumns.length; i += dir) {
      const nextCol = leafColumns[i]!
      if (!nextCol.editable) continue
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
      if (!nextCol.editable) continue
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

  const handleColDragPointerUp = () => {
    if (!columnDrag) return
    if (colDragCtrl.isPending()) {
      colDragCtrl.cancel()
      return
    }
    const { activeId, overId } = colDragCtrl.end()
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
  const rowDragState = useStore(rowDragCtrl)
  const rowRectsRef = React.useRef<SortableRect[]>([])
  const spanOccupyRef = React.useRef<Set<string>>(new Set())
  // Footer occupy set (batch P): footerSpanMethod spans use their own ref so
  // body spanMethod keys never collide (the body and footer stacks are
  // independent coordinate spaces).
  const footerOccupyRef = React.useRef<Set<string>>(new Set())
  const [columnSettingsOpen, setColumnSettingsOpen] = React.useState(false)
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
    if (rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, rowRectsRef.current)
    }
  }

  const handleRowDragPointerUp = () => {
    if (!rowDrag) return
    if (rowDragCtrl.isPending()) {
      rowDragCtrl.cancel()
      return
    }
    const { activeId, overId } = rowDragCtrl.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const rows = [...bodyData] as Row[]
      const from = rows.findIndex((r, i) => String(rowKeyOf(r, i)) === activeId)
      const to = rows.findIndex((r, i) => String(rowKeyOf(r, i)) === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = rows.splice(from, 1)
        rows.splice(to, 0, moved)
        rowDrag.onReorder(rows)
      }
    }
    rowRectsRef.current = []
  }

  const handleRowDragPointerLeave = () => {
    if (rowDrag && rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.cancel()
    }
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
  }
  const clearFilterValues = (colKey: string): void => {
    const next = { ...(filterValues ?? {}) }
    delete next[colKey]
    onFilterValuesChange?.(next)
  }
  const handleContextMenu = (
    e: React.MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    idx: number,
    ci: number,
  ): void => {
    if (!contextMenu) return
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
    setContextMenuState({ open: true, items: contextMenu.items(params), params })
    setContextMenuSeq((s) => s + 1)
  }

  const beginEdit = (
    row: Row,
    col: IrisTableColumn<Row>,
    rowIdent: string | number,
    rowIndex: number,
  ) => {
    if (!col.editable) return
    // Any manual start supersedes a stashed Tab-navigation intent (M1).
    pendingNavRef.current = null
    editCtxRef.current = { row, col, rowIndex }
    const current = getCellValue(row, col)
    cellEdit.startEdit(cellId(rowIdent, col.key), col.key, current == null ? '' : String(current))
  }
  const cancelEdit = () => {
    cellEdit.cancelEdit()
  }
  const commitEdit = (): boolean => {
    return cellEdit.commitEdit()
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
    if (ctx.col.editRules && ctx.col.editRules.length > 0) {
      e.preventDefault()
      pendingNavRef.current = {
        dir,
        row: ctx.row,
        col: ctx.col,
        k: rowKeyOf(ctx.row, ctx.rowIndex),
        idx: ctx.rowIndex,
      }
      cellEdit.commitEdit()
      return
    }
    if (!cellEdit.commitEdit()) {
      e.preventDefault()
      return
    }
    const start = leafColumns.indexOf(ctx.col)
    for (let i = start + dir; i >= 0 && i < leafColumns.length; i += dir) {
      const nextCol = leafColumns[i]!
      if (!nextCol.editable) continue
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
        if (col.editable && !rowSessionsRef.current.has(id)) {
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
    } else if (col.editable && editConfig?.trigger === 'click' && k != null) {
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
  const commitRowList = React.useCallback((next: Row[]) => {
    setLiveData(next)
    externalDataRef.current = next
    onDataChangeRef.current?.(next)
  }, [])
  const handleRef = React.useRef<IrisTableHandle<Row> | null>(null)
  handleRef.current = {
    insertRow: (row, index) => {
      commitRowList(insertRowInList(externalDataRef.current ?? [], rowKey, row, index))
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
        commitRowList(next)
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
      commitRowList(rows)
    },
    updateRow: (key, patch) => {
      commitRowList(updateRowInList(externalDataRef.current ?? [], rowKey, key, patch))
    },
    refetch: () => {
      proxyRef.current?.refetch()
    },
    getData: () => [...(externalDataRef.current ?? [])],
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
    if (remoteFilter) return sortedData
    const merged: Record<string, string> = proxy
      ? (filters ?? {})
      : mergeFormFilters(filters ?? {}, formApplied)
    const active = Object.entries(merged).filter(([, v]) => v != null && v !== '')
    // Batch I: per-column checked sets OR-match the raw String(value); a set
    // applies only when non-empty. AND-ed with the text channel below.
    const checkedEntries = Object.entries(filterValues ?? {}).filter(
      ([, values]) => values.length > 0,
    )
    if (active.length === 0 && checkedEntries.length === 0) return sortedData
    return sortedData.filter((row) => {
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
      return textOk && setsOk
    })
  }, [sortedData, filters, formApplied, displayColumns, remoteFilter, proxy, filterValues])
  const bodyData = flatTree ? flatTree.map((t) => t.row) : filteredData

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
    | { kind: 'group-header'; groupKey: string; count: number }
    | { kind: 'row'; row: Row; rowIndex: number }
    | { kind: 'group-summary'; groupKey: string; rows: Row[] }
  const groupCol = leafColumns.find((c) => c.groupBy)
  const groupPlan = React.useMemo<BodyPlanEntry[] | null>(() => {
    if (!groupCol || treeMode) return null
    const groups = groupRows(bodyData, (row) => String(getCellValue(row, groupCol)))
    const indexOf = new Map<Row, number>()
    bodyData.forEach((r, i) => indexOf.set(r, i))
    const plan: BodyPlanEntry[] = []
    const hasSummary = leafColumns.some((c) => c.summary)
    for (const g of groups) {
      plan.push({ kind: 'group-header', groupKey: g.key, count: g.rows.length })
      for (const row of g.rows) plan.push({ kind: 'row', row, rowIndex: indexOf.get(row) ?? 0 })
      if (hasSummary) plan.push({ kind: 'group-summary', groupKey: g.key, rows: g.rows })
    }
    return plan
  }, [groupCol, bodyData, treeMode, leafColumns])

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
  }, [leafColumns, selectable, columnWidths, hasDetail])

  // Sticky offsets for pinned columns: each accumulates the resolved widths of
  // the pinned columns between it and its edge (plus the selection column on
  // the left). Requires a numeric width; falls back to a default.
  const pinnedOffsets = React.useMemo(() => {
    const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
    const widthOf = (col: IrisTableColumn<Row>): number =>
      columnWidths[col.key] ?? (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH)
    let left =
      (hasDetail ? EXPAND_COL_WIDTH : 0) + (selectable !== 'none' ? SELECTION_COL_WIDTH : 0)
    for (const col of leafColumns) {
      if (col.pinned === 'left') {
        map[col.key] = { side: 'left', offset: left }
        left += widthOf(col)
      }
    }
    let right = 0
    for (let i = leafColumns.length - 1; i >= 0; i -= 1) {
      const col = leafColumns[i]
      if (col?.pinned === 'right') {
        map[col.key] = { side: 'right', offset: right }
        right += widthOf(col)
      }
    }
    return map
  }, [leafColumns, columnWidths, selectable])

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
    if (!keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    // Only navigate from a grid cell — never hijack arrows inside an editing
    // cell's <input> (which carries no data-grid-row).
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyData.length,
      colCount: leafColumns.length,
      pageSize: 10,
    })
    setFocusedCell(next)
    const cell = rootRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }

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

  const buildRangeTsv = React.useCallback((range: CellRange): string => {
    const body = liveBodyRef.current
    const cols = liveLeafRef.current
    const lines: string[] = []
    for (let r = range.start.row; r <= range.end.row; r += 1) {
      const row = body[r]
      const cells: string[] = []
      for (let c = range.start.col; c <= range.end.col; c += 1) {
        const col = cols[c]
        cells.push(row && col ? tsvCell(getCellValue(row, col)) : '')
      }
      lines.push(cells.join('\t'))
    }
    return lines.join('\n')
  }, [])

  const pasteIntoRange = React.useCallback(
    async (range: CellRange): Promise<void> => {
      if (!rowKey) return
      const text = await readClipboardText()
      if (text == null) return
      const body = liveBodyRef.current
      const cols = liveLeafRef.current
      if (body.length === 0 || cols.length === 0) return
      // Line i / cell j of the clipboard lands at (anchor.row + i, anchor.col + j);
      // cells beyond the last row/col are ignored. One batched commitRowList.
      const byKey = new Map<string | number, Record<string, string>>()
      const lines = text.split(/\r?\n/)
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
          const prev = byKey.get(k)
          byKey.set(k, { ...prev, [cols[colIdx]!.key]: cells[j]! })
        }
      }
      if (byKey.size === 0) return
      const keyField = rowKey
      const next = (externalDataRef.current ?? []).map((r) => {
        const k = (r as Record<string, unknown>)[keyField]
        const patch = k != null ? byKey.get(k as string | number) : undefined
        return patch ? { ...r, ...patch } : r
      })
      commitRowList(next)
    },
    [rowKey, commitRowList],
  )

  React.useEffect(() => {
    if (!clipConfig) return
    const onKey = (e: KeyboardEvent): void => {
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
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (!mod || (key !== 'c' && key !== 'v')) return
      const range = cellRangeCtrl.getRange()
      if (!range) return
      if (key === 'c') {
        if (clipConfig.copy === false) return
        e.preventDefault()
        void writeClipboardText(buildRangeTsv(range))
      } else {
        if (clipConfig.paste === false) return
        e.preventDefault()
        void pasteIntoRange(range)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clipConfig, cellRangeCtrl, buildRangeTsv, pasteIntoRange])

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
      if (col.pinned) set.add(i)
    })
    return set
  }, [columnVirtualization, leafColumns, scrollLeft, viewportWidth, resolvedColWidths])

  // 1-based grid track for a column (after the optional selection track), so a
  // rendered cell lands in the right place even when earlier cells are skipped.
  const colTrack = (i: number): number => (hasDetail ? 1 : 0) + (selectable !== 'none' ? 2 : 1) + i

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
  const borderStyle = bordered ? '1px solid var(--iris-border)' : 'none'

  // Cell tooltips (vxe tooltipConfig parity, title mode, batch G): a native
  // `title` on every body cell — content from the callback or the raw cell
  // value; editing cells are exempt, and empty content drops the tooltip (vxe
  // empty-content parity). Truncation gating is not implemented: titles render
  // on every cell regardless of `showAll` (documented simplification — cheap
  // and explicit).
  const cellTooltip = (row: Row, col: IrisTableColumn<Row>): string | undefined => {
    if (!tooltipConfig) return undefined
    const raw = getCellValue(row, col)
    const content = tooltipConfig.content
      ? tooltipConfig.content(row, col)
      : col.formatter
        ? (() => {
            const formatted = col.formatter(raw, row)
            return typeof formatted === 'string' ? formatted : String(raw ?? '')
          })()
        : String(raw ?? '')
    return content === '' ? undefined : content
  }

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
        onClick={() => {
          onRowClick?.(row, idx)
          if (onCurrentRowChange && k != null) {
            if (beforeCurrentRowChange?.(k, row) !== false) onCurrentRowChange(k, row)
          }
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
        {seq ? (
          <div
            role="cell"
            data-iris-table-cell="__seq"
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
              checkboxRange
                ? (e: React.MouseEvent) => {
                    // vxe checkboxConfig isShiftKey parity: shift-click toggles
                    // the whole range between the anchor and this row. The
                    // label forwards a second click to the <input> —
                    // preventDefault on the original click cancels the
                    // forwarded one AND the single-toggle change event, so the
                    // target row is not toggled twice (the range covers it).
                    if (e.shiftKey && checkboxAnchorRef.current !== null) {
                      e.preventDefault()
                      toggleRowRange(checkboxAnchorRef.current, k)
                    }
                    // Always move the anchor — even without shift.
                    checkboxAnchorRef.current = k ?? null
                  }
                : undefined
            }
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              background: 'var(--iris-cell-bg, transparent)',
              borderBottom: borderStyle,
            }}
          >
            <IrisCheckbox
              checked={selected}
              disabled={checkMethod ? !checkMethod(row, idx) : false}
              onChange={() => toggleRow(row, idx)}
              aria-label={t('table.selectRow', { key: String(k ?? idx) })}
            />
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
          const editing = rowMode
            ? rowSessions.has(cellId(k, col.key))
            : cellEdit.isEditing(cellId(k, col.key), col.key)
          // Batch Q (vxe editDirtyConfig parity): dirty flag + rendered
          // marker for this cell (attr, class, relative positioning).
          const dirtyInfo = dirtyCellState(editDirtyConfig, dirtyCellsRef.current, k, col.key)
          const fnrCellKey = `${idx}:${ci}`
          const fnrCellActive = fnrActiveKey === fnrCellKey
          const fnrCellMatched = fnrMatchSet.has(fnrCellKey)
          return (
            <div
              key={col.key}
              role="cell"
              data-iris-table-cell={col.key}
              data-iris-table-pinned={col.pinned}
              data-editable={col.editable ? '' : undefined}
              data-editing={editing ? '' : undefined}
              data-iris-cell-dirty={dirtyInfo.attr}
              title={editing ? undefined : cellTooltip(row, col)}
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
                    onClick: (e: React.MouseEvent) => {
                      if (e.shiftKey) {
                        cellRangeCtrl.extendRange(idx, ci)
                      } else {
                        cellRangeCtrl.startRange(idx, ci)
                      }
                    },
                  }
                : null)}
              {...(fnrHighlighting
                ? {
                    'data-iris-fnr-match': fnrCellMatched ? 'true' : undefined,
                    'data-iris-fnr-active': fnrCellActive ? 'true' : undefined,
                  }
                : null)}
              onDoubleClick={
                rowMode
                  ? k != null
                    ? () => switchRowEdit(row, idx, col.key)
                    : undefined
                  : col.editable
                    ? () => beginEdit(row, col, k, idx)
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
                      }
                    : col.editable && editConfig?.trigger === 'click'
                      ? () => beginEdit(row, col, k, idx)
                      : undefined
              }
              style={{
                ...baseCellStyle,
                ...dirtyInfo.posStyle,
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
                borderBottom: borderStyle,
                cursor: col.editable ? 'cell' : cellRange ? 'default' : undefined,
                ...(editing ? { padding: '4px 8px' } : null),
                ...pinnedStyle(col.key),
                ...(cellStyle?.(row, col, idx) ?? null),
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
                        onTab={(e, dir) => moveRowEditOnTab(e, dir, col)}
                        onCommit={() => session.commitEdit()}
                        onCancel={cancelRowEdit}
                        onSessionIdle={() => onRowSessionIdle(id)}
                        focusToken={rowFocus.colKey === col.key ? rowFocus.seq : 0}
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
                  />
                )
              ) : col.render ? (
                col.render(raw, row, idx)
              ) : col.html ? (
                <span
                  // vxe type=html parity — opt-in; the caller guarantees the
                  // content is trusted (XSS risk, matching the vxe docs warning).
                  dangerouslySetInnerHTML={{ __html: String(raw ?? '') }}
                />
              ) : col.link ? (
                (() => {
                  // vxe cell link parity (batch L): wraps the formatted/raw text
                  // in an anchor; null/undefined falls through to formatter/raw.
                  const link = col.link(raw, row)
                  if (!link) {
                    return col.formatter ? col.formatter(raw, row) : (raw as React.ReactNode)
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
                        (col.formatter ? col.formatter(raw, row) : (raw as React.ReactNode))}
                    </a>
                  )
                })()
              ) : col.formatter ? (
                // vxe formatter parity (batch I): display-only — sorting,
                // filtering, editing and summary all read the raw value.
                col.formatter(raw, row)
              ) : (
                (raw as React.ReactNode)
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Batch-M group header row (vxe group-config parity): spans every grid
  // track (`gridColumn: 1 / -1`), shows the group value + row count. In the
  // virtual path `extraStyle` fills the fixed-height slot.
  const renderGroupHeader = (
    entry: { groupKey: string; count: number },
    extraStyle?: React.CSSProperties,
  ): React.ReactElement => (
    <div
      key={`group:${entry.groupKey}`}
      role="row"
      data-iris-group-row=""
      data-iris-group-key={entry.groupKey}
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
        <span data-iris-group-value="">{entry.groupKey}</span>
        <span
          data-iris-group-count=""
          style={{ color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' }}
        >
          ({entry.count})
        </span>
      </div>
    </div>
  )

  // One body entry (data row or its detail wrap), grouped or not: keeps the
  // row's ORIGINAL bodyData index so seq/striped/span/checkMethod semantics
  // are identical to the ungrouped map.
  const renderBodyEntry = (row: Row, idx: number): React.ReactNode => {
    if (spanMethod && idx === 0) spanOccupyRef.current.clear()
    const main = renderRow(row, idx, undefined, flatTree?.[idx])
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
  // Fixed height (batch N): any of height/min/max makes the root a vertical
  // scroll container; the injected stylesheet pins the header row. Batch Q:
  // `autoResize` with a positive measure engages the same machinery so the
  // auto-filled root scrolls/sticks exactly like an explicit-height table.
  const fixedHeight =
    height !== undefined ||
    minHeight !== undefined ||
    maxHeight !== undefined ||
    ((autoResize || syncResize) && autoSize !== null)
  // Virtual body items: always typed as plan entries (rows wrapped with their
  // ORIGINAL bodyData index) so the `kind` discriminant narrows cleanly — a
  // generic `Row` type param defeats `'kind' in` narrowing.
  const virtualItems: BodyPlanEntry[] =
    groupPlan ?? bodyData.map((row, rowIndex) => ({ kind: 'row' as const, row, rowIndex }))

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
      {formConfig ? (
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
      {toolbar ? (
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
          }}
        >
          {toolbar.title ? (
            <span style={{ fontWeight: 600, color: 'var(--iris-foreground)' }}>
              {toolbar.title}
            </span>
          ) : null}
          <div style={{ flex: 1 }} />
          {toolbar.onRefresh ? (
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
          {toolbar.onImport ? (
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
          {toolbar.onExport ? (
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
          {toolbar.columnSettings && columnVisibility ? (
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
          {selectable === 'multi' && displaySelection.length > 0 && batchAction ? (
            <button
              type="button"
              data-iris-table-toolbar-batch=""
              onClick={() => batchAction.onClick([...displaySelection])}
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
          {toolbar.buttons && toolbar.buttons.length > 0
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
        data-iris-scrollbar-thin={scrollbarConfig?.theme === 'thin' ? 'true' : undefined}
        data-iris-auto-resize={autoResize ? 'true' : undefined}
        data-iris-no-hover={highlightHoverRow ? undefined : 'true'}
        className={className}
        onKeyDown={
          keyboardNavigation || cellRange
            ? (e) => {
                if (keyboardNavigation) handleGridKey(e)
                if (cellRange) handleCellRangeKey(e)
              }
            : undefined
        }
        onPointerMove={
          rowDrag || columnDrag
            ? (e) => {
                handleRowDragPointerMove(e)
                handleColDragPointerMove(e)
              }
            : undefined
        }
        onPointerUp={
          rowDrag || columnDrag
            ? () => {
                handleRowDragPointerUp()
                handleColDragPointerUp()
              }
            : undefined
        }
        onPointerLeave={rowDrag ? handleRowDragPointerLeave : undefined}
        onScroll={
          columnVirtualization
            ? (e) => setScrollLeft((e.currentTarget as HTMLDivElement).scrollLeft)
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
        }}
      >
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
            {hasDetail ? (
              <div role="columnheader" style={{ gridColumn: '1', gridRow: '1 / -1' }} />
            ) : null}
            {selectable !== 'none' ? (
              <div
                role="columnheader"
                data-iris-table-header=""
                style={{
                  gridColumn: hasDetail ? '2' : '1',
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
                const lead = (hasDetail ? 1 : 0) + (selectable !== 'none' ? 1 : 0)
                return (
                  <div
                    key={`${col.key}-${cell.level}`}
                    role="columnheader"
                    data-iris-table-header={col.key}
                    data-iris-table-header-group={isLeaf ? undefined : ''}
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
                    onClick={sortable ? () => cycleHeaderSort(col) : undefined}
                    onKeyDown={sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                    style={{
                      gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
                      gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
                      ...baseCellStyle,
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
                    }}
                  >
                    <span>
                      {col.titlePrefix}
                      {col.title}
                      {col.titleSuffix}
                    </span>
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
                        }
                      : () => setCurrentColumn(col)
                  }
                  onKeyDown={col.sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                  data-iris-table-header={col.key}
                  data-iris-table-pinned={col.pinned}
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
            {emptyState ?? t('table.empty')}
          </div>
        ) : virtualScroll && (!treeMode || !hasDetail) ? (
          // Virtualize flat mode, and tree mode too — tree rows are uniform height,
          // so the only thing that bars it is variable-height detail panels, hence
          // the `!hasDetail` guard. `bodyData` is the flattened visible rows (=
          // `sortedData` in flat mode); `flatTree?.[idx]` supplies each row's tree
          // meta (depth + toggle), with `idx` the absolute row index from the scroller.
          <IrisVirtualScroll
            items={virtualItems}
            itemHeight={virtualScroll.itemHeight}
            height={virtualScroll.height}
            buffer={virtualScroll.buffer}
            keyOf={(item) =>
              item.kind === 'group-header'
                ? `group:${item.groupKey}`
                : item.kind === 'group-summary'
                  ? `group-summary:${item.groupKey}`
                  : String(rowKeyOf(item.row, item.rowIndex))
            }
            renderItem={(item) =>
              item.kind === 'group-header'
                ? renderGroupHeader(item, { height: '100%' })
                : item.kind === 'group-summary'
                  ? renderSummaryRow(item.rows, item.groupKey, { height: '100%' })
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
            onSelect={contextMenu.onSelect}
            onClose={closeContextMenu}
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
                />
              )
            })()
          : null}
        {proxy ? (
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
