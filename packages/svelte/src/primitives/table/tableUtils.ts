import {
  applyTableMask,
  compareValues,
  computeResponsiveColumns,
  computeVirtualRange,
  createCellRange,
  flattenLeafColumns,
  RESPONSIVE_NARROW_WIDTH,
} from '@iris-ui-kit/core'
import type {
  IrisTableColumn,
  IrisTableSortState,
  IrisTableColumnWidths,
  IrisTableVirtualOptions,
  IrisTableCellEditEvent,
  IrisTableFilterValues,
} from './types'

export interface IrisTableProps {
  columns: IrisTableColumn[]
  data: Array<Record<string, unknown>>
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  sort?: IrisTableSortState | null
  striped?: boolean
  bordered?: boolean
  autoDetectTypes?: boolean
  loading?: boolean
  error?: boolean
  virtualScroll?: IrisTableVirtualOptions
  columnVirtualization?: boolean
  resizableColumns?: boolean
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  renderDetail?: (row: Record<string, unknown>, rowIndex: number) => unknown
  rowExpandable?: (row: Record<string, unknown>, rowIndex: number) => boolean
  defaultExpandedRowKeys?: Array<string | number>
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  getSubRows?: (row: Record<string, unknown>) => Array<Record<string, unknown>> | undefined
  keyboardNavigation?: boolean
  cellRange?: boolean
  onUpdateSelection?: (value: Array<string | number>) => void
  onUpdateSort?: (value: IrisTableSortState | null) => void
  onRowClick?: (row: Record<string, unknown>, index: number) => void
  onCellEdit?: (event: IrisTableCellEditEvent) => void
  style?: string
  [key: string]: unknown
}

/**
 * Pure helper functions used by IrisTable.svelte.
 * These are framework-agnostic and do NOT use Svelte runes ($state/$derived).
 */
export const TABLE_CONST = {
  DEFAULT_COL_WIDTH: 140,
  DEFAULT_MIN_WIDTH: 60,
  RESIZE_STEP: 16,
} as const

export function computeResponsiveTableColumns(
  columns: IrisTableColumn[],
  containerWidth: number,
  leadingWidth: number,
  widthOf: (column: IrisTableColumn) => number,
): { columns: IrisTableColumn[]; overflow: boolean } {
  if (containerWidth <= 0 || containerWidth >= RESPONSIVE_NARROW_WIDTH) {
    return { columns, overflow: false }
  }
  const isPinned = (column: IrisTableColumn): boolean =>
    column.children && column.children.length > 0
      ? column.children.some(isPinned)
      : column.pinned !== undefined
  const fitted = computeResponsiveColumns(columns, Math.max(1, containerWidth - leadingWidth), {
    widthOf: (column) => widthOf(column as IrisTableColumn),
    isPinned: (column) => isPinned(column as IrisTableColumn),
    narrowWidth: RESPONSIVE_NARROW_WIDTH - leadingWidth,
  }) as IrisTableColumn[]
  const natural = fitted.reduce(
    (sum, column) =>
      sum +
      (column.children && column.children.length > 0
        ? flattenLeafColumns([column]).reduce((nested, leaf) => nested + widthOf(leaf), 0)
        : widthOf(column)),
    leadingWidth,
  )
  return { columns: fitted, overflow: natural > containerWidth }
}

export function resolveInitialWidth(col: IrisTableColumn): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return TABLE_CONST.DEFAULT_COL_WIDTH
}

export function resolveResponsiveWidth(
  column: IrisTableColumn,
  columnWidths: IrisTableColumnWidths | undefined,
  defaultColumnWidths: IrisTableColumnWidths | undefined,
): number {
  const configured = columnWidths?.[column.key] ?? defaultColumnWidths?.[column.key]
  if (typeof configured === 'number' && Number.isFinite(configured) && configured >= 0) {
    return configured
  }
  return resolveInitialWidth(column)
}

export function editPreviewText(
  row: Record<string, unknown>,
  column: IrisTableColumn,
  draft: string,
): string {
  const raw =
    column.editor === 'number'
      ? draft === '' || isNaN(Number(draft))
        ? getCellValue(row, column)
        : Number(draft)
      : draft
  return String(column.formatter?.(applyTableMask(raw, column), row) ?? '')
}

export function getCellValue(row: Record<string, unknown>, column: IrisTableColumn): unknown {
  const key = (column.dataIndex ?? column.key) as string
  return row[key]
}

