import * as React from 'react'
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
  type CellRangeController,
  type ExpansionModel,
  type GridNavKey,
  type SelectionModel,
  type TreeRow,
} from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type { IrisTableProps } from './props'
import { useTableSort } from './useTableSort'
import type { IrisTableColumn, IrisTableColumnWidths, IrisTableSortDirection } from './types'

export type { IrisTableProps } from './props'

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
  striped = false,
  bordered = true,
  resizableColumns = false,
  columnWidths: columnWidthsProp,
  defaultColumnWidths,
  onColumnWidthsChange,
  onRowClick,
  onCellEdit,
  renderDetail,
  rowExpandable,
  defaultExpandedRowKeys,
  onExpandedRowsChange,
  getSubRows,
  keyboardNavigation = false,
  cellRange = false,
  virtualScroll,
  columnVirtualization = false,
  emptyState,
  loading = false,
  error = false,
  loadingState,
  errorState,
  onRetry,
  style,
  className,
  ...rest
}: IrisTableProps<Row>): React.ReactElement {
  const { t } = useI18n()
  // Defensive: null/undefined columns → empty array
  const safeColumns = React.useMemo(() => columns ?? [], [columns])

  // Multi-level (grouped) headers: a column with `children` forms a header group. The BODY always renders the leaf columns; only the header gains extra rows.

  // When nothing is grouped, `leafColumns` is the original `safeColumns` (same
  // reference) so the flat path is byte-identical.
  const grouped = React.useMemo(
    () => safeColumns.some((c) => c.children && c.children.length > 0),
    [safeColumns],
  )
  const leafColumns = React.useMemo(
    () => (grouped ? flattenLeafColumns(safeColumns) : safeColumns),
    [grouped, safeColumns],
  )
  const headerMatrix = React.useMemo(
    () => (grouped ? buildHeaderMatrix(safeColumns) : null),
    [grouped, safeColumns],
  )

  // Sort state managed by useTableSort hook (controlled/uncontrolled, comparator, sorted data).
  const {
    sortState: sort,
    cycleSort,
    sortComparator,
    sortedData,
  } = useTableSort<Row>(data ?? [], {
    leafColumns,
    sort: sortProp,
    defaultSort,
    onSortChange,
  })

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
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  const rebaseToProp = (): void => {
    if (selControlled) selModel.sync(selectionProp as Array<string | number>)
  }

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
  // draft is mirrored into a ref so a commit reads the latest value even when
  // the change + Enter events are processed in the same React batch.
  const [editingCellId, setEditingCellId] = React.useState<string | null>(null)
  const [editingDraft, setEditingDraft] = React.useState('')
  const [editError, setEditError] = React.useState<string | null>(null)
  const draftRef = React.useRef('')
  const editorRef = React.useRef<HTMLInputElement | null>(null)
  const cellId = (rowIdent: string | number, colKey: string): string => `${rowIdent}::${colKey}`

  React.useEffect(() => {
    if (editingCellId !== null) editorRef.current?.focus()
  }, [editingCellId])

  const setDraft = (value: string) => {
    draftRef.current = value
    setEditingDraft(value)
  }
  const beginEdit = (row: Row, col: IrisTableColumn<Row>, rowIdent: string | number) => {
    if (!col.editable) return
    const current = getCellValue(row, col)
    setDraft(current == null ? '' : String(current))
    setEditError(null)
    setEditingCellId(cellId(rowIdent, col.key))
  }
  const cancelEdit = () => {
    setEditError(null)
    setEditingCellId(null)
  }
  const commitEdit = (row: Row, col: IrisTableColumn<Row>, rowIndex: number) => {
    if (editingCellId === null) return
    const oldValue = getCellValue(row, col)
    const draft = draftRef.current
    const newValue =
      col.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? oldValue
          : Number(draft)
        : draft
    // A column validator can reject the draft: keep the editor open, surface the
    // message, and skip the commit until the value is valid (or the user cancels).
    if (col.validate) {
      const error = col.validate(newValue, row)
      if (error) {
        setEditError(error)
        return
      }
    }
    setEditError(null)
    setEditingCellId(null)
    if (newValue !== oldValue) {
      onCellEdit?.({ row, column: col, oldValue, newValue, rowIndex })
    }
  }

  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, col: IrisTableColumn<Row>) => {
    if (!col.sortable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cycleSort(col)
    }
  }

  const rowKeyOf = (row: Row): string | number => {
    return (row as Record<string, unknown>)[rowKey] as string | number
  }

  // Single mode toggles off / replaces, multiple toggles inclusion — both are
  // the model's `toggle` semantics for the row's key.
  const toggleRow = (row: Row) => {
    if (selectable === 'none') return
    rebaseToProp()
    selModel.toggle(rowKeyOf(row))
  }

  // Tree mode (opt-in via getSubRows): flatten the data into the visible rows
  // honoring the (shared) expansion model. `bodyData` is the row list the body,
  // selection, and summary all operate on — identical to `sortedData` in flat
  // mode, so non-tree behavior is unchanged.
  const treeMode = getSubRows !== undefined
  const flatTree = React.useMemo<Array<TreeRow<Row>> | null>(
    () =>
      treeMode
        ? flattenTree<Row>(sortedData, {
            getKey: (r) => String(rowKeyOf(r)),
            // With an active sort, sort each level's children by the same
            // comparator so the whole tree reorders hierarchically.
            getChildren: sortComparator
              ? withSortedChildren((r) => getSubRows!(r), sortComparator)
              : (r) => getSubRows!(r),
            isExpanded: (k) => expandedKeys.includes(k),
          })
        : null,
    // Recompute on data / expansion / accessor / sort change (rowKeyOf reads `rowKey`).
    [treeMode, sortedData, getSubRows, expandedKeys, rowKey, sortComparator],
  )
  const bodyData = flatTree ? flatTree.map((t) => t.row) : sortedData

  const toggleAll = () => {
    if (selectable !== 'multi') return
    rebaseToProp()
    selModel.toggleAll(bodyData.map(rowKeyOf))
  }

  const allKeys = bodyData.map(rowKeyOf)
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

  const baseCellStyle: React.CSSProperties = {
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const borderStyle = bordered ? '1px solid var(--iris-border)' : 'none'

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
    const k = rowKeyOf(row)
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
        onClick={() => onRowClick?.(row, idx)}
        style={{ display: 'grid', gridTemplateColumns, ...extraStyle }}
      >
        {hasDetail ? (
          <div
            role="cell"
            data-iris-table-cell="__expand"
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              background: striped && idx % 2 === 1 ? 'var(--iris-surface)' : 'transparent',
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
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              background: striped && idx % 2 === 1 ? 'var(--iris-surface)' : 'transparent',
              borderBottom: borderStyle,
            }}
          >
            <IrisCheckbox
              checked={selected}
              onChange={() => toggleRow(row)}
              aria-label={t('table.selectRow', { key: String(k ?? idx) })}
            />
          </div>
        ) : null}
        {leafColumns.map((col, ci) => {
          if (visibleColSet && !visibleColSet.has(ci)) return null
          const raw = getCellValue(row, col)
          const editing = editingCellId === cellId(k, col.key)
          return (
            <div
              key={col.key}
              role="cell"
              data-iris-table-cell={col.key}
              data-iris-table-pinned={col.pinned}
              data-editable={col.editable ? '' : undefined}
              data-editing={editing ? '' : undefined}
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
              onDoubleClick={col.editable ? () => beginEdit(row, col, k) : undefined}
              style={{
                ...baseCellStyle,
                ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                justifyContent:
                  (col.align ?? (typeof getCellValue(row, col) === 'number' ? 'right' : 'left')) ===
                  'right'
                    ? 'flex-end'
                    : col.align === 'center'
                      ? 'center'
                      : 'flex-start',
                background:
                  cellRange && isInRange(idx, ci)
                    ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                    : striped && idx % 2 === 1
                      ? 'var(--iris-surface)'
                      : 'transparent',
                borderBottom: borderStyle,
                cursor: col.editable ? 'cell' : cellRange ? 'default' : undefined,
                ...(editing ? { padding: '4px 8px' } : null),
                ...pinnedStyle(col.key),
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
                  {treeMeta.hasChildren ? (
                    <button
                      type="button"
                      data-iris-table-tree-toggle=""
                      aria-expanded={treeMeta.expanded}
                      aria-label={t(
                        treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        expansion.toggle(treeMeta.key)
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
                <>
                  <input
                    ref={editorRef}
                    type={col.editor === 'number' ? 'number' : 'text'}
                    value={editingDraft}
                    data-iris-table-editor=""
                    aria-invalid={editError ? 'true' : undefined}
                    aria-describedby={editError ? `${cellId(k, col.key)}-error` : undefined}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitEdit(row, col, idx)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEdit()
                      }
                    }}
                    onBlur={() => commitEdit(row, col, idx)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      border: `1px solid ${editError ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
                      borderRadius: 'var(--iris-radius-sm, 4px)',
                      padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                      font: 'inherit',
                      background: 'var(--iris-background)',
                      color: 'var(--iris-foreground)',
                      outline: 'none',
                    }}
                  />
                  {editError ? (
                    <div
                      id={`${cellId(k, col.key)}-error`}
                      role="alert"
                      data-iris-table-editor-error=""
                      style={{
                        marginTop: 'var(--iris-space-xxs, 4px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: 'var(--iris-danger)',
                      }}
                    >
                      {editError}
                    </div>
                  ) : null}
                </>
              ) : col.render ? (
                col.render(raw, row, idx)
              ) : (
                (raw as React.ReactNode)
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
      // grid/table role as before (treegrid implies managed cell focus).
      role={keyboardNavigation ? (treeMode ? 'treegrid' : 'grid') : 'table'}
      data-iris-table=""
      data-bordered={bordered ? 'true' : undefined}
      data-striped={striped ? 'true' : undefined}
      data-column-virtualized={columnVirtualization ? 'true' : undefined}
      className={className}
      onKeyDown={
        keyboardNavigation || cellRange
          ? (e) => {
              if (keyboardNavigation) handleGridKey(e)
              if (cellRange) handleCellRangeKey(e)
            }
          : undefined
      }
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
        borderRadius: 'var(--iris-radius-md, 6px)',
        // Column virtualization turns the table into a horizontal scroll container.
        overflow: columnVirtualization ? 'auto' : 'hidden',
        ...style,
      }}
    >
      {/* Multi-level (grouped) header: a CSS grid of `headerMatrix.length` rows;
          each cell placed by its leaf-column span (colStart/colSpan) and row span. */}
      {grouped && headerMatrix ? (
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
              const isSortKey = sortable && sort?.key === col.key
              const dir: IrisTableSortDirection | undefined = isSortKey
                ? sort?.direction
                : undefined
              const lead = (hasDetail ? 1 : 0) + (selectable !== 'none' ? 1 : 0)
              return (
                <div
                  key={`${col.key}-${cell.level}`}
                  role="columnheader"
                  data-iris-table-header={col.key}
                  data-iris-table-header-group={isLeaf ? undefined : ''}
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
                  onClick={sortable ? () => cycleSort(col) : undefined}
                  onKeyDown={sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                  style={{
                    gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
                    gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
                    ...baseCellStyle,
                    justifyContent: isLeaf ? 'flex-start' : 'center',
                    background: 'var(--iris-surface)',
                    borderBottom: borderStyle,
                    borderInlineEnd: isLeaf ? 'none' : borderStyle,
                    cursor: sortable ? 'pointer' : 'default',
                    fontWeight: 600,
                    userSelect: sortable ? 'none' : 'auto',
                  }}
                >
                  <span>{col.title}</span>
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
                </div>
              )
            }),
          )}
        </div>
      ) : (
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
          {safeColumns.map((col, ci) => {
            if (visibleColSet && !visibleColSet.has(ci)) return null
            const isSortKey = sort?.key === col.key
            const dir: IrisTableSortDirection | undefined = isSortKey ? sort?.direction : undefined
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
                onClick={col.sortable ? () => cycleSort(col) : undefined}
                onKeyDown={col.sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                data-iris-table-header={col.key}
                data-iris-table-pinned={col.pinned}
                data-sortable={col.sortable ? 'true' : undefined}
                data-sort-direction={dir}
                style={{
                  ...baseCellStyle,
                  ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                  justifyContent:
                    col.align === 'right'
                      ? 'flex-end'
                      : col.align === 'center'
                        ? 'center'
                        : 'flex-start',
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                  cursor: col.sortable ? 'pointer' : 'default',
                  fontWeight: 600,
                  userSelect: col.sortable ? 'none' : 'auto',
                  position: 'relative',
                  // Pinned header keeps a solid surface bg + sticky position
                  // (overrides position: relative above for the sticky edge).
                  ...(pinnedStyle(col.key)
                    ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                    : null),
                }}
              >
                <span>{col.title}</span>
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
      )}

      {/* Body — state precedence: error → loading → empty → rows. */}
      {error ? (
        <div role="row" data-iris-table-row="error" style={STATE_ROW_STYLE}>
          <span style={{ marginInlineEnd: onRetry ? 'var(--iris-space-sm, 12px)' : 0 }}>
            {errorState ?? t('table.error')}
          </span>
          {onRetry ? (
            <button
              type="button"
              data-iris-table-retry=""
              onClick={onRetry}
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
      ) : loading ? (
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
          items={bodyData}
          itemHeight={virtualScroll.itemHeight}
          height={virtualScroll.height}
          buffer={virtualScroll.buffer}
          keyOf={(row) => rowKeyOf(row)}
          renderItem={(row, idx) => renderRow(row, idx, { height: '100%' }, flatTree?.[idx])}
        />
      ) : (
        bodyData.map((row, idx) => {
          const main = renderRow(row, idx, undefined, flatTree?.[idx])
          if (
            !hasDetail ||
            !isRowExpandable(row, idx) ||
            !expandedKeys.includes(String(rowKeyOf(row)))
          )
            return main
          // Full-width detail panel beneath the row (spans all grid tracks).
          return (
            <React.Fragment key={`${String(rowKeyOf(row) ?? idx)}::wrap`}>
              {main}
              <div
                role="row"
                data-iris-table-row-detail={String(rowKeyOf(row) ?? idx)}
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
        })
      )}

      {/* Summary / footer row: each column with a `summary` op aggregates over
          the full sorted dataset (the core `aggregate` material). */}
      {!error && !loading && bodyData.length > 0 && leafColumns.some((c) => c.summary) ? (
        <div
          role="row"
          data-iris-table-row="summary"
          style={{
            display: 'grid',
            gridTemplateColumns,
            fontWeight: 600,
            borderTop: '2px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          {selectable !== 'none' ? (
            <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
          ) : null}
          {leafColumns.map((col, ci) => {
            if (visibleColSet && !visibleColSet.has(ci)) return null
            const op = col.summary
            const value = op ? aggregate(bodyData, (r) => getCellValue(r, col), op) : null
            return (
              <div
                key={col.key}
                role="cell"
                data-iris-table-cell={col.key}
                data-iris-table-summary-cell={op ? '' : undefined}
                style={{ ...baseCellStyle, ...pinnedStyle(col.key) }}
              >
                {op != null && value != null
                  ? col.renderSummary
                    ? col.renderSummary(value, bodyData)
                    : String(value)
                  : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
