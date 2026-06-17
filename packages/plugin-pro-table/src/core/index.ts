import {
  createStore,
  createPlugin,
  createCellEdit,
  createDataSource,
  createSyncClientDataSource,
  createExpansion,
  filterSort,
  cycleSort,
  dataIndexOf,
  readCell,
  flattenLeafColumns,
  buildHeaderMatrix,
  flattenTree,
  summarize,
  paginate,
  toCsv,
  toSpreadsheetXml,
  toJson,
  toHtml,
  type Store,
  type DataViewColumn,
  type TableHtmlOptions,
  type HeaderCell,
  type AggregateSpec,
  type ExpansionModel,
  type TreeRow,
  computeVirtualRange,
  buildOffsets,
  type VirtualWindow,
} from '@iris-ui/core'

/**
 * `@iris-ui/plugin-pro-table` — a vxe-table-style CRUD data table for Iris UI.
 * This `core` entry is framework-agnostic: {@link createProTableStore} owns all
 * the table logic behind a subscribable {@link Store}. Per the re-layering, it
 * is now a **composition** of @iris-ui/core controllers rather than a monolith:
 * selection → `createSelectionModel`, the filter→sort→paginate pipeline →
 * `filterSort`/`paginate`/`cycleSort`, server loading → `createAsyncResource`
 * (token-guarded, no stale-response clobbering), CSV → `toCsv`. The four
 * framework entries are render-only adapters that read this store.
 */

export type { SortDirection, SortState, TreeRow } from '@iris-ui/core'
import type { SortState } from '@iris-ui/core'

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

