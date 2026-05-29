import * as React from 'react'
import { computeVirtualRange } from '@iris-ui/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortDirection,
  IrisTableSortState,
  IrisTableVirtualOptions,
} from './types'

const RESIZE_STEP = 16
const SELECTION_COL_WIDTH = 40
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

function defaultSorter(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export interface IrisTableProps<Row extends Record<string, unknown> = Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  data: Row[]
  /** Field to use as the row key. */
  rowKey?: string
  /** Selection mode. */
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  defaultSelection?: Array<string | number>
  onSelectionChange?: (next: Array<string | number>) => void
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  onSortChange?: (next: IrisTableSortState | null) => void
  striped?: boolean
  bordered?: boolean
  /** Enable column resizing (drag the header's trailing edge or focus + arrow keys). */
  resizableColumns?: boolean
  /** Controlled per-column pixel widths, keyed by column `key`. */
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  /** Called when an inline-editable cell is committed with a changed value. */
  onCellEdit?: (event: IrisTableCellEditEvent<Row>) => void
  /** Enable virtual scrolling for the body (renders only the visible window). */
  virtualScroll?: IrisTableVirtualOptions
  /**
   * Render only the horizontally-visible columns (plus pinned + a small
   * overscan) for very wide tables. Needs numeric column widths; the table
   * becomes a horizontal scroll container. Off-screen grid tracks stay sized,
   * so alignment, resize, and pinned columns keep working.
   */
  columnVirtualization?: boolean
  /** Empty state node (replaces the row body when `data` is empty). */
  emptyState?: React.ReactNode
  /** Show the loading state instead of rows. */
  loading?: boolean
  /** Show the error state instead of rows (takes precedence over loading). */
  error?: boolean
  /** Custom loading-state node (defaults to the localized `table.loading`). */
  loadingState?: React.ReactNode
  /** Custom error-state node (defaults to the localized `table.error`). */
  errorState?: React.ReactNode
  style?: React.CSSProperties
  className?: string
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
  onCellEdit,
  virtualScroll,
  columnVirtualization = false,
  emptyState,
  loading = false,
  error = false,
  loadingState,
  errorState,
  style,
  className,
}: IrisTableProps<Row>): React.ReactElement {
  const { t } = useI18n()
  // Controlled / uncontrolled state.
  const sortControlled = sortProp !== undefined
  const [sortInternal, setSortInternal] = React.useState<IrisTableSortState | null>(
    defaultSort ?? null,
  )
  const sort = sortControlled ? (sortProp as IrisTableSortState | null) : sortInternal

  const selControlled = selectionProp !== undefined
  const [selInternal, setSelInternal] = React.useState<Array<string | number>>(
    defaultSelection ?? [],
  )
  const selection = selControlled ? (selectionProp as Array<string | number>) : selInternal

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
    setEditingCellId(cellId(rowIdent, col.key))
  }
  const cancelEdit = () => setEditingCellId(null)
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
    setEditingCellId(null)
    if (newValue !== oldValue) {
      onCellEdit?.({ row, column: col, oldValue, newValue, rowIndex })
    }
  }

  // Sorted data.
  const sortedData = React.useMemo(() => {
    if (!sort) return data
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return data
    const dir = sort.direction === 'asc' ? 1 : -1
    const sorter =
      col.sorter ?? ((a: Row, b: Row) => defaultSorter(getCellValue(a, col), getCellValue(b, col)))
    return [...data].sort((a, b) => sorter(a, b) * dir)
  }, [data, columns, sort])

  const setSort = (next: IrisTableSortState | null) => {
    if (!sortControlled) setSortInternal(next)
    onSortChange?.(next)
  }

  const setSelection = (next: Array<string | number>) => {
    if (!selControlled) setSelInternal(next)
    onSelectionChange?.(next)
  }

  const cycleSort = (col: IrisTableColumn<Row>) => {
    if (!col.sortable) return
    if (!sort || sort.key !== col.key) {
      setSort({ key: col.key, direction: 'asc' })
      return
    }
    if (sort.direction === 'asc') {
      setSort({ key: col.key, direction: 'desc' })
      return
    }
    setSort(null)
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

  const toggleRow = (row: Row) => {
    const k = rowKeyOf(row)
    if (selectable === 'single') {
      setSelection(selection.includes(k) ? [] : [k])
      return
    }
    if (selectable === 'multi') {
      setSelection(selection.includes(k) ? selection.filter((x) => x !== k) : [...selection, k])
    }
  }

  const toggleAll = () => {
    if (selectable !== 'multi') return
    const allKeys = sortedData.map(rowKeyOf)
    if (allKeys.every((k) => selection.includes(k))) setSelection([])
    else setSelection(allKeys)
  }

  const allSelected =
    selectable === 'multi' &&
    sortedData.length > 0 &&
    sortedData.every((r) => selection.includes(rowKeyOf(r)))
  const someSelected =
    selectable === 'multi' &&
    sortedData.some((r) => selection.includes(rowKeyOf(r))) &&
    !allSelected

  const gridTemplateColumns = React.useMemo(() => {
    const widths: string[] = []
    if (selectable !== 'none') widths.push('40px')
    for (const col of columns) {
      const override = columnWidths[col.key]
      if (override != null) widths.push(`${override}px`)
      else if (typeof col.width === 'number') widths.push(`${col.width}px`)
      else if (typeof col.width === 'string') widths.push(col.width)
      else widths.push('minmax(0, 1fr)')
    }
    return widths.join(' ')
  }, [columns, selectable, columnWidths])

  // Sticky offsets for pinned columns: each accumulates the resolved widths of
  // the pinned columns between it and its edge (plus the selection column on
  // the left). Requires a numeric width; falls back to a default.
  const pinnedOffsets = React.useMemo(() => {
    const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
    const widthOf = (col: IrisTableColumn<Row>): number =>
      columnWidths[col.key] ?? (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH)
    let left = selectable !== 'none' ? SELECTION_COL_WIDTH : 0
    for (const col of columns) {
      if (col.pinned === 'left') {
        map[col.key] = { side: 'left', offset: left }
        left += widthOf(col)
      }
    }
    let right = 0
    for (let i = columns.length - 1; i >= 0; i -= 1) {
      const col = columns[i]
      if (col?.pinned === 'right') {
        map[col.key] = { side: 'right', offset: right }
        right += widthOf(col)
      }
    }
    return map
  }, [columns, columnWidths, selectable])

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

  const resolvedColWidths = React.useMemo(
    () =>
      columns.map(
        (col) =>
          columnWidths[col.key] ??
          (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH),
      ),
    [columns, columnWidths],
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
      itemCount: columns.length,
      scrollTop: scrollLeft,
      viewportSize: viewportWidth,
      itemSize: (i) => resolvedColWidths[i] ?? DEFAULT_PINNED_WIDTH,
      buffer: 2,
    })
    const set = new Set<number>()
    for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
    columns.forEach((col, i) => {
      if (col.pinned) set.add(i)
    })
    return set
  }, [columnVirtualization, columns, scrollLeft, viewportWidth, resolvedColWidths])

  // 1-based grid track for a column (after the optional selection track), so a
  // rendered cell lands in the right place even when earlier cells are skipped.
  const colTrack = (i: number): number => (selectable !== 'none' ? 2 : 1) + i

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
  ): React.ReactElement => {
    const k = rowKeyOf(row)
    const selected = selection.includes(k)
    return (
      <div
        key={String(k ?? idx)}
        role="row"
        aria-selected={selectable !== 'none' ? selected : undefined}
        data-iris-table-row={String(k ?? idx)}
        data-iris-table-row-selected={selected ? 'true' : undefined}
        style={{ display: 'grid', gridTemplateColumns, ...extraStyle }}
      >
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
              aria-label={`Select row ${String(k ?? idx)}`}
            />
          </div>
        ) : null}
        {columns.map((col, ci) => {
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
              onDoubleClick={col.editable ? () => beginEdit(row, col, k) : undefined}
              style={{
                ...baseCellStyle,
                ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                justifyContent:
                  col.align === 'right'
                    ? 'flex-end'
                    : col.align === 'center'
                      ? 'center'
                      : 'flex-start',
                background: striped && idx % 2 === 1 ? 'var(--iris-surface)' : 'transparent',
                borderBottom: borderStyle,
                cursor: col.editable ? 'cell' : undefined,
                ...(editing ? { padding: '4px 8px' } : null),
                ...pinnedStyle(col.key),
              }}
            >
              {editing ? (
                <input
                  ref={editorRef}
                  type={col.editor === 'number' ? 'number' : 'text'}
                  value={editingDraft}
                  data-iris-table-editor=""
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
                    border: '1px solid var(--iris-primary)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    padding: '4px 6px',
                    font: 'inherit',
                    background: 'var(--iris-background)',
                    color: 'var(--iris-foreground)',
                    outline: 'none',
                  }}
                />
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
      role="table"
      data-iris-table=""
      data-bordered={bordered ? 'true' : undefined}
      data-striped={striped ? 'true' : undefined}
      data-column-virtualized={columnVirtualization ? 'true' : undefined}
      className={className}
      onScroll={
        columnVirtualization
          ? (e) => setScrollLeft((e.currentTarget as HTMLDivElement).scrollLeft)
          : undefined
      }
      style={{
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        fontSize: 14,
        border: borderStyle,
        borderRadius: 'var(--iris-radius-md, 6px)',
        // Column virtualization turns the table into a horizontal scroll container.
        overflow: columnVirtualization ? 'auto' : 'hidden',
        ...style,
      }}
    >
      {/* Header row */}
      <div role="row" data-iris-table-row="header" style={{ display: 'grid', gridTemplateColumns }}>
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
              aria-label="Select all"
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
        {columns.map((col, ci) => {
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
                    marginInlineStart: 6,
                    fontSize: 11,
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

      {/* Body — state precedence: error → loading → empty → rows. */}
      {error ? (
        <div role="row" data-iris-table-row="error" style={STATE_ROW_STYLE}>
          {errorState ?? t('table.error')}
        </div>
      ) : loading ? (
        <div role="row" aria-busy="true" data-iris-table-row="loading" style={STATE_ROW_STYLE}>
          {loadingState ?? t('table.loading')}
        </div>
      ) : sortedData.length === 0 ? (
        <div role="row" data-iris-table-row="empty" style={STATE_ROW_STYLE}>
          {emptyState ?? t('table.empty')}
        </div>
      ) : virtualScroll ? (
        <IrisVirtualScroll
          items={sortedData}
          itemHeight={virtualScroll.itemHeight}
          height={virtualScroll.height}
          buffer={virtualScroll.buffer}
          keyOf={(row) => rowKeyOf(row)}
          renderItem={(row, idx) => renderRow(row, idx, { height: '100%' })}
        />
      ) : (
        sortedData.map((row, idx) => renderRow(row, idx))
      )}
    </div>
  )
}