/** Serialize checked filter sets for a remote query (vxe comma parity). */
export function mergeFilterValues(
  filters: Record<string, string>,
  filterValues: IrisTableFilterValues,
): Record<string, string> {
  const next = { ...filters }
  for (const [key, values] of Object.entries(filterValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

/** Apply text filters and checked OR sets to a sorted row list. */
export function applyTableFilters(
  rows: Array<Record<string, unknown>>,
  columns: IrisTableColumn[],
  textFilters: Record<string, string>,
  filterValues: IrisTableFilterValues,
): Array<Record<string, unknown>> {
  const active = Object.entries(textFilters).filter(([, value]) => value != null && value !== '')
  const checked = Object.entries(filterValues).filter(([, values]) => values.length > 0)
  if (active.length === 0 && checked.length === 0) return rows
  return rows.filter(
    (row) =>
      active.every(([key, value]) => {
        const col = columns.find((column) => column.key === key)
        if (!col) return true
        const raw = getCellValue(row, col)
        if (col.filterMethod) return col.filterMethod(raw, row, value)
        return String(raw ?? '')
          .toLowerCase()
          .includes(value.toLowerCase())
      }) &&
      checked.every(([key, values]) => {
        const col = columns.find((column) => column.key === key)
        if (!col) return true
        return values.includes(String(getCellValue(row, col) ?? ''))
      }),
  )
}

export function clampWidth(col: IrisTableColumn, w: number): number {
  const minW = col.minWidth ?? TABLE_CONST.DEFAULT_MIN_WIDTH
  const maxW = col.maxWidth ?? Infinity
  return Math.max(minW, Math.min(maxW, Math.round(w)))
}

export function summaryCellStyle(col: IrisTableColumn): string {
  const align =
    col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'
  return `display: flex; align-items: center; justify-content: ${align}; padding: 8px var(--iris-padding-md, 12px); font-size: var(--iris-font-size-md, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
}

export function buildGridTemplate(
  hasDetail: boolean,
  showSelection: boolean,
  leafColumns: IrisTableColumn[],
  effectiveWidths: IrisTableColumnWidths,
): string {
  const parts: string[] = []
  if (hasDetail) parts.push('40px')
  if (showSelection) parts.push('40px')
  for (const col of leafColumns) {
    parts.push(`${effectiveWidths[col.key] ?? resolveInitialWidth(col)}px`)
  }
  return parts.join(' ')
}

export function isSelectedInRange(
  cellRangeState: ReturnType<ReturnType<typeof createCellRange>['getState']>,
  row: number,
  col: number,
): boolean {
  const { anchor, active } = cellRangeState
  if (!anchor || !active) return false
  return (
    row >= Math.min(anchor.row, active.row) &&
    row <= Math.max(anchor.row, active.row) &&
    col >= Math.min(anchor.col, active.col) &&
    col <= Math.max(anchor.col, active.col)
  )
}

export function createSortComparator(
  effectiveSort: IrisTableSortState | null,
  leafColumns: IrisTableColumn[],
  getValue: (row: Record<string, unknown>, col: IrisTableColumn) => unknown,
): ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null {
  if (!effectiveSort) return null
  const column = leafColumns.find((c) => c.key === effectiveSort.key)
  if (!column) return null
  const dir = effectiveSort.direction === 'asc' ? 1 : -1
  const sorter =
    column.sorter ?? ((a, b) => compareValues(getValue(a, column), getValue(b, column)))
  return (a, b) => sorter(a, b) * dir
}

export interface SpanPlan {
  occupied: Set<string>
  spans: Map<string, { rowspan: number; colspan: number }>
}

/** Build the complete span occupancy map once per reactive render pass. */
export function buildSpanPlan(
  rowCount: number,
  colCount: number,
  method: (params: {
    rowIndex: number
    columnIndex: number
  }) => { rowspan?: number; colspan?: number } | null | undefined,
): SpanPlan {
  const occupied = new Set<string>()
  const spans = new Map<string, { rowspan: number; colspan: number }>()
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const key = `${r}:${c}`
      if (occupied.has(key)) continue
      const span = method({ rowIndex: r, columnIndex: c })
      const rowspan = span?.rowspan ?? 1
      const colspan = span?.colspan ?? 1
      if (rowspan > 1 || colspan > 1) {
        spans.set(key, { rowspan, colspan })
        for (let rr = 1; rr < rowspan; rr += 1) occupied.add(`${r + rr}:${c}`)
        for (let cc = 1; cc < colspan; cc += 1) occupied.add(`${r}:${c + cc}`)
      }
    }
  }
  return { occupied, spans }
}

/** Ordered multi-column comparator shared by all Svelte table consumers. */
export function createMultiSortComparator(
  list: IrisTableSortState[],
  leafCols: IrisTableColumn[],
  getValue: (row: Record<string, unknown>, col: IrisTableColumn) => unknown,
): ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null {
  if (list.length === 0) return null
  const colMap = new Map(leafCols.map((c) => [c.key, c]))
  const chain: Array<{
    dir: number
    sorter: (a: Record<string, unknown>, b: Record<string, unknown>) => number
  }> = []
  for (const s of list) {
    const col = colMap.get(s.key)
    if (!col) continue
    chain.push({
      dir: s.direction === 'asc' ? 1 : -1,
      sorter: col.sorter ?? ((a, b) => compareValues(getValue(a, col), getValue(b, col))),
    })
  }
  if (chain.length === 0) return null
  return (a, b) => {
    for (const step of chain) {
      const cmp = step.sorter(a, b)
      if (cmp !== 0) return cmp * step.dir
    }
    return 0
  }
}

export function computeVisibleColSet(
  columnVirtualization: boolean,
  leafColumns: IrisTableColumn[],
  scrollLeft: number,
  viewportWidth: number,
  effectiveWidths: IrisTableColumnWidths,
): Set<number> | null {
  if (!columnVirtualization) return null
  const w = computeVirtualRange({
    itemCount: leafColumns.length,
    scrollTop: scrollLeft,
    viewportSize: viewportWidth,
    itemSize: (i) => effectiveWidths[leafColumns[i].key] ?? resolveInitialWidth(leafColumns[i]),
    buffer: 2,
  })
  const set = new Set<number>()
  for (let i = w.startIndex; i <= w.endIndex; i++) set.add(i)
  leafColumns.forEach((col, i) => {
    if (col.pinned) set.add(i)
  })
  return set
}

export function cellId(rowIdent: string | number, colKey: string): string {
  return `${rowIdent}::${colKey}`
}
