import {
  createStore,
  createCellEdit,
  createColumnState,
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
  type HeaderCell,
  type ExpansionModel,
  type TreeRow,
} from '@iris-ui-kit/core'
import { createProTableMutationTools } from './mutations'
import { collectProTableRows, toDataViewColumns } from './rows'
import { computeProTableColumnWindow } from './view'

/**
 * `@iris-ui-kit/plugin-pro-table` — a vxe-table-style CRUD data table for Iris UI.
 * This `core` entry is framework-agnostic: {@link createProTableStore} owns all
 * the table logic behind a subscribable {@link Store}. Per the re-layering, it
 * is now a **composition** of @iris-ui-kit/core controllers rather than a monolith:
 * selection → `createSelectionModel`, the filter→sort→paginate pipeline →
 * `filterSort`/`paginate`/`cycleSort`, server loading → `createAsyncResource`
 * (token-guarded, no stale-response clobbering), CSV → `toCsv`. The four
 * framework entries are render-only adapters that read this store.
 */

export type { SortDirection, SortState, TreeRow } from '@iris-ui-kit/core'
import type {
  ProTableColumn,
  ProTableConfig,
  ProTableMode,
  ProTableState,
  ProTableStore,
} from './types'

export type {
  CellEditEvent,
  CellEditor,
  ProTableColumn,
  ProTableConfig,
  ProTableMode,
  ProTableMutateOptions,
  ProTableMutationKind,
  ProTableMutations,
  ProTableMutationState,
  ProTableQuery,
  ProTableState,
  ProTableStore,
  ProTableTreeConfig,
  ProTableLabels,
  ProTableViewOptions,
} from './types'
export * from './view'
export { proTablePlugin } from './plugin'

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

  const allRowsForEdit = collectProTableRows(allRows, treeRoots, config.tree)

  const rowKeyOf = (row: Row): string =>
    typeof config.rowKey === 'function' ? config.rowKey(row) : String(row[config.rowKey])

  const cellValue = (row: Row, column: ProTableColumn<Row>): unknown => readCell(row, column)

  const dataViewColumns = () => toDataViewColumns(config.columns)

  // Column ORDER + VISIBILITY delegate to core `createColumnState` (dedup); WIDTH stays native.
  const cs = createColumnState(
    config.columns.map((c) => ({ key: c.key, title: c.title, hidden: c.hidden })),
  )
  const store = createStore<ProTableState<Row>>({
    rows: [],
    columns: config.columns,
    columnOrder: [...cs.order()],
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
    mutation: {
      kind: null,
      pending: false,
      rowKeys: [],
      error: undefined,
    },
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

  // Mirror the manager's order into ProTableState in ONE setState (one emit); `extra` folds in e.g. `columnSizes`.
  const mirrorColumnState = (extra?: Partial<ProTableState<Row>>): void =>
    store.setState((s) => ({ ...s, columnOrder: [...cs.order()], ...extra }))

  const visibleColumns = (): ProTableColumn<Row>[] => {
    const { columns: cols, columnOrder } = store.getState()
    // Flatten to leaves (multi-level); visibility delegated to `cs.isVisible`.
    const leaves = flattenLeafColumns(cols)
    const byKey = new Map(leaves.map((c) => [c.key, c]))
    return columnOrder.flatMap((k) => {
      const col = byKey.get(k)
      return col && cs.isVisible(k) ? [col] : []
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

  const { runMutation, resourceHandlerRequired, removeClientRows } = createProTableMutationTools({
    store,
    dataSource,
    allRows,
    treeRoots,
    allRowsForEdit,
    rowKeyOf,
  })

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

    mutate: async (action, options) => {
      await runMutation(options?.kind ?? 'custom', options?.rowKeys ?? [], action, options)
    },

    async createRow(row) {
      let created = row
      const inputKey = rowKeyOf(row)
      await runMutation('create', [inputKey], async () => {
        const handler = config.mutations?.create
        if (mode === 'server' && !handler) throw resourceHandlerRequired('create')
        const result = await handler?.(row)
        if (result !== undefined) created = result
        if (mode === 'client') {
          allRows.push(created)
          if (treeRoots) {
            treeRoots.push(created)
            allRowsForEdit.push(created)
          }
        }
      })
      return created
    },

    async deleteRow(key) {
      const row =
        allRowsForEdit.find((candidate) => rowKeyOf(candidate) === key) ??
        store.getState().rows.find((candidate) => rowKeyOf(candidate) === key)
      if (!row) return false
      await runMutation('delete', [key], async () => {
        const handler = config.mutations?.delete
        if (mode === 'server' && !handler) throw resourceHandlerRequired('delete')
        await handler?.(key, row)
        if (mode === 'client') removeClientRows(new Set([key]))
      })
      dataSource.selection.deselect(key)
      return true
    },

    async bulkDelete(keys = dataSource.selection.get()) {
      const uniqueKeys = [...new Set(keys)]
      if (uniqueKeys.length === 0) return 0
      const keySet = new Set(uniqueKeys)
      const sourceRows = mode === 'client' ? allRowsForEdit : store.getState().rows
      const loadedRows = sourceRows.filter((row) => keySet.has(rowKeyOf(row)))

      await runMutation('bulk-delete', uniqueKeys, async () => {
        const handler = config.mutations?.bulkDelete
        if (mode === 'server' && !handler && !config.mutations?.delete) {
          throw resourceHandlerRequired('bulk-delete')
        }
        if (handler) {
          await handler(uniqueKeys, loadedRows)
        } else if (config.mutations?.delete) {
          for (const row of loadedRows) {
            await config.mutations.delete(rowKeyOf(row), row)
          }
        }
        if (mode === 'client') removeClientRows(keySet)
      })
      dataSource.selection.set(dataSource.selection.get().filter((key) => !keySet.has(key)))
      return mode === 'client' ? loadedRows.length : uniqueKeys.length
    },

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
      const order = cs.order()
      const fromIdx = order.indexOf(from)
      const toIdx = order.indexOf(to)
      if (fromIdx === -1 || toIdx === -1) return
      cs.reorder(fromIdx, toIdx)
      mirrorColumnState()
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
      cs.toggleColumn(key)
      mirrorColumnState()
    },
    resetColumns() {
      cs.reset() // order + visibility; width cleared to `{}` below (native).
      mirrorColumnState({ columnSizes: {} })
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
      return computeProTableColumnWindow(store.getState())
    },
  }

  return api
}