export function createProTableStore<Row extends Record<string, unknown>>(
  config: ProTableConfig<Row>,
): ProTableStore<Row> {
  const mode: ProTableMode = config.mode ?? 'client'
  const allRows: Row[] = [...(config.data ?? [])]

  // Tree mode: expansion model + root data
  const treeRoots: Row[] | null = config.tree ? [...(config.data ?? [])] : null
  let expansion: ExpansionModel<string> | null = null
  if (config.tree && treeRoots) {
    expansion = createExpansion<string>({
      mode: 'multiple',
      defaultExpanded: config.tree.defaultExpandedKeys,
    })
  }

  // Collect ALL tree nodes into a flat array for inline editing (tree mode).
  // In flat mode, `allRows` is already the full dataset.
  function collectAllRows(): Row[] {
    if (!config.tree || !treeRoots) return allRows
    const out: Row[] = []
    const walk = (nodes: Row[]) => {
      for (const n of nodes) {
        out.push(n)
        const kids = config.tree!.getChildren(n)
        if (kids?.length) walk(kids)
      }
    }
    walk(treeRoots)
    return out
  }
  const allRowsForEdit = config.tree ? collectAllRows() : allRows

  const rowKeyOf = (row: Row): string =>
    typeof config.rowKey === 'function' ? config.rowKey(row) : String(row[config.rowKey])

  const cellValue = (row: Row, column: ProTableColumn<Row>): unknown => readCell(row, column)

  /** Map our columns onto the core data-view column contract. */
  const dataViewColumns = (): DataViewColumn<Row>[] =>
    config.columns.map((c) => ({
      key: c.key,
      getValue: (row: Row) => readCell(row, c),
      filterable: c.filterable,
      sorter: c.sorter,
    }))

  const store = createStore<ProTableState<Row>>({
    rows: [],
    columns: config.columns,
    columnOrder: config.columns.map((c) => c.key),
    columnSizes: Object.fromEntries(
      config.columns
        .filter((c) => typeof c.width === 'number')
        .map((c) => [c.key, c.width as number]),
    ),
    sort: null,
    filters: {},
    selectedKeys: [],
    summaryValues: {},
    editing: null,
    expandedKeys: [],
    treeRows: null,
    horizontalScroll: 0,
    columnViewportWidth: 0,
    page: 1,
    pageSize: config.pageSize ?? 10,
    total: 0,
    loading: false,
  })

  // The unified data engine drives query + sort + filter + pagination + loading
  // + selection. Client mode uses a SYNCHRONOUS fetcher (createSyncClientDataSource
  // over `allRows`) so rows are ready right after construction — the ProTable's
  // long-standing sync-client contract; server mode adapts `onLoad` to the async
  // fetcher (token-guarded against stale/out-of-order pages). The ProTable no
  // longer re-implements any of this — it consumes the same engine the base
  // Table and the resource controller compose.
  // In tree mode, the fetcher first flattens the tree via `flattenTree`, then
  // applies filter/sort/pagination on the flattened flat list. Expansion changes
  // trigger a reload via `expansion.subscribe`.
  function buildSyncFetcher() {
    if (!config.tree || !expansion || !treeRoots) {
      return createSyncClientDataSource(allRows, dataViewColumns())
    }
    // Tree-aware fetcher: flatten → filter/sort → paginate
    return ({
      page,
      pageSize,
      sort,
      filters,
    }: {
      page: number
      pageSize: number
      sort: { key: string; direction: 'asc' | 'desc' } | null
      filters: Record<string, string>
    }): { rows: Row[]; total: number } => {
      const flat = flattenTree(treeRoots, {
        getKey: rowKeyOf,
        getChildren: config.tree!.getChildren,
        isExpanded: (k) => expansion!.isExpanded(k),
      })
      const processed = filterSort(
        flat.map((t) => t.row),
        dataViewColumns(),
        { filters, sort },
      )
      return { rows: paginate(processed, page, pageSize), total: processed.length }
    }
  }

  const dataSource = createDataSource<Row>({
    fetcher:
      mode === 'server' && config.onLoad
        ? (q) =>
            config.onLoad!({ page: q.page, pageSize: q.pageSize, sort: q.sort, filters: q.filters })
        : buildSyncFetcher(),
    pageSize: config.pageSize ?? 10,
    immediate: false,
  })

  // When tree expansion changes, re-flatten and reload the data source.
  if (expansion) {
    expansion.store.subscribe(() => {
      void dataSource.reload()
    })
  }

  // Mirror the engine's state into ProTableState so subscribers (renderers)
  // re-render on any query / selection / loading change.
  dataSource.subscribe((s) => {
    // In tree mode, compute treeRows from the current expansion + root data.
    let treeRows: TreeRow<Row>[] | null = null
    if (config.tree && expansion && treeRoots) {
      treeRows = flattenTree(treeRoots, {
        getKey: rowKeyOf,
        getChildren: config.tree.getChildren,
        isExpanded: (k) => expansion!.isExpanded(k),
      })
    }
    store.setState((st) => ({
      ...st,
      rows: s.rows,
      sort: s.sort,
      filters: s.filters,
      page: s.page,
      pageSize: s.pageSize,
      total: s.total,
      loading: s.loading,
      selectedKeys: s.selectedKeys,
      expandedKeys: expansion ? expansion.get() : [],
      treeRows,
      summaryValues: config.summary ? summarize(s.rows, dataViewColumns(), config.summary) : {},
    }))
  })

  // Inline editing: a composed core controller. `onCommit` resolves the column +
  // row, coerces (number editor), writes back into `allRows`, and fires
  // `onCellEdit`; it runs before the editor closes. Mirror its editing state
  // into our store so renderers re-render on start/commit/cancel.
  const cellEdit = createCellEdit({
    onCommit: ({ rowKey, columnKey }, value) => {
      const column = config.columns.find((c) => c.key === columnKey)
      if (!column) return
      const dataIndex = dataIndexOf(column)
      const idx = allRowsForEdit.findIndex((r) => rowKeyOf(r) === rowKey)
      const oldValue = idx >= 0 ? allRowsForEdit[idx][dataIndex] : undefined
      const newValue = column.editor === 'number' ? Number(value) : value
      let updatedRow = {} as Row
      if (idx >= 0) {
        updatedRow = { ...allRowsForEdit[idx], [dataIndex]: newValue }
        allRowsForEdit[idx] = updatedRow
      }
      config.onCellEdit?.({ rowKey, columnKey, dataIndex, oldValue, newValue, row: updatedRow })
    },
  })
  cellEdit.store.subscribe((s) => {
    store.setState((st) => ({ ...st, editing: s.editing }))
  })

  const visibleColumns = (): ProTableColumn<Row>[] => {
    const { columns: cols, columnOrder } = store.getState()
    // Multi-level support: flatten the column tree to leaves.
    const leaves = flattenLeafColumns(cols)
    const byKey = new Map(leaves.map((c) => [c.key, c]))
    return columnOrder.flatMap((k) => {
      const col = byKey.get(k)
      return col && !col.hidden ? [col] : []
    })
  }

  // Cache header matrix; invalidate on any store change (cheap recompute).
  let headerMatrixCache: HeaderCell<ProTableColumn<Row>>[][] | null = null
  const headerMatrix = (): HeaderCell<ProTableColumn<Row>>[][] => {
    const { columns: cols } = store.getState()
    if (!headerMatrixCache) headerMatrixCache = buildHeaderMatrix(cols)
    return headerMatrixCache
  }
  store.subscribe(() => {
    headerMatrixCache = null
  })

  /** Filtered + sorted rows across ALL pages (client mode; for export too). */
  function processedAll(): Row[] {
    const { sort, filters } = store.getState()
    return filterSort(allRows, dataViewColumns(), { filters, sort })
  }

  /** Visible columns + processed rows — the shared input for every export format. */
  function exportData(): {
    rows: Record<string, unknown>[]
    cols: { key: string; title: string; dataIndex: string }[]
  } {
    const cols = visibleColumns().map((c) => ({
      key: c.key,
      title: c.title,
      dataIndex: dataIndexOf(c),
    }))
    const rows = (mode === 'client' ? processedAll() : store.getState().rows) as Record<
      string,
      unknown
    >[]
    return { rows, cols }
  }

  // Initial load — client mode applies synchronously (rows ready now), server
  // mode kicks the first fetch.
  void dataSource.load()

  const api: ProTableStore<Row> = {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    rowKeyOf,
    visibleColumns,
    headerMatrix,
    cellValue,

    toggleSort: (key) => dataSource.setSort(cycleSort(dataSource.getState().sort, key)),

    setFilter: (key, value) => dataSource.setFilter(key, value),

    clearFilters: () => dataSource.clearFilters(),

    isSelected: (key) => dataSource.selection.isSelected(key),
    toggleRow: (key) => dataSource.selection.toggle(key),
    toggleAll: () => dataSource.selection.toggleAll(store.getState().rows.map(rowKeyOf)),
    isAllSelected: () => dataSource.selection.isAllSelected(store.getState().rows.map(rowKeyOf)),
    clearSelection: () => dataSource.selection.clear(),

    startEdit: (rowKey, columnKey) => cellEdit.startEdit(rowKey, columnKey),

    cancelEdit: () => cellEdit.cancelEdit(),

    commitEdit(value) {
      if (!cellEdit.getEditing()) return
      cellEdit.commitEdit(value) // → onCommit (write-back + onCellEdit), then clears editing
      if (mode === 'client') void dataSource.reload()
    },

    setPage: (page) => dataSource.setPage(page),

    setPageSize: (size) => dataSource.setPageSize(size),

    pageCount: () => dataSource.pageCount(),

    reload: () => {
      void dataSource.reload()
    },

    exportCsv: () => {
      const { rows, cols } = exportData()
      return toCsv(rows, cols)
    },

    exportExcelXml: (sheetName) => {
      const { rows, cols } = exportData()
      return toSpreadsheetXml(rows, cols, { sheetName })
    },

    exportJson: () => {
      const { rows, cols } = exportData()
      return toJson(rows, cols)
    },

    exportHtml: (options) => {
      const { rows, cols } = exportData()
      return toHtml(rows, cols, options)
    },

    reorderColumns(from, to) {
      if (from === to) return
      const { columnOrder } = store.getState()
      const fromIdx = columnOrder.indexOf(from)
      const toIdx = columnOrder.indexOf(to)
      if (fromIdx === -1 || toIdx === -1) return
      const next = [...columnOrder]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, from)
      store.setState((st) => ({ ...st, columnOrder: next }))
    },

    setColumnWidth(key, width) {
      const col = config.columns.find((c) => c.key === key)
      const min = col?.minWidth ?? 60
      store.setState((st) => ({
        ...st,
        columnSizes: { ...st.columnSizes, [key]: Math.max(min, width) },
      }))
    },
    toggleColumn(key) {
      store.setState((s) => ({
        ...s,
        columns: s.columns.map((c) => (c.key === key ? { ...c, hidden: !c.hidden } : c)),
      }))
    },
    resetColumns() {
      store.setState((s) => ({
        ...s,
        columnOrder: [...s.columns.map((c) => c.key)],
        columnSizes: {},
        columns: s.columns.map((c) => ({ ...c, hidden: undefined })),
      }))
    },

    toggleExpand(key) {
      expansion?.toggle(key)
    },
    expandAll() {
      if (expansion && treeRoots && config.tree) {
        const keys: string[] = []
        const walk = (nodes: Row[]) => {
          for (const n of nodes) {
            keys.push(rowKeyOf(n))
            const kids = config.tree!.getChildren(n)
            if (kids?.length) walk(kids)
          }
        }
        walk(treeRoots)
        expansion.expandAll(keys)
      }
    },
    collapseAll() {
      expansion?.collapseAll()
    },
    isExpanded(key) {
      return expansion?.isExpanded(key) ?? false
    },

    setHorizontalScroll(scrollLeft) {
      store.setState((st) => ({ ...st, horizontalScroll: Math.max(0, scrollLeft) }))
    },

    setColumnViewportWidth(width) {
      store.setState((st) => ({ ...st, columnViewportWidth: Math.max(0, width) }))
    },

    columnWindow() {
      const { columnViewportWidth, horizontalScroll, columns, columnSizes } = store.getState()
      if (columnViewportWidth <= 0 || columns.length === 0) return null
      // Resolve each column's width: explicit numeric width → columnSizes override → 150px fallback
      const offsets = buildOffsets(columns.length, (i) => {
        const c = columns[i]
        if (!c) return 150
        const size = columnSizes[c.key]
        if (typeof size === 'number') return size
        if (typeof c.width === 'number') return c.width
        return 150
      })
      const totalWidth = offsets[columns.length]
      const clampedLeft = Math.max(
        0,
        Math.min(horizontalScroll, Math.max(0, totalWidth - columnViewportWidth)),
      )
      return computeVirtualRange({
        itemCount: columns.length,
        scrollTop: clampedLeft,
        viewportSize: columnViewportWidth,
        itemSize: 150, // unused when offsets is provided
        offsets,
      })
    },
  }

  return api
}

