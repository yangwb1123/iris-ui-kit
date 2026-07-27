import type {
  AggregateSpec,
  HeaderCell,
  SortState,
  Store,
  TableHtmlOptions,
  TreeRow,
  VirtualWindow,
} from '@iris-ui-kit/core'

export type CellEditor = 'text' | 'number'

export interface ProTableColumn<Row = Record<string, unknown>> {
  /** Stable unique column id. */
  key: string
  /** Header label. */
  title: string
  /** Nested columns for multi-level (grouped) headers. Leaf columns drive body. */
  children?: ProTableColumn<Row>[]
  /** Field read from each row; defaults to `key`. */
  dataIndex?: string
  /** Allow sorting by this column. */
  sortable?: boolean
  /** Show a text filter for this column (client mode: substring match). */
  filterable?: boolean
  /** Column width (px or CSS length). */
  width?: number | string
  /** Allow interactive resize of this column. Default `true` when `width` is set. */
  resizable?: boolean
  /** Minimum width in px when resizable. Default `60`. */
  minWidth?: number
  /** Cell + header alignment. */
  align?: 'left' | 'center' | 'right'
  /** Freeze to an edge during horizontal scroll (`position: sticky`). */
  pinned?: 'left' | 'right'
  /** Allow inline editing of this cell. */
  editable?: boolean
  /** Inline editor kind. Default `'text'`. */
  editor?: CellEditor
  /** Hidden columns are kept in config but not rendered/exported. */
  hidden?: boolean
  /** Custom sort comparator; defaults to comparing the raw cell values. */
  sorter?: (a: Row, b: Row) => number
}

export interface ProTableQuery {
  page: number
  pageSize: number
  sort: SortState | null
  filters: Record<string, string>
}

export interface CellEditEvent<Row = Record<string, unknown>> {
  rowKey: string
  columnKey: string
  dataIndex: string
  oldValue: unknown
  newValue: unknown
  row: Row
}

export type ProTableMode = 'client' | 'server'
export type ProTableMutationKind = 'create' | 'delete' | 'bulk-delete' | 'custom'

type MaybePromise<T> = T | Promise<T>

/**
 * Optional resource side effects. Client tables can mutate their in-memory data
 * without handlers; server tables require the matching handler.
 */
export interface ProTableMutations<Row = Record<string, unknown>> {
  create?: (row: Row) => MaybePromise<Row | void>
  delete?: (rowKey: string, row: Row) => MaybePromise<void>
  bulkDelete?: (rowKeys: string[], loadedRows: Row[]) => MaybePromise<void>
}

export interface ProTableMutationState {
  kind: ProTableMutationKind | null
  pending: boolean
  rowKeys: string[]
  error: unknown
}

export interface ProTableMutateOptions<Row = Record<string, unknown>> {
  /** Mutation kind exposed through `state.mutation`. Default `'custom'`. */
  kind?: ProTableMutationKind
  /** Row keys affected by the operation, exposed while it is pending. */
  rowKeys?: string[]
  /** Optional optimistic projection of the currently loaded rows. */
  optimistic?: (rows: Row[]) => Row[]
  /** Skip the data-source reload after a successful action. */
  skipReload?: boolean
}

export interface ProTableTreeConfig<Row = Record<string, unknown>> {
  /** Accessor returning child rows for each row. */
  getChildren: (row: Row) => Row[] | undefined
  /** Keys expanded by default. */
  defaultExpandedKeys?: string[]
}

export interface ProTableConfig<Row = Record<string, unknown>> {
  columns: ProTableColumn<Row>[]
  /** Field name or function producing each row's stable key. */
  rowKey: string | ((row: Row) => string)
  /** Client-mode dataset (held in full; processed in the store). */
  data?: Row[]
  /** Per-column aggregation specs for the summary footer row. */
  summary?: AggregateSpec[]
  /** Tree/hierarchical mode: rows with children render expand/collapse toggles. */
  tree?: ProTableTreeConfig<Row>
  /** Rows per page. Default 10. */
  pageSize?: number
  /** `'client'` (default) processes `data` locally; `'server'` calls {@link ProTableConfig.onLoad}. */
  mode?: ProTableMode
  /** Server-mode fetcher. Required when `mode: 'server'`. */
  onLoad?: (query: ProTableQuery) => Promise<{ rows: Row[]; total: number }>
  /** Notified after a successful inline edit commit. */
  onCellEdit?: (event: CellEditEvent<Row>) => void
  /**
   * Optional create/delete resource handlers. They are dormant unless the
   * corresponding store mutation is called, preserving the basic table path.
   */
  mutations?: ProTableMutations<Row>
}

