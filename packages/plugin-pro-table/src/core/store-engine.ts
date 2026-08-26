import {
  createStore,
  createCellEdit,
  createColumnState,
  createDataSource,
  createExpansion,
  cycleSort,
  dataIndexOf,
  readCell,
  buildHeaderMatrix,
  flattenTree,
  summarize,
  type HeaderCell,
  type ExpansionModel,
  type TreeRow,
} from '@iris-ui-kit/core'
import { collectTreeRows, createGridCore } from '@iris-ui-kit/core/grid'
import { createProTableMutationTools } from './mutations'
import { collectProTableRows, toDataViewColumns } from './rows'
import {
  createProTableSyncFetcher,
  getProTableExportData,
  getProTableVisibleColumns,
} from './selectors'
import { computeProTableColumnWindow } from './view'
import { createGridExportFeature } from './grid'
import { createProTableClientRowsBridge } from './rows-model'

import type {
  ProTableColumn,
  ProTableConfig,
  ProTableMode,
  ProTableState,
  ProTableStore,
} from './types'

class ProTableStoreEngine<Row extends Record<string, unknown>> {
  readonly store: ProTableStore<Row>

  constructor(config: ProTableConfig<Row>) {
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

    const rowKeyOf = (row: Row): string =>
      typeof config.rowKey === 'function' ? config.rowKey(row) : String(row[config.rowKey])

    const allRowsForEdit = collectProTableRows(allRows, treeRoots, config.tree, rowKeyOf)

    const clientRowsModel = createProTableClientRowsBridge({
      mode,
      allRows,
      treeRoots,
      allRowsForEdit,
      rowKeyOf,
      tree: config.tree,
    })

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
    // + selection. Client mode uses a synchronous fetcher so rows are ready right
    // after construction; tree mode flattens the expanded hierarchy first.
    const buildSyncFetcher = () =>
      createProTableSyncFetcher({
        config,
        allRows,
        treeRoots,
        expansion,
        rowKeyOf,
        dataViewColumns,
      })

    const dataSource = createDataSource<Row>({
      fetcher:
        mode === 'server' && config.onLoad
          ? (q) =>
              config.onLoad!({
                page: q.page,
                pageSize: q.pageSize,
                sort: q.sort,
                filters: q.filters,
              })
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
        // Resolve through the rows capability so tree edits do not depend on
        // the adapter-maintained flattened lookup mirror. Server mode keeps
        // its existing source-array fallback because the remote page is not a
        // client rows model.
        const currentRow =
          clientRowsModel?.find(rowKey) ?? allRowsForEdit.find((r) => rowKeyOf(r) === rowKey)
        const oldValue = currentRow?.[dataIndex]
        const newValue = column.editor === 'number' ? Number(value) : value
        let updatedRow = {} as Row
        if (currentRow) {
          updatedRow = { ...currentRow, [dataIndex]: newValue }
          if (clientRowsModel) {
            clientRowsModel.update(rowKey, { [dataIndex]: newValue } as Partial<Row>, {
              reason: 'cell-edit',
            })
            // `onRowsChange` mirrors the updated row into the legacy array;
            // expose that canonical row object to the callback when present.
            updatedRow = clientRowsModel.find(rowKey) ?? updatedRow
          } else {
            const index = allRowsForEdit.findIndex((row) => rowKeyOf(row) === rowKey)
            if (index >= 0) allRowsForEdit[index] = updatedRow
          }
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
      return getProTableVisibleColumns(cols, columnOrder, cs)
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

    /** Visible columns + processed rows — the shared input for every export format. */
    function exportData(): {
      rows: Record<string, unknown>[]
      cols: { key: string; title: string; dataIndex: string }[]
    } {
      const state = store.getState()
      return getProTableExportData({
        mode,
        allRows,
        currentRows: state.rows,
        visibleColumns: visibleColumns(),
        dataIndexOf,
        sort: state.sort,
        filters: state.filters,
        dataViewColumns,
      })
    }

    // B-layer abilities are loaded per ProTable instance. The store keeps its
    // legacy methods, but their implementation now belongs to the export
    // feature instead of duplicating four serializer paths in this engine.
    const exportGrid = createGridCore<Record<string, unknown>>({
      features: [
        createGridExportFeature({
          getData: () => {
            const { rows, cols } = exportData()
            return { rows, columns: cols }
          },
        }),
      ],
    })

    const { runMutation, resourceHandlerRequired, removeClientRows } = createProTableMutationTools({
      store,
      dataSource,
      allRows,
      treeRoots,
      allRowsForEdit,
      rowKeyOf,
      removeRowsFromModel: clientRowsModel
        ? (keys) => {
            return clientRowsModel
              .removeMany([...keys], { reason: 'remove' })
              .map((removedKey) => String(removedKey))
          }
        : undefined,
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
            if (clientRowsModel) {
              // ProTable create preserves the caller's row shape. Use an
              // append transaction rather than the table-handle insert helper,
              // whose legacy auto-id behavior is not part of this API.
              clientRowsModel.transact((rows) => [...rows, created], { reason: 'insert' })
            } else {
              allRows.push(created)
              if (treeRoots) {
                treeRoots.push(created)
                allRowsForEdit.push(created)
              }
            }
          }
        })
        return created
      },

      async deleteRow(key) {
        const row =
          clientRowsModel?.find(key) ??
          allRowsForEdit.find((candidate) => rowKeyOf(candidate) === key) ??
          store.getState().rows.find((candidate) => rowKeyOf(candidate) === key)
        if (!row) return false
        await runMutation('delete', [key], async () => {
          const handler = config.mutations?.delete
          if (mode === 'server' && !handler) throw resourceHandlerRequired('delete')
          await handler?.(key, row)
          const removedKeys = mode === 'client' ? removeClientRows(new Set([key])) : []
          for (const removedKey of removedKeys) dataSource.selection.deselect(removedKey)
        })
        if (mode !== 'client') dataSource.selection.deselect(key)
        return true
      },

      async bulkDelete(keys = dataSource.selection.get()) {
        const uniqueKeys = [...new Set(keys)]
        if (uniqueKeys.length === 0) return 0
        const keySet = new Set(uniqueKeys)
        const loadedRows =
          mode === 'client' && clientRowsModel
            ? uniqueKeys
                .map((key) => clientRowsModel.find(key))
                .filter((row): row is Row => row !== undefined)
            : store.getState().rows.filter((row) => keySet.has(rowKeyOf(row)))

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
          const removedKeys = mode === 'client' ? removeClientRows(keySet) : []
          if (mode === 'client') {
            const removedSet = new Set(removedKeys)
            dataSource.selection.set(
              dataSource.selection.get().filter((selectedKey) => !removedSet.has(selectedKey)),
            )
          }
        })
        if (mode !== 'client') {
          dataSource.selection.set(dataSource.selection.get().filter((key) => !keySet.has(key)))
        }
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

      exportCsv: () => exportGrid.invoke<string>('exportCsv'),

      exportExcelXml: (sheetName) => exportGrid.invoke<string>('exportExcelXml', sheetName),

      exportJson: () => exportGrid.invoke<string>('exportJson'),

      exportHtml: (options) => exportGrid.invoke<string>('exportHtml', options),

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
          const keys = collectTreeRows(treeRoots, {
            getRowKey: (row) => rowKeyOf(row),
            getChildren: config.tree.getChildren,
          }).map(rowKeyOf)
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

    this.store = api
  }
}

export function createProTableStore<Row extends Record<string, unknown>>(
  config: ProTableConfig<Row>,
): ProTableStore<Row> {
  return new ProTableStoreEngine(config).store
}
