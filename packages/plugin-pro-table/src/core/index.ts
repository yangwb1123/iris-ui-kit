import {
  createStore,
  createPlugin,
  createSelectionModel,
  createAsyncResource,
  createCellEdit,
  filterSort,
  paginate,
  cycleSort,
  dataIndexOf,
  readCell,
  pageCount as corePageCount,
  toCsv,
  toSpreadsheetXml,
  type Store,
  type AsyncResource,
  type DataViewColumn,
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

export type { SortDirection, SortState } from '@iris-ui/core'
import type { SortState } from '@iris-ui/core'

export type CellEditor = 'text' | 'number'

export interface ProTableColumn<Row = Record<string, unknown>> {
  /** Stable unique column id. */
  key: string
  /** Header label. */
  title: string
  /** Field read from each row; defaults to `key`. */
  dataIndex?: string
  /** Allow sorting by this column. */
  sortable?: boolean
  /** Show a text filter for this column (client mode: substring match). */
  filterable?: boolean
  /** Column width (px or CSS length). */
  width?: number | string
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

export interface ProTableConfig<Row = Record<string, unknown>> {
  columns: ProTableColumn<Row>[]
  /** Field name or function producing each row's stable key. */
  rowKey: string | ((row: Row) => string)
  /** Client-mode dataset (held in full; processed in the store). */
  data?: Row[]
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
  sort: SortState | null
  filters: Record<string, string>
  selectedKeys: string[]
  editing: { rowKey: string; columnKey: string } | null
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
}

export function createProTableStore<Row extends Record<string, unknown>>(
  config: ProTableConfig<Row>,
): ProTableStore<Row> {
  const mode: ProTableMode = config.mode ?? 'client'
  const allRows: Row[] = [...(config.data ?? [])]

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
    sort: null,
    filters: {},
    selectedKeys: [],
    editing: null,
    page: 1,
    pageSize: config.pageSize ?? 10,
    total: 0,
    loading: false,
  })

  // Selection: a composed core controller; mirror its keys into our state so
  // subscribers (renderers) re-render on selection change.
  const selection = createSelectionModel({ mode: 'multiple' })
  selection.store.subscribe((keys) => {
    store.setState((s) => ({ ...s, selectedKeys: keys }))
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
      const idx = allRows.findIndex((r) => rowKeyOf(r) === rowKey)
      const oldValue = idx >= 0 ? allRows[idx][dataIndex] : undefined
      const newValue = column.editor === 'number' ? Number(value) : value
      let updatedRow = {} as Row
      if (idx >= 0) {
        updatedRow = { ...allRows[idx], [dataIndex]: newValue }
        allRows[idx] = updatedRow
      }
      config.onCellEdit?.({ rowKey, columnKey, dataIndex, oldValue, newValue, row: updatedRow })
    },
  })
  cellEdit.store.subscribe((s) => {
    store.setState((st) => ({ ...st, editing: s.editing }))
  })

  // Server mode: a composed async resource — token-guarded, so an out-of-order
  // onLoad resolution can no longer clobber a newer page (the prior hand-rolled
  // loader had no such guard).
  let resource: AsyncResource<{ rows: Row[]; total: number }, [ProTableQuery]> | null = null
  if (mode === 'server' && config.onLoad) {
    const onLoad = config.onLoad
    resource = createAsyncResource((query: ProTableQuery) => onLoad(query))
    resource.subscribe((s) => {
      store.setState((st) => ({
        ...st,
        loading: s.status === 'loading',
        rows: s.data?.rows ?? (s.status === 'loading' ? st.rows : []),
        total: s.data?.total ?? (s.status === 'loading' ? st.total : 0),
      }))
    })
  }

  const visibleColumns = (): ProTableColumn<Row>[] =>
    store.getState().columns.filter((c) => !c.hidden)

  /** Filtered + sorted rows across ALL pages (client mode; for export too). */
  function processedAll(): Row[] {
    const { sort, filters } = store.getState()
    return filterSort(allRows, dataViewColumns(), { filters, sort })
  }

  function processClient(): void {
    const { page, pageSize } = store.getState()
    const all = processedAll()
    store.setState((s) => ({ ...s, rows: paginate(all, page, pageSize), total: all.length }))
  }

  function processServer(): void {
    if (!resource) return
    const { sort, filters, page, pageSize } = store.getState()
    resource.load({ page, pageSize, sort, filters })
  }

  const refresh = (): void => (mode === 'server' ? processServer() : processClient())

  // initial load
  refresh()

  const api: ProTableStore<Row> = {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    rowKeyOf,
    visibleColumns,
    cellValue,

    toggleSort(key) {
      store.setState((s) => ({ ...s, sort: cycleSort(s.sort, key), page: 1 }))
      refresh()
    },

    setFilter(key, value) {
      store.setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 }))
      refresh()
    },

    clearFilters() {
      store.setState((s) => ({ ...s, filters: {}, page: 1 }))
      refresh()
    },

    isSelected: (key) => selection.isSelected(key),
    toggleRow: (key) => selection.toggle(key),
    toggleAll: () => selection.toggleAll(store.getState().rows.map(rowKeyOf)),
    isAllSelected: () => selection.isAllSelected(store.getState().rows.map(rowKeyOf)),
    clearSelection: () => selection.clear(),

    startEdit: (rowKey, columnKey) => cellEdit.startEdit(rowKey, columnKey),

    cancelEdit: () => cellEdit.cancelEdit(),

    commitEdit(value) {
      if (!cellEdit.getEditing()) return
      cellEdit.commitEdit(value) // → onCommit (write-back + onCellEdit), then clears editing
      if (mode === 'client') refresh()
    },

    setPage(page) {
      store.setState((s) => ({ ...s, page }))
      refresh()
    },

    setPageSize(size) {
      store.setState((s) => ({ ...s, pageSize: size, page: 1 }))
      refresh()
    },

    pageCount() {
      const s = store.getState()
      return corePageCount(s.total, s.pageSize)
    },

    reload: refresh,

    exportCsv() {
      const cols = visibleColumns().map((c) => ({
        key: c.key,
        title: c.title,
        dataIndex: dataIndexOf(c),
      }))
      const rows = (mode === 'client' ? processedAll() : store.getState().rows) as Record<
        string,
        unknown
      >[]
      return toCsv(rows, cols)
    },

    exportExcelXml(sheetName) {
      const cols = visibleColumns().map((c) => ({
        key: c.key,
        title: c.title,
        dataIndex: dataIndexOf(c),
      }))
      const rows = (mode === 'client' ? processedAll() : store.getState().rows) as Record<
        string,
        unknown
      >[]
      return toSpreadsheetXml(rows, cols, { sheetName })
    },
  }

  return api
}

/** CSS custom properties the ProTable reads; overridable by the host theme. */
export const proTableTokens: Record<string, string> = {
  '--iris-pro-table-border': 'var(--iris-color-border, #e5e7eb)',
  '--iris-pro-table-header-bg': 'var(--iris-color-bg-subtle, #f9fafb)',
  '--iris-pro-table-row-hover': 'var(--iris-color-bg-subtle, #f3f4f6)',
  '--iris-pro-table-selected-bg': 'var(--iris-color-primary-soft, #eff6ff)',
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