/**
 * Host-overridable UI strings for the ProTable renderers. Plugins are
 * framework-agnostic at the core and don't depend on the adapter packages, so
 * they can't reach the adapter `useI18n()` — instead the host localizes by
 * passing `labels` (e.g. `labels={{ selectAll: t('table.selectAll') }}`).
 * `filterColumn` interpolates `{title}`, `selectRow` interpolates `{key}`.
 */
export interface ProTableLabels {
  selectAll?: string
  filterColumn?: string
  selectRow?: string
  prev?: string
  next?: string
  summaryLabel?: string
}

export const defaultProTableLabels: Required<ProTableLabels> = {
  selectAll: 'Select all',
  filterColumn: 'Filter {title}',
  selectRow: 'Select row {key}',
  prev: 'Prev',
  next: 'Next',
  summaryLabel: 'Summary',
}

/**
 * Resolve a ProTable label: the host override (if any) else the English default,
 * with `{name}` placeholders filled from `vars`. Shared by all four renderers so
 * the contract + interpolation live once.
 */
export function proTableLabel(
  labels: ProTableLabels | undefined,
  key: keyof ProTableLabels,
  vars?: Record<string, string>,
): string {
  let text = labels?.[key] ?? defaultProTableLabels[key]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, value)
    }
  }
  return text
}