export interface ProTableState<Row = Record<string, unknown>> {
  /** Rows for the current page, already filtered + sorted (or server result). */
  rows: Row[]
  columns: ProTableColumn<Row>[]
  /** Ordered column keys; reflects drag-reorder. Initialized from schema order. */
  columnOrder: string[]
  /** Current column widths in px (from `width` prop or resize interaction). */
  columnSizes: Record<string, number>
  sort: SortState | null
  filters: Record<string, string>
  selectedKeys: string[]
  /** Aggregated values for the summary footer row (computed from processed rows). */
  summaryValues: Record<string, number>
  editing: { rowKey: string; columnKey: string } | null
  /** Tree expansion state — keys of expanded nodes. Empty when not tree mode. */
  expandedKeys: string[]
  /** Flattened tree rows with depth/expand metadata, or null when not tree mode. */
  treeRows: TreeRow<Row>[] | null
  /** Horizontal scroll offset for column virtualization. */
  horizontalScroll: number
  /** Viewport width in px for column virtualization. 0 = not virtualized. */
  columnViewportWidth: number
  page: number
  pageSize: number
  total: number
  loading: boolean
  /** Current resource mutation lifecycle, including recoverable failure state. */
  mutation: ProTableMutationState
}

export interface ProTableStore<Row = Record<string, unknown>> {
  store: Store<ProTableState<Row>>
  getState(): ProTableState<Row>
  subscribe(listener: (state: ProTableState<Row>) => void): () => void
  rowKeyOf(row: Row): string
  visibleColumns(): ProTableColumn<Row>[]
  /** Header matrix: one row per nesting level, each cell with col/row spans. */
  headerMatrix(): HeaderCell<ProTableColumn<Row>>[][]
  cellValue(row: Row, column: ProTableColumn<Row>): unknown
  toggleSort(key: string): void
  setFilter(key: string, value: string): void
  clearFilters(): void
  isSelected(key: string): boolean
  toggleRow(key: string): void
  toggleAll(): void
  isAllSelected(): boolean
  clearSelection(): void
  /** Run an arbitrary resource mutation through the shared data-source engine. */
  mutate(action: () => Promise<unknown>, options?: ProTableMutateOptions<Row>): Promise<void>
  /** Create one row, then reconcile the current query. */
  createRow(row: Row): Promise<Row>
  /** Delete one row by key. Returns false when the key does not exist. */
  deleteRow(key: string): Promise<boolean>
  /**
   * Delete the supplied keys, or the current selection when omitted. Returns
   * the number of rows deleted.
   */
  bulkDelete(keys?: readonly string[]): Promise<number>
  startEdit(rowKey: string, columnKey: string): void
  cancelEdit(): void
  commitEdit(value: unknown): void
  setPage(page: number): void
  setPageSize(size: number): void
  pageCount(): number
  reload(): void
  exportCsv(): string
  exportExcelXml(sheetName?: string): string
  /** Export the visible columns + processed rows as a JSON array of objects. */
  exportJson(): string
  /** Export the visible columns + processed rows as an HTML `<table>` (print/email). */
  exportHtml(options?: TableHtmlOptions): string
  /**
   * Move the column identified by `from` key to the position currently occupied
   * by the column identified by `to` key. No-op if either key is absent or they
   * are the same. Triggers a store update so all renderers re-render.
   */
  reorderColumns(from: string, to: string): void
  /** Set a column's width in px (clamped to minWidth). Triggers re-render. */
  setColumnWidth(key: string, width: number): void
  /** Toggle a column's visibility. When hidden it is excluded from visibleColumns(). */
  toggleColumn(key: string): void
  /** Reset column state (order, width, hidden) to initial config values. */
  resetColumns(): void
  /** Toggle expansion of a tree node. No-op when not tree mode. */
  toggleExpand(key: string): void
  /** Expand all tree nodes. */
  expandAll(): void
  /** Collapse all tree nodes. */
  collapseAll(): void
  /** Check if a tree node is expanded. */
  isExpanded(key: string): boolean
  /** Set horizontal scroll offset (px) for column virtualization. */
  setHorizontalScroll(scrollLeft: number): void
  /** Set the horizontal viewport width (px). 0 disables column virtualization. */
  setColumnViewportWidth(width: number): void
  /**
   * Compute which columns are within the visible horizontal viewport.
   * Returns null when columnVirtualized is disabled (viewportWidth <= 0).
   */
  columnWindow(): VirtualWindow | null
}

/** Host-overridable strings shared by all four ProTable renderers. */
export interface ProTableLabels {
  selectAll?: string
  filterColumn?: string
  selectRow?: string
  prev?: string
  next?: string
  summaryLabel?: string
}

/** Framework-neutral renderer options; adapter props add `store` and class naming. */
export interface ProTableViewOptions {
  labels?: ProTableLabels
  /** Enable drag-to-reorder column headers. */
  columnReorder?: boolean
  /** Render only the visible row window. */
  virtualized?: boolean
  /** Estimated row height in px. Default `40`. */
  rowHeight?: number
  /** Scroll viewport height in px. Default `400`. */
  maxHeight?: number
  /** Render only the visible horizontal column window. */
  columnVirtualized?: boolean
}
