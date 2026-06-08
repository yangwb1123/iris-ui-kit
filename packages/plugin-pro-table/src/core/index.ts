import { createStore, createPlugin, toSpreadsheetXml, type Store } from '@iris-ui/core'

/**
 * `@iris-ui/plugin-pro-table` — a vxe-table-style CRUD data table for Iris UI.
 * This `core` entry is framework-agnostic: {@link createProTableStore} owns all
 * the table logic (sort / filter / selection / inline edit / pagination /
 * client+server modes / export) behind a subscribable {@link Store}. The four
 * framework entries are render-only adapters that read this store and draw rows
 * with their native `renderCell`.
 */

export type SortDirection = 'asc' | 'desc'
export interface SortState {
  key: string
  direction: SortDirection
}

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
  /** Resolve a row's stable key. */
  rowKeyOf(row: Row): string
  /** Columns minus hidden ones, in order. */
  visibleColumns(): ProTableColumn<Row>[]
  /** Read a cell's raw value. */
  cellValue(row: Row, column: ProTableColumn<Row>): unknown
  // sorting / filtering
  toggleSort(key: string): void
  setFilter(key: string, value: string): void
  clearFilters(): void
  // selection (operates over the current page)
  isSelected(key: string): boolean
  toggleRow(key: string): void
  toggleAll(): void
  isAllSelected(): boolean
  clearSelection(): void
  // inline edit
  startEdit(rowKey: string, columnKey: string): void
  cancelEdit(): void
  commitEdit(value: unknown): void
  // pagination
  setPage(page: number): void
  setPageSize(size: number): void
  pageCount(): number
  // server mode
  reload(): void
  // export (uses filtered+sorted rows, visible columns)
  exportCsv(): string
  exportExcelXml(sheetName?: string): string
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function escapeCsv(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function createProTableStore<Row extends Record<string, unknown>>(
  config: ProTableConfig<Row>,
): ProTableStore<Row> {
  const mode: ProTableMode = config.mode ?? 'client'
  const allRows: Row[] = [...(config.data ?? [])]

  const rowKeyOf = (row: Row): string =>
    typeof config.rowKey === 'function' ? config.rowKey(row) : String(row[config.rowKey])

  const dataIndexOf = (column: ProTableColumn<Row>): string => column.dataIndex ?? column.key
  const cellValue = (row: Row, column: ProTableColumn<Row>): unknown => row[dataIndexOf(column)]

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

  const visibleColumns = (): ProTableColumn<Row>[] =>
    store.getState().columns.filter((c) => !c.hidden)

  /** Client mode: filter → sort → paginate from `allRows`. */
  function processClient(): void {
    const { sort, filters, page, pageSize } = store.getState()
    let working = allRows

    const activeFilters = Object.entries(filters).filter(([, v]) => v !== '')
    if (activeFilters.length > 0) {
      working = working.filter((row) =>
        activeFilters.every(([key, value]) => {
          const col = config.columns.find((c) => c.key === key)
          if (!col) return true
          const cell = cellValue(row, col)
          return String(cell ?? '')
            .toLowerCase()
            .includes(value.toLowerCase())
        }),
      )
    }

    if (sort) {
      const col = config.columns.find((c) => c.key === sort.key)
      if (col) {
        const cmp =
          col.sorter ?? ((a: Row, b: Row) => compareValues(cellValue(a, col), cellValue(b, col)))
        working = [...working].sort((a, b) => (sort.direction === 'asc' ? cmp(a, b) : -cmp(a, b)))
      }
    }

    const total = working.length
    const start = (page - 1) * pageSize
    const rows = working.slice(start, start + pageSize)
    store.setState((s) => ({ ...s, rows, total }))
  }

  /** Server mode: call onLoad with the current query. */
  function processServer(): void {
    if (!config.onLoad) return
    const { sort, filters, page, pageSize } = store.getState()
    store.setState((s) => ({ ...s, loading: true }))
    config.onLoad({ page, pageSize, sort, filters }).then(
      (result) =>
        store.setState((s) => ({ ...s, rows: result.rows, total: result.total, loading: false })),
      () => store.setState((s) => ({ ...s, loading: false })),
    )
  }

  const refresh = (): void => (mode === 'server' ? processServer() : processClient())

  /** Filtered + sorted rows across ALL pages (for export). Client mode only. */
  function processedAll(): Row[] {
    const { sort, filters } = store.getState()
    let working = allRows
    const activeFilters = Object.entries(filters).filter(([, v]) => v !== '')
    if (activeFilters.length > 0) {
      working = working.filter((row) =>
        activeFilters.every(([key, value]) => {
          const col = config.columns.find((c) => c.key === key)
          if (!col) return true
          return String(cellValue(row, col) ?? '')
            .toLowerCase()
            .includes(value.toLowerCase())
        }),
      )
    }
    if (sort) {
      const col = config.columns.find((c) => c.key === sort.key)
      if (col) {
        const cmp =
          col.sorter ?? ((a: Row, b: Row) => compareValues(cellValue(a, col), cellValue(b, col)))
        working = [...working].sort((a, b) => (sort.direction === 'asc' ? cmp(a, b) : -cmp(a, b)))
      }
    }
    return working
  }

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
      store.setState((s) => {
        let next: SortState | null
        if (!s.sort || s.sort.key !== key) next = { key, direction: 'asc' }
        else if (s.sort.direction === 'asc') next = { key, direction: 'desc' }
        else next = null
        return { ...s, sort: next, page: 1 }
      })
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

    isSelected: (key) => store.getState().selectedKeys.includes(key),

    toggleRow(key) {
      store.setState((s) => {
        const has = s.selectedKeys.includes(key)
        return {
          ...s,
          selectedKeys: has ? s.selectedKeys.filter((k) => k !== key) : [...s.selectedKeys, key],
        }
      })
    },

    toggleAll() {
      store.setState((s) => {
        const pageKeys = s.rows.map(rowKeyOf)
        const allOn = pageKeys.every((k) => s.selectedKeys.includes(k))
        const selectedKeys = allOn
          ? s.selectedKeys.filter((k) => !pageKeys.includes(k))
          : Array.from(new Set([...s.selectedKeys, ...pageKeys]))
        return { ...s, selectedKeys }
      })
    },

    isAllSelected() {
      const s = store.getState()
      const pageKeys = s.rows.map(rowKeyOf)
      return pageKeys.length > 0 && pageKeys.every((k) => s.selectedKeys.includes(k))
    },

    clearSelection() {
      store.setState((s) => ({ ...s, selectedKeys: [] }))
    },

    startEdit(rowKey, columnKey) {
      store.setState((s) => ({ ...s, editing: { rowKey, columnKey } }))
    },

    cancelEdit() {
      store.setState((s) => ({ ...s, editing: null }))
    },

    commitEdit(value) {
      const editing = store.getState().editing
      if (!editing) return
      const column = config.columns.find((c) => c.key === editing.columnKey)
      if (!column) {
        store.setState((s) => ({ ...s, editing: null }))
        return
      }
      const dataIndex = dataIndexOf(column)
      const idx = allRows.findIndex((r) => rowKeyOf(r) === editing.rowKey)
      const oldValue = idx >= 0 ? allRows[idx][dataIndex] : undefined
      const newValue = column.editor === 'number' ? Number(value) : value
      let updatedRow = {} as Row
      if (idx >= 0) {
        // immutable write-back into the client dataset
        updatedRow = { ...allRows[idx], [dataIndex]: newValue }
        allRows[idx] = updatedRow
      }
      config.onCellEdit?.({
        rowKey: editing.rowKey,
        columnKey: editing.columnKey,
        dataIndex,
        oldValue,
        newValue,
        row: updatedRow,
      })
      store.setState((s) => ({ ...s, editing: null }))
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
      return Math.max(1, Math.ceil(s.total / s.pageSize))
    },

    reload: refresh,

    exportCsv() {
      const cols = visibleColumns()
      const rows = mode === 'client' ? processedAll() : store.getState().rows
      const header = cols.map((c) => escapeCsv(c.title)).join(',')
      const body = rows
        .map((row) => cols.map((c) => escapeCsv(cellValue(row, c))).join(','))
        .join('\n')
      return `${header}\n${body}`
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
