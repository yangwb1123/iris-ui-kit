import {
  createEffect,
  createMemo,
  createSignal,
  For,
  mergeProps,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from 'solid-js'
import {
  aggregate,
  buildHeaderMatrix,
  computeVirtualRange,
  createCellRange,
  createExpansion,
  createSelectionModel,
  flattenLeafColumns,
  flattenTree,
  withSortedChildren,
  nextGridCell,
  type ExpansionModel,
  type GridNavKey,
  type HeaderCell,
  type TreeRow,
} from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import { IrisVirtualScroll } from '../virtual-scroll/IrisVirtualScroll'
import { useTableSort } from './useTableSort'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortState,
  IrisTableCellEditEvent,
  IrisTableVirtualOptions,
} from './types'

export interface IrisTableProps<Row extends Record<string, unknown> = Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  data: Row[]
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  onSelectionChange?: (selection: Array<string | number>) => void
  sort?: IrisTableSortState | null
  onSortChange?: (sort: IrisTableSortState | null) => void
  striped?: boolean
  bordered?: boolean
  loading?: boolean
  error?: boolean
  /** Enable column resizing (drag the header's trailing edge or focus + arrow keys). */
  resizableColumns?: boolean
  /** Controlled per-column pixel widths, keyed by column `key`. */
  columnWidths?: IrisTableColumnWidths
  /** Uncontrolled initial per-column pixel widths, keyed by column `key`. */
  defaultColumnWidths?: IrisTableColumnWidths
  /** Notified with the full width map whenever the user resizes a column. */
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  onRowClick?: (row: Row, index: number) => void
  onCellEdit?: (event: IrisTableCellEditEvent<Row>) => void
  /**
   * Render an expandable detail panel beneath a row. Providing this adds a
   * leading expand-toggle column; clicking it reveals a full-width detail row.
   */
  renderDetail?: (row: Row, rowIndex: number) => JSX.Element
  /** Which rows can expand a detail panel. Defaults to all rows when `renderDetail` is set. */
  rowExpandable?: (row: Row, rowIndex: number) => boolean
  /** Initially-expanded row keys (uncontrolled). */
  defaultExpandedRowKeys?: Array<string | number>
  /** Notified with the expanded row keys whenever they change. */
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /**
   * Return a row's child rows to enable TREE MODE: `data` is treated as the root
   * rows, each parent gets an inline expand toggle in its first cell, and the
   * (shared) expansion model controls which branches are visible. Column sort
   * reorders siblings hierarchically (each level sorted, structure kept), and
   * tree rows virtualize like flat rows when `virtualScroll` is set (unless
   * `renderDetail` is also used, since detail panels are variable-height).
   * Additive — absent means the table stays in flat mode.
   */
  getSubRows?: (row: Row) => Row[] | undefined
  /**
   * Enable WAI-ARIA grid keyboard navigation: the table becomes `role="grid"`
   * and Arrow / Home / End / Page Up·Down move a roving cell focus across the
   * data cells. Off by default; opt-in and additive (no effect on mouse / Tab
   * behavior). Does not hijack keystrokes while a cell is being edited.
   */
  keyboardNavigation?: boolean
  /**
   * Enable rectangular cell-range selection (Excel-style). Click starts a
   * range; Shift+Click or Shift+Arrow extends it; Escape clears it.
   * Cells within the range get `data-iris-cell-selected="true"`.
   */
  cellRange?: boolean
  /** Enable virtual scrolling for the body (renders only the visible window). */
  virtualScroll?: IrisTableVirtualOptions
  /**
   * Render only the horizontally-visible columns (plus pinned + a small
   * overscan) for very wide tables. Needs numeric column widths; the table
   * becomes a horizontal scroll container. Off-screen grid tracks stay sized,
   * so alignment, resize, and pinned columns keep working.
   */
  columnVirtualization?: boolean
  style?: JSX.CSSProperties
}

const DEFAULT_COL_WIDTH = 140
const DEFAULT_MIN_WIDTH = 60
const RESIZE_STEP = 16

function resolveInitialWidth(col: IrisTableColumn<Record<string, unknown>>): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return DEFAULT_COL_WIDTH
}

function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/**
 * Focusable resize grip at a column header's trailing edge. Pointer drag (via
 * `useDrag`) or Arrow-Left/Right adjusts the column's pixel width, min/max
 * clamped. `role="separator"` + `aria-orientation` follow the WAI-ARIA
 * window-splitter pattern. Solid mirror of the React `ColumnResizeHandle`.
 */