/**
 * Apply column windowing: filter columns to the visible range and return the
 * left offset. When `colWindow` is null, returns all columns unchanged.
 */
export function applyColumnWindow<T>(
  columns: T[],
  colWindow: VirtualWindow | null,
): { visible: T[]; offsetBefore: number } {
  if (!colWindow) return { visible: columns, offsetBefore: 0 }
  return {
    visible: columns.slice(colWindow.startIndex, colWindow.endIndex + 1),
    offsetBefore: colWindow.offsetBefore,
  }
}

/** CSS custom properties the ProTable reads; overridable by the host theme. */
export const proTableTokens: Record<string, string> = {
  '--iris-pro-table-border': 'var(--iris-color-border, #e5e7eb)',
  '--iris-pro-table-header-bg': 'var(--iris-color-bg-subtle, #f9fafb)',
  '--iris-pro-table-row-hover': 'var(--iris-color-bg-subtle, #f3f4f6)',
  '--iris-pro-table-selected-bg': 'var(--iris-color-primary-soft, #eff6ff)',
}

/**
 * Collect bounding rects for all elements matching `[attr]` under `root`.
 * Used by drag-to-reorder column headers across all framework adapters.
 */
export function collectRects(
  root: HTMLElement | null,
  attr: string,
): { id: string; left: number; top: number; width: number; height: number }[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).map((el) => {
    const r = el.getBoundingClientRect()
    return {
      id: el.getAttribute(attr)!,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    }
  })
}

/** Compute sticky positioning for a pinned column (framework-agnostic). */
export function pinnedStyle(column: {
  pinned?: 'left' | 'right'
}): Record<string, string | number> | undefined {
  if (!column.pinned) return undefined
  return { position: 'sticky', [column.pinned]: 0, zIndex: 1 }
}

/**
 * The ProTable plugin. Pass to `<IrisProvider plugins={[proTablePlugin]}>`.
 * Registers the table theme tokens. (Table state is per-instance via
 * {@link createProTableStore}, so no shared store is registered.)
 */
export const proTablePlugin = createPlugin({
  name: 'pro-table',
  install(registry) {
    registry.registerTokens(proTableTokens)
  },
})
