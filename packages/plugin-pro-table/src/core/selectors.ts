import {
  createSyncClientDataSource,
  filterSort,
  flattenTree,
  paginate,
  type DataSourceConfig,
  type DataViewColumn,
  type ExpansionModel,
} from '@iris-ui-kit/core'
import type { ProTableColumn, ProTableConfig } from './types'

interface ProTableColumnState {
  order(): string[]
  isVisible(key: string): boolean
}

/** Build the synchronous client fetcher, including the tree flattening path. */
export function createProTableSyncFetcher<Row extends Record<string, unknown>>(args: {
  config: ProTableConfig<Row>
  allRows: Row[]
  treeRoots: Row[] | null
  expansion: ExpansionModel<string> | null
  rowKeyOf: (row: Row) => string
  dataViewColumns: () => DataViewColumn<Row>[]
}): DataSourceConfig<Row>['fetcher'] {
  const { config, allRows, treeRoots, expansion, rowKeyOf, dataViewColumns } = args
  if (!config.tree || !expansion || !treeRoots) {
    return createSyncClientDataSource(allRows, dataViewColumns())
  }

  const tree = config.tree
  return ({ page, pageSize, sort, filters }) => {
    const flat = flattenTree(treeRoots, {
      getKey: rowKeyOf,
      getChildren: tree.getChildren,
      isExpanded: (key) => expansion.isExpanded(key),
    })
    const processed = filterSort(
      flat.map((row) => row.row),
      dataViewColumns(),
      { filters, sort },
    )
    return { rows: paginate(processed, page, pageSize), total: processed.length }
  }
}

/** Return ordered, visible leaf columns from the shared column controller. */
export function getProTableVisibleColumns<Row extends Record<string, unknown>>(
  columns: ProTableColumn<Row>[],
  columnOrder: string[],
  columnState: ProTableColumnState,
): ProTableColumn<Row>[] {
  const leaves = flattenLeafColumns(columns)
  const byKey = new Map(leaves.map((column) => [column.key, column]))
  return columnOrder.flatMap((key) => {
    const column = byKey.get(key)
    return column && columnState.isVisible(key) ? [column] : []
  })
}

function flattenLeafColumns<Row extends Record<string, unknown>>(
  columns: ProTableColumn<Row>[],
): ProTableColumn<Row>[] {
  const leaves: ProTableColumn<Row>[] = []
  const visit = (column: ProTableColumn<Row>): void => {
    if (column.children?.length) {
      column.children.forEach(visit)
    } else {
      leaves.push(column)
    }
  }
  columns.forEach(visit)
  return leaves
}

/** Build visible export rows and column metadata from current table state. */
export function getProTableExportData<Row extends Record<string, unknown>>(args: {
  mode: 'client' | 'server'
  allRows: Row[]
  currentRows: Row[]
  visibleColumns: ProTableColumn<Row>[]
  dataIndexOf: (column: ProTableColumn<Row>) => string
  sort: { key: string; direction: 'asc' | 'desc' } | null
  filters: Record<string, string>
  dataViewColumns: () => DataViewColumn<Row>[]
}): {
  rows: Record<string, unknown>[]
  cols: { key: string; title: string; dataIndex: string }[]
} {
  const {
    mode,
    allRows,
    currentRows,
    visibleColumns,
    dataIndexOf,
    sort,
    filters,
    dataViewColumns,
  } = args
  const cols = visibleColumns.map((column) => ({
    key: column.key,
    title: column.title,
    dataIndex: dataIndexOf(column),
  }))
  const processed =
    mode === 'client' ? filterSort(allRows, dataViewColumns(), { filters, sort }) : currentRows
  return { rows: processed as Record<string, unknown>[], cols }
}