function ColumnResizeHandle(props: {
  colKey: string
  label: string
  /** Reads the column's current resolved width at drag/keypress time. */
  width: () => number
  minWidth: number
  maxWidth: number
  onResize: (key: string, width: number) => void
}): JSX.Element {
  const [handle, setHandle] = createSignal<HTMLElement | null>(null)
  let startWidth = 0
  const clamp = (w: number): number =>
    Math.max(props.minWidth, Math.min(props.maxWidth, Math.round(w)))

  useDrag({
    handle,
    onStart: () => {
      startWidth = props.width()
    },
    onDrag: ({ dx }) => props.onResize(props.colKey, clamp(startWidth + dx)),
  })

  return (
    <span
      ref={setHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${props.label}`}
      tabindex={0}
      data-iris-table-resize-handle=""
      data-column-key={props.colKey}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() - RESIZE_STEP))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() + RESIZE_STEP))
        }
      }}
      style={{
        position: 'absolute',
        top: '0',
        right: '0',
        bottom: '0',
        width: '8px',
        cursor: 'col-resize',
        'touch-action': 'none',
        'user-select': 'none',
      }}
    />
  )
}

/**
 * Data table. Renders as a CSS-grid layout. Supports sorting, row selection,
 * and inline editing. Opt-in virtual scrolling windows the body (flat AND tree
 * rows, which are uniform height) unless `renderDetail` is also set (detail
 * panels are variable-height). Solid port of the Vue IrisTable.
 */
export function IrisTable<Row extends Record<string, unknown> = Record<string, unknown>>(
  props: IrisTableProps<Row>,
): JSX.Element {
  const merged = mergeProps(
    {
      rowKey: 'id',
      selectable: 'none' as 'none' | 'single' | 'multi',
      striped: false,
      bordered: true,
      loading: false,
      error: false,
      resizableColumns: false,
      keyboardNavigation: false,
      cellRange: false,
      columnVirtualization: false,
    },
    props,
  )

  const { t } = useI18n()

  // ---- Multi-level (grouped) headers ----
  // A column with `children` forms a header GROUP spanning its leaf descendants;
  // the leaves drive the body. When nothing is grouped, `leafColumns` is the
  // original `columns` (same reference → flat path is byte-identical) and
  // `headerMatrix` is null (the single-row header renders unchanged).
  const grouped = createMemo(() => merged.columns.some((c) => c.children && c.children.length > 0))
  const leafColumns = createMemo<IrisTableColumn<Row>[]>(() =>
    grouped() ? flattenLeafColumns(merged.columns) : merged.columns,
  )
  const headerMatrix = createMemo<HeaderCell<IrisTableColumn<Row>>[][] | null>(() =>
    grouped() ? buildHeaderMatrix(merged.columns) : null,
  )

  // ---- Column widths (opt-in resizing) ----
  // Uncontrolled widths live in `internalWidths`, seeded from each LEAF column's
  // resolved width (a header-group column carries no body width; only its leaves
  // do) plus any `defaultColumnWidths` override. Controlled tables render from
  // the `columnWidths` prop. `effectiveWidths()` is the map the grid template +
  // column virtualization read; in the off/unset case it still resolves to each
  // column's natural width, so the rendered grid is unchanged from before.
  const [internalWidths, setInternalWidths] = createSignal<IrisTableColumnWidths>({
    ...(props.defaultColumnWidths ?? {}),
  })
  // Seed any not-yet-seen leaf column on column change (keeps existing entries,
  // including user-resized + defaultColumnWidths values).
  createEffect(() => {
    const cols = leafColumns()
    setInternalWidths((prev) => {
      let changed = false
      const seeded = { ...prev }
      for (const col of cols) {
        if (seeded[col.key] === undefined) {
          seeded[col.key] = resolveInitialWidth(col as IrisTableColumn<Record<string, unknown>>)
          changed = true
        }
      }
      return changed ? seeded : prev
    })
  })
  const widthsControlled = (): boolean => props.columnWidths !== undefined
  const effectiveWidths = (): IrisTableColumnWidths =>
    widthsControlled() ? props.columnWidths! : internalWidths()
  const widthOf = (col: IrisTableColumn<Row>): number =>
    effectiveWidths()[col.key] ??
    resolveInitialWidth(col as IrisTableColumn<Record<string, unknown>>)
  const setColumnWidths = (next: IrisTableColumnWidths): void => {
    if (!widthsControlled()) setInternalWidths(next)
    merged.onColumnWidthsChange?.(next)
  }

  // ---- Sort (useTableSort) ----
  const {
    sortState: effectiveSort,
    cycleSort,
    sortComparator,
    sortedData: sortedRows,
  } = useTableSort<Row>(() => merged.data ?? [], {
    leafColumns: leafColumns(),
    sort: props.sort,
    onSortChange: (next) => merged.onSortChange?.(next),
  })

  const handleHeaderClick = (column: IrisTableColumn<Row>): void => {
    cycleSort(column)
  }

  const rowId = (row: Row, index: number): string | number => {
    const v = row[merged.rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  // ---- Expandable detail rows ----
  // A leading toggle column + a full-width detail panel, driven by the
  // framework-agnostic createExpansion (multiple-open). Keys are strings. The
  // same expansion model is reused by tree mode (below) — they're mutually
  // exclusive (renderDetail vs getSubRows).
  const hasDetail = (): boolean => props.renderDetail !== undefined
  const expansion: ExpansionModel = createExpansion({
    mode: 'multiple',
    defaultExpanded: (props.defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => props.onExpandedRowsChange?.(keys),
  })
  const expandedKeys = useStore(expansion.store)
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail() && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

  // ---- Tree rows ----
  // Opt-in via getSubRows: flatten the (root) data into the visible flat list,
  // honoring the (shared) expansion model. `bodyRows` is what the body, the
  // select-all set, and the summary aggregate over; in flat mode it is identical
  // to sortedRows() (each row carries no tree meta).
  const flatTree = createMemo<Array<TreeRow<Row>> | null>(() => {
    if (props.getSubRows === undefined) return null
    const keys = expandedKeys()
    const compare = sortComparator()
    return flattenTree<Row>(sortedRows(), {
      getKey: (r) => String(rowId(r, 0)),
      // With an active sort, sort each level's children by the same comparator
      // so the whole tree reorders hierarchically.
      getChildren: compare
        ? withSortedChildren((r: Row) => props.getSubRows!(r), compare)
        : (r) => props.getSubRows!(r),
      isExpanded: (k) => keys.includes(k),
    })
  })
  // Body rows paired with their tree meta (meta is null in flat mode).
  const bodyEntries = createMemo<Array<{ row: Row; meta: TreeRow<Row> | null }>>(() => {
    const ft = flatTree()
    if (ft) return ft.map((t) => ({ row: t.row, meta: t }))
    return sortedRows().map((row) => ({ row, meta: null }))
  })
  const bodyRows = createMemo<Row[]>(() => bodyEntries().map((e) => e.row))

  // ---- Selection ----
  // Row-selection logic (single/multi toggle, dedup, select-all) is single-sourced
  // in the core model; the table keeps only its row-id mapping + rendering. Keyed
  // by string|number because row ids may be either.
  const selectionMode = merged.selectable === 'single' ? 'single' : 'multiple'
  const selectionModel = createSelectionModel<string | number>({
    mode: selectionMode,
    defaultSelected: props.selection ?? [],
    onChange: (keys) => merged.onSelectionChange?.(keys),
  })
  const selection = useStore(selectionModel.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  const selControlled = (): boolean => props.selection !== undefined
  createEffect(() => {
    if (selControlled()) selectionModel.sync(props.selection!)
  })

  // Controlled tables RENDER from the prop (true controlled semantics): a local
  // toggle emits onSelectionChange, but the displayed selection only changes when
  // the parent writes `selection` back — so a parent that validates/rejects a
  // change no longer sees the row flip optimistically. Uncontrolled renders from
  // the model store as before.
  const displaySelection = (): Array<string | number> => {
    // Subscribe to the model store even when controlled so a render read re-runs
    // after a (possibly-rejected) optimistic toggle — that re-asserts the prop's
    // value onto the native checkbox's `checked`, which the click mutated. The
    // returned value is always the prop in controlled mode.
    const store = selection()
    return selControlled() ? props.selection! : store
  }
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  const rebaseToProp = (): void => {
    if (selControlled()) selectionModel.sync(props.selection!)
  }

  const isSelected = (id: string | number): boolean => displaySelection().includes(id)

  const allRowIds = createMemo(() => bodyRows().map((r, i) => rowId(r, i)))
  const allSelected = createMemo(() => {
    const sel = displaySelection()
    const ids = allRowIds()
    return selControlled()
      ? ids.length > 0 && ids.every((id) => sel.includes(id))
      : selectionModel.isAllSelected(ids)
  })
  const someSelected = createMemo(() => {
    const sel = displaySelection()
    return !allSelected() && allRowIds().some((id) => sel.includes(id))
  })

  const toggleRow = (id: string | number): void => {
    if (merged.selectable === 'none') return
    rebaseToProp()
    selectionModel.toggle(id)
  }

  const toggleAll = (): void => {
    rebaseToProp()
    selectionModel.toggleAll(allRowIds())
  }

  // ---- Inline Editing ----
  const [editingCellId, setEditingCellId] = createSignal<string | null>(null)
  const [editingDraft, setEditingDraft] = createSignal('')
  const [editError, setEditError] = createSignal<string | null>(null)

  const beginEdit = (row: Row, column: IrisTableColumn<Row>, rowIdent: string | number): void => {
    if (!column.editable) return
    setEditingCellId(`${rowIdent}::${column.key}`)
    const current = getCellValue(row, column)
    setEditingDraft(current == null ? '' : String(current))
    setEditError(null)
  }

  const commitEdit = (row: Row, column: IrisTableColumn<Row>, rowIndex: number): void => {
    if (editingCellId() === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft()
    const newValue =
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? oldValue
          : Number(draft)
        : draft
    // A column validator can reject the draft: keep the editor open, surface the
    // message, and skip the commit until the value is valid (or the user cancels).
    if (column.validate) {
      const error = column.validate(newValue, row)
      if (error) {
        setEditError(error)
        return
      }
    }
    setEditError(null)
    setEditingCellId(null)
    if (newValue !== oldValue) {
      merged.onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
    }
  }

  const cancelEdit = (): void => {
    setEditError(null)
    setEditingCellId(null)
  }

  // ---- Grid keyboard navigation (opt-in) ----
  // Roving cell focus over the data cells, driven by the framework-agnostic
  // `nextGridCell`. Off by default; additive (no effect on mouse / Tab).
  let rootRef: HTMLDivElement | undefined
  const [focusedCell, setFocusedCell] = createSignal<{ row: number; col: number } | null>(null)
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
  const handleGridKey = (e: KeyboardEvent): void => {
    if (!merged.keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    // Only navigate from a grid cell — never hijack arrows inside an editing
    // cell's <input> (which carries no data-grid-row).
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell() ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyRows().length,
      colCount: leafColumns().length,
      pageSize: 10,
    })
    setFocusedCell(next)
    const cell = rootRef?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }

  // ---- Cell-range selection (opt-in via `cellRange`) ----
  // Controller lives outside reactive tracking; bridged into Solid via a signal
  // subscribed to the core store.
  const cellRangeCtrl = createCellRange()
  const [cellRangeState, setCellRangeState] = createSignal(cellRangeCtrl.getState())
  onCleanup(cellRangeCtrl.subscribe((s) => setCellRangeState(s)))

  const isInRange = (row: number, col: number): boolean => {
    const { anchor, active } = cellRangeState()
    if (!anchor || !active) return false
    const minRow = Math.min(anchor.row, active.row)
    const maxRow = Math.max(anchor.row, active.row)
    const minCol = Math.min(anchor.col, active.col)
    const maxCol = Math.max(anchor.col, active.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }

  const handleCellRangeKey = (e: KeyboardEvent): void => {
    if (!merged.cellRange) return
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    if (!e.shiftKey || !ARROW_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    const rowAttr = target.dataset.irisCellRow
    const colAttr = target.dataset.irisCellCol
    if (rowAttr === undefined || colAttr === undefined) return
    e.preventDefault()
    const anchor = cellRangeCtrl.getState().anchor
    const active = anchor
      ? (cellRangeCtrl.getState().active ?? { row: Number(rowAttr), col: Number(colAttr) })
      : { row: Number(rowAttr), col: Number(colAttr) }
    let nextRow = active.row
    let nextCol = active.col
    if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
    else if (e.key === 'ArrowDown') nextRow = Math.min(bodyRows().length - 1, nextRow + 1)
    else if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
    else nextCol = Math.min(leafColumns().length - 1, nextCol + 1)
    cellRangeCtrl.extendRange(nextRow, nextCol)
  }

  // ---- Grid template ----
  const SELECTION_COL_WIDTH = 40
  const EXPAND_COL_WIDTH = 40
  const gridTemplate = createMemo(() => {
    const parts: string[] = []
    if (hasDetail()) parts.push(`${EXPAND_COL_WIDTH}px`)
    if (merged.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
    for (const col of leafColumns()) {
      parts.push(`${widthOf(col)}px`)
    }
    return parts.join(' ')
  })

  // ---- Column virtualization (opt-in via `columnVirtualization`) ----
  // Render only the horizontally-visible columns (+ pinned + overscan) for very
  // wide tables. The root becomes a horizontal scroll container; off-screen grid
  // tracks stay sized via `gridTemplateColumns`, and each rendered cell is placed
  // on its 1-based grid track (`colTrack`) so it lands correctly even when
  // earlier cells are skipped. Off by default → `visibleColSet()` is null and
  // every column renders unchanged.
  const [scrollLeft, setScrollLeft] = createSignal(0)
  const [viewportWidth, setViewportWidth] = createSignal(0)

  // 1-based grid track for a column index, after the optional detail + selection
  // tracks, so a windowed cell lands in the right place.
  const colTrack = (i: number): number =>
    (hasDetail() ? 1 : 0) + (merged.selectable !== 'none' ? 2 : 1) + i

  onMount(() => {
    if (!merged.columnVirtualization || !rootRef) return
    const el = rootRef
    const measure = (): void => {
      setViewportWidth(el.clientWidth)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  // Set of column indices to render: the visible window + overscan, always
  // unioned with pinned columns. `null` ⇒ render every column (feature off).
  const visibleColSet = createMemo<Set<number> | null>(() => {
    if (!merged.columnVirtualization) return null
    const cols = leafColumns()
    const w = computeVirtualRange({
      itemCount: cols.length,
      scrollTop: scrollLeft(),
      viewportSize: viewportWidth(),
      itemSize: (i) => widthOf(cols[i]),
      buffer: 2,
    })
    const set = new Set<number>()
    for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
    cols.forEach((col, i) => {
      if (col.pinned) set.add(i)
    })
    return set
  })

  const sortIndicator = (col: IrisTableColumn<Row>): JSX.Element => {
    if (!col.sortable) return <></>
    const state = effectiveSort()
    const isActive = state?.key === col.key
    const direction = isActive ? state!.direction : null
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          'flex-direction': 'column',
          'margin-inline-start': '4px',
          'line-height': '0.6',
          'font-size': '8px',
          color: isActive ? 'var(--iris-primary)' : 'var(--iris-muted)',
        }}
      >
        <span style={{ opacity: direction === 'asc' ? '1' : '0.45' }}>▲</span>
        <span style={{ opacity: direction === 'desc' ? '1' : '0.45' }}>▼</span>
      </span>
    )
  }

  const stateRowStyle: JSX.CSSProperties = {
    padding: '32px 12px',
    'text-align': 'center',
    color: 'var(--iris-muted)',
  }

  // Tree mode is opt-in via getSubRows. The virtual-scroll path windows flat AND
  // tree rows (uniform height) — only variable-height detail panels bar it, hence
  // the `!hasDetail()` guard below.
  const treeMode = (): boolean => props.getSubRows !== undefined

  // Single source of truth for a body row's main `<div>`. The non-virtual body
  // wraps it with a detail panel; the virtual scroller renders it directly,
  // passing the per-row tree meta (`flatTree()[idx]`) at the scroller's absolute
  // index so indent + toggle render for windowed tree rows too.
  const renderRow = (row: Row, index: number, treeMeta: TreeRow<Row> | null): JSX.Element => {
    const id = rowId(row, index)
    const selected = (): boolean => isSelected(id)
    const expanded = (): boolean => expandedKeys().includes(String(id))
    const expandable = (): boolean => isRowExpandable(row, index)
    return (
      <div
        role="row"
        // Announce selection to assistive tech (parity with the React adapter);
        // `data-state` below stays as the styling hook.
        aria-selected={merged.selectable !== 'none' ? selected() : undefined}
        data-iris-table-row=""
        data-state={selected() ? 'selected' : undefined}
        // Tree depth/position for screen readers (1-based); the toggle button
        // carries aria-expanded for the control itself.
        aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
        aria-setsize={treeMeta ? treeMeta.setSize : undefined}
        aria-posinset={treeMeta ? treeMeta.posInset : undefined}
        onClick={() => merged.onRowClick?.(row, index)}
        style={{
          display: 'grid',
          'grid-template-columns': gridTemplate(),
          background: selected()
            ? 'var(--iris-surface-hover)'
            : merged.striped && index % 2 === 1
              ? 'var(--iris-surface)'
              : 'transparent',
          transition: 'background-color 120ms ease',
          cursor: 'default',
        }}
      >
        <Show when={hasDetail()}>
          <div
            role="cell"
            data-iris-table-cell="__expand"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <Show when={expandable()}>
              <button
                type="button"
                data-iris-table-expand-toggle=""
                aria-expanded={expanded()}
                aria-label={t(expanded() ? 'treeSelect.collapse' : 'treeSelect.expand')}
                onClick={(e) => {
                  e.stopPropagation()
                  expansion.toggle(String(id))
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '0',
                  font: 'inherit',
                  color: 'var(--iris-foreground)',
                  transform: expanded() ? 'rotate(90deg)' : 'none',
                  transition: 'transform 150ms',
                }}
              >
                ▶
              </button>
            </Show>
          </div>
        </Show>
        <Show when={merged.selectable !== 'none'}>
          <div
            role="cell"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <input
              type="checkbox"
              checked={selected()}
              onChange={() => toggleRow(id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('table.selectRow', { key: index + 1 })}
            />
          </div>
        </Show>
        <For each={leafColumns()}>
          {(col, colIndexAccessor) => {
            const cid = `${id}::${col.key}`
            const isEditing = (): boolean => editingCellId() === cid
            const isFirstCol = colIndexAccessor() === 0
            const colIndex = colIndexAccessor()
            const isFocused = (): boolean => {
              const fc = focusedCell()
              return fc ? fc.row === index && fc.col === colIndex : index === 0 && colIndex === 0
            }
            // Column virtualization: skip cells outside the visible window (+
            // pinned). When windowing, place the rendered cell on its grid track.
            const inWindow = (): boolean => {
              const set = visibleColSet()
              return !set || set.has(colIndex)
            }
            return (
              <Show when={inWindow()}>
                <div
                  role="cell"
                  data-iris-table-cell={col.key}
                  data-iris-table-pinned={col.pinned}
                  data-editable={col.editable ? '' : undefined}
                  data-editing={isEditing() ? '' : undefined}
                  data-grid-row={merged.keyboardNavigation ? index : undefined}
                  data-grid-col={merged.keyboardNavigation ? colIndex : undefined}
                  data-iris-cell-row={merged.cellRange ? index : undefined}
                  data-iris-cell-col={merged.cellRange ? colIndex : undefined}
                  data-iris-cell-selected={
                    merged.cellRange && isInRange(index, colIndex) ? 'true' : undefined
                  }
                  tabindex={merged.keyboardNavigation ? (isFocused() ? 0 : -1) : undefined}
                  onFocus={
                    merged.keyboardNavigation
                      ? () => setFocusedCell({ row: index, col: colIndex })
                      : undefined
                  }
                  onClick={
                    merged.cellRange
                      ? (e: MouseEvent) => {
                          if (e.shiftKey) {
                            cellRangeCtrl.extendRange(index, colIndex)
                          } else {
                            cellRangeCtrl.startRange(index, colIndex)
                          }
                        }
                      : undefined
                  }
                  onDblClick={col.editable ? () => beginEdit(row, col, id) : undefined}
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content':
                      col.align === 'right'
                        ? 'flex-end'
                        : col.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    padding: isEditing() ? '4px' : '8px var(--iris-padding-md)',
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-size': '14px',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    cursor: col.editable ? 'cell' : 'default',
                    background:
                      merged.cellRange && isInRange(index, colIndex)
                        ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                        : undefined,
                    ...(visibleColSet() ? { 'grid-column-start': String(colTrack(colIndex)) } : {}),
                  }}
                >
                  <Show when={treeMeta && isFirstCol}>
                    <span
                      data-iris-table-tree-indent=""
                      style={{
                        display: 'inline-flex',
                        'align-items': 'center',
                        flex: 'none',
                        'padding-left': `${treeMeta!.depth * 16}px`,
                      }}
                    >
                      <Show
                        when={treeMeta!.hasChildren}
                        fallback={
                          <span
                            aria-hidden="true"
                            style={{ display: 'inline-block', width: '16px' }}
                          />
                        }
                      >
                        <button
                          type="button"
                          data-iris-table-tree-toggle=""
                          aria-expanded={expandedKeys().includes(treeMeta!.key)}
                          aria-label={t(
                            expandedKeys().includes(treeMeta!.key)
                              ? 'treeSelect.collapse'
                              : 'treeSelect.expand',
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            expansion.toggle(treeMeta!.key)
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: '0',
                            'margin-right': '4px',
                            font: 'inherit',
                            color: 'var(--iris-foreground)',
                            transform: expandedKeys().includes(treeMeta!.key)
                              ? 'rotate(90deg)'
                              : 'none',
                            transition: 'transform 150ms',
                          }}
                        >
                          ▶
                        </button>
                      </Show>
                    </span>
                  </Show>
                  <Show
                    when={isEditing()}
                    fallback={
                      <Show when={col.renderCell} fallback={String(getCellValue(row, col) ?? '')}>
                        {col.renderCell!(row, index)}
                      </Show>
                    }
                  >
                    <>
                      <input
                        type={col.editor === 'number' ? 'number' : 'text'}
                        value={editingDraft()}
                        data-iris-table-editor=""
                        aria-invalid={editError() ? 'true' : undefined}
                        aria-describedby={editError() ? `${cid}-error` : undefined}
                        onInput={(e) => setEditingDraft((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitEdit(row, col, index)
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelEdit()
                          }
                        }}
                        onBlur={() => commitEdit(row, col, index)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          border: `1px solid ${
                            editError() ? 'var(--iris-danger)' : 'var(--iris-primary)'
                          }`,
                          'border-radius': 'var(--iris-radius-sm)',
                          padding: '4px 6px',
                          font: 'inherit',
                          background: 'var(--iris-background)',
                          color: 'var(--iris-foreground)',
                          outline: 'none',
                        }}
                      />
                      <Show when={editError()}>
                        <div
                          id={`${cid}-error`}
                          role="alert"
                          data-iris-table-editor-error=""
                          style={{
                            'margin-top': '2px',
                            'font-size': '12px',
                            color: 'var(--iris-danger)',
                          }}
                        >
                          {editError()}
                        </div>
                      </Show>
                    </>
                  </Show>
                </div>
              </Show>
            )
          }}
        </For>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
      // grid/table role as before (treegrid implies managed cell focus).
      role={merged.keyboardNavigation ? (treeMode() ? 'treegrid' : 'grid') : 'table'}
      data-iris-table=""
      data-column-virtualized={merged.columnVirtualization ? 'true' : undefined}
      onKeyDown={
        merged.keyboardNavigation || merged.cellRange
          ? (e: KeyboardEvent) => {
              if (merged.keyboardNavigation) handleGridKey(e)
              if (merged.cellRange) handleCellRangeKey(e)
            }
          : undefined
      }
      onScroll={
        merged.columnVirtualization
          ? (e: Event) => setScrollLeft((e.currentTarget as HTMLElement).scrollLeft)
          : undefined
      }
      style={{
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: merged.bordered ? '1px solid var(--iris-border)' : 'none',
        'border-radius': 'var(--iris-radius-md)',
        // Column virtualization turns the table into a horizontal scroll container.
        overflow: merged.columnVirtualization ? 'auto' : 'hidden',
        ...(merged.style ?? {}),
      }}
    >
      {/* Multi-level (grouped) header: a CSS grid of `headerMatrix().length`
          rows; each cell placed by its leaf-column span (colStart/colSpan) and
          row span. Renders INSTEAD of the single-row header when grouped. */}
      <Show when={grouped() && headerMatrix()}>
        <div
          role="row"
          data-iris-table-row="header"
          data-iris-table-header-grouped=""
          style={{
            display: 'grid',
            'grid-template-columns': gridTemplate(),
            'grid-template-rows': `repeat(${headerMatrix()!.length}, auto)`,
          }}
        >
          <Show when={hasDetail()}>
            <div role="columnheader" style={{ 'grid-column': '1', 'grid-row': '1 / -1' }} />
          </Show>
          <Show when={merged.selectable !== 'none'}>
            <div
              role="columnheader"
              style={{
                'grid-column': hasDetail() ? '2' : '1',
                'grid-row': '1 / -1',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                padding: '8px',
                background: 'var(--iris-surface)',
                'border-bottom': '1px solid var(--iris-border)',
              }}
            >
              <Show when={merged.selectable === 'multi'}>
                <input
                  type="checkbox"
                  checked={allSelected()}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected()
                  }}
                  onChange={toggleAll}
                  aria-label={t('table.selectAll')}
                />
              </Show>
            </div>
          </Show>
          <For each={headerMatrix()!.flat()}>
            {(cell) => {
              const col = cell.column
              const isLeaf = (): boolean => !col.children || col.children.length === 0
              const sortable = (): boolean => isLeaf() && !!col.sortable
              const lead = (hasDetail() ? 1 : 0) + (merged.selectable !== 'none' ? 1 : 0)
              return (
                <div
                  role="columnheader"
                  data-iris-table-header={col.key}
                  data-iris-table-header-group={isLeaf() ? undefined : ''}
                  aria-colspan={cell.colSpan}
                  onClick={sortable() ? () => handleHeaderClick(col) : undefined}
                  aria-sort={
                    sortable()
                      ? effectiveSort()?.key === col.key
                        ? effectiveSort()!.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  style={{
                    'grid-column': `${lead + cell.colStart} / span ${cell.colSpan}`,
                    'grid-row': `${cell.level + 1} / span ${cell.rowSpan}`,
                    position: 'relative',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': isLeaf() ? 'flex-start' : 'center',
                    padding: '8px var(--iris-padding-md)',
                    cursor: sortable() ? 'pointer' : 'default',
                    'user-select': sortable() ? 'none' : 'auto',
                    background: 'var(--iris-surface)',
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-weight': '600',
                    'font-size': '13px',
                    color: 'var(--iris-foreground)',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                  }}
                >
                  {col.title}
                  <Show when={sortable()}>{sortIndicator(col)}</Show>
                </div>
              )
            }}
          </For>
        </div>
      </Show>

      {/* Header (flat) — unchanged when not grouped. */}
      <Show when={!grouped()}>
        <div
          role="row"
          data-iris-table-header-row=""
          style={{
            display: 'grid',
            'grid-template-columns': gridTemplate(),
          }}
        >
          <Show when={hasDetail()}>
            <div
              role="columnheader"
              data-iris-table-header="__expand"
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                padding: '8px',
                background: 'var(--iris-surface)',
                'border-bottom': '1px solid var(--iris-border)',
              }}
            />
          </Show>
          <Show when={merged.selectable !== 'none'}>
            <div
              role="columnheader"
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                padding: '8px',
                background: 'var(--iris-surface)',
                'border-bottom': '1px solid var(--iris-border)',
              }}
            >
              <Show when={merged.selectable === 'multi'}>
                <input
                  type="checkbox"
                  checked={allSelected()}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected()
                  }}
                  onChange={toggleAll}
                  aria-label={t('table.selectAll')}
                />
              </Show>
            </div>
          </Show>
          <For each={merged.columns}>
            {(col, colIndexAccessor) => {
              const colIndex = colIndexAccessor()
              // Column virtualization: skip headers outside the visible window
              // (+ pinned); place rendered headers on their grid track.
              const inWindow = (): boolean => {
                const set = visibleColSet()
                return !set || set.has(colIndex)
              }
              return (
                <Show when={inWindow()}>
                  <div
                    role="columnheader"
                    data-iris-table-header={col.key}
                    data-iris-table-pinned={col.pinned}
                    onClick={() => handleHeaderClick(col)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content':
                        col.align === 'right'
                          ? 'flex-end'
                          : col.align === 'center'
                            ? 'center'
                            : 'flex-start',
                      padding: '8px var(--iris-padding-md)',
                      cursor: col.sortable ? 'pointer' : 'default',
                      'user-select': col.sortable ? 'none' : 'auto',
                      background: 'var(--iris-surface)',
                      'border-bottom': '1px solid var(--iris-border)',
                      'font-weight': '600',
                      'font-size': '13px',
                      color: 'var(--iris-foreground)',
                      'white-space': 'nowrap',
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      ...(visibleColSet()
                        ? { 'grid-column-start': String(colTrack(colIndex)) }
                        : {}),
                    }}
                    aria-sort={
                      effectiveSort()?.key === col.key
                        ? effectiveSort()!.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : col.sortable
                          ? 'none'
                          : undefined
                    }
                  >
                    {col.title}
                    {sortIndicator(col)}
                    <Show when={merged.resizableColumns}>
                      <ColumnResizeHandle
                        colKey={col.key}
                        label={col.title}
                        width={() => widthOf(col)}
                        minWidth={col.minWidth ?? DEFAULT_MIN_WIDTH}
                        maxWidth={col.maxWidth ?? Infinity}
                        onResize={(key, w) => setColumnWidths({ ...effectiveWidths(), [key]: w })}
                      />
                    </Show>
                  </div>
                </Show>
              )
            }}
          </For>
        </div>
      </Show>

      {/* Body */}
      <Show
        when={!merged.error && !merged.loading}
        fallback={
          <Show
            when={merged.error}
            fallback={
              <div role="row" aria-busy="true" data-iris-table-row="loading" style={stateRowStyle}>
                {t('table.loading')}
              </div>
            }
          >
            <div role="row" data-iris-table-row="error" style={stateRowStyle}>
              {t('table.error')}
            </div>
          </Show>
        }
      >
        <Show
          when={bodyRows().length > 0}
          fallback={
            <div role="row" data-iris-table-row="empty" style={stateRowStyle}>
              {t('table.empty')}
            </div>
          }
        >
          <Show
            when={merged.virtualScroll && (!treeMode() || !hasDetail())}
            fallback={
              <div role="rowgroup" data-iris-table-body="">
                <For each={bodyEntries()}>
                  {(entry, indexAccessor) => {
                    const row = entry.row
                    const treeMeta = entry.meta
                    const index = indexAccessor()
                    const id = rowId(row, index)
                    const expanded = (): boolean => expandedKeys().includes(String(id))
                    const expandable = (): boolean => isRowExpandable(row, index)
                    return (
                      <>
                        {renderRow(row, index, treeMeta)}
                        {/* Full-width detail panel beneath an expanded, expandable
                            row (spans all grid tracks). Only in the non-virtual path. */}
                        <Show when={hasDetail() && expandable() && expanded()}>
                          <div
                            role="row"
                            data-iris-table-row-detail={String(id)}
                            style={{
                              display: 'grid',
                              'grid-template-columns': gridTemplate(),
                            }}
                          >
                            <div
                              role="cell"
                              data-iris-table-detail-cell=""
                              style={{
                                'grid-column': '1 / -1',
                                padding: '8px 12px',
                                'border-bottom': '1px solid var(--iris-border)',
                              }}
                            >
                              {props.renderDetail!(row, index)}
                            </div>
                          </div>
                        </Show>
                      </>
                    )
                  }}
                </For>
              </div>
            }
          >
            {/* Virtualize flat mode, and tree mode too — tree rows are uniform
                height, so the only thing that bars it is variable-height detail
                panels, hence the `!hasDetail()` guard. `bodyRows()` is the flattened
                visible rows (= sortedRows() in flat mode); `flatTree()?.[idx]`
                supplies each row's tree meta (depth + toggle), with `idx` the
                absolute row index the scroller passes its render callback. */}
            <IrisVirtualScroll
              items={bodyRows()}
              itemHeight={merged.virtualScroll!.itemHeight}
              height={merged.virtualScroll!.height}
              buffer={merged.virtualScroll!.buffer}
              keyOf={(row, idx) => rowId(row, idx)}
              renderItem={(row, idx) => renderRow(row, idx, flatTree()?.[idx] ?? null)}
            />
          </Show>
        </Show>
      </Show>

      {/* Summary / footer row: each column with a `summary` op aggregates over
          the full sorted dataset (the core `aggregate` material). */}
      <Show
        when={
          !merged.error &&
          !merged.loading &&
          bodyRows().length > 0 &&
          leafColumns().some((c) => c.summary)
        }
      >
        <div
          role="row"
          data-iris-table-row="summary"
          style={{
            display: 'grid',
            'grid-template-columns': gridTemplate(),
            'font-weight': '600',
            'border-top': '2px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          <Show when={merged.selectable !== 'none'}>
            <div
              role="cell"
              data-iris-table-cell="__selection"
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                padding: '8px',
                'border-bottom': '1px solid var(--iris-border)',
              }}
            />
          </Show>
          <For each={leafColumns()}>
            {(col, colIndexAccessor) => {
              const colIndex = colIndexAccessor()
              const op = col.summary
              const value = op ? aggregate(bodyRows(), (r) => getCellValue(r, col), op) : null
              // Column virtualization: skip summary cells outside the window
              // (+ pinned); place rendered cells on their grid track.
              const inWindow = (): boolean => {
                const set = visibleColSet()
                return !set || set.has(colIndex)
              }
              return (
                <Show when={inWindow()}>
                  <div
                    role="cell"
                    data-iris-table-cell={col.key}
                    data-iris-table-summary-cell={op ? '' : undefined}
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content':
                        col.align === 'right'
                          ? 'flex-end'
                          : col.align === 'center'
                            ? 'center'
                            : 'flex-start',
                      padding: '8px var(--iris-padding-md)',
                      'border-bottom': '1px solid var(--iris-border)',
                      'font-size': '14px',
                      'white-space': 'nowrap',
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      ...(visibleColSet()
                        ? { 'grid-column-start': String(colTrack(colIndex)) }
                        : {}),
                    }}
                  >
                    <Show when={op != null && value != null}>
                      <Show when={col.renderSummary} fallback={String(value)}>
                        {col.renderSummary!(value!, bodyRows())}
                      </Show>
                    </Show>
                  </div>
                </Show>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
