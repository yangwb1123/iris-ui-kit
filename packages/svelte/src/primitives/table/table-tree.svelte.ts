import {
  projectTableBodyRows,
  withSortedChildren,
  type TableBodyRowView,
  type TreeRow,
} from '@iris-ui-kit/core'
import type { IrisTableProps } from './props'

type TableRow = Record<string, unknown>
type RowComparator = (left: TableRow, right: TableRow) => number

export function createTableTreeChildren(options: {
  getLazyLoad: () => IrisTableProps['lazyLoad']
  getSubRows: () => IrisTableProps['getSubRows']
}): {
  readRowChildren: (row: TableRow) => readonly TableRow[] | undefined
  writeLazyChildren: (row: TableRow, children: TableRow[]) => TableRow
} {
  const readRowChildren = (row: TableRow): readonly TableRow[] | undefined => {
    if (options.getLazyLoad() !== undefined) {
      const children = row.children
      if (Array.isArray(children)) return children as TableRow[]
    }
    return options.getSubRows()?.(row)
  }
  return {
    readRowChildren,
    writeLazyChildren: (row, children) => ({ ...row, children }),
  }
}

export function createTableTreeProjection(options: {
  getSubRows: () => IrisTableProps['getSubRows']
  getLazyLoad: () => IrisTableProps['lazyLoad']
  getFilteredRows: () => TableRow[]
  getRowKey: (row: TableRow, index: number) => string | number
  getChildren: (row: TableRow) => readonly TableRow[] | undefined
  getComparator: () => RowComparator | null
  getExpandedKeys: () => readonly string[]
  getRevision: () => number
  findRow: (key: string | number) => TableRow | undefined
  getLiveRows: () => TableRow[]
}): {
  treeMode: boolean
  flatTree: Array<TreeRow<TableRow>> | null
  bodyData: TableRow[]
  liveRowFor: (row: TableRow, index: number) => TableRow
} {
  const treeMode = $derived(
    options.getSubRows() !== undefined || options.getLazyLoad() !== undefined,
  )
  const treeProjection = $derived.by<TableBodyRowView<TableRow>[] | null>(() => {
    void options.getRevision()
    const compare = options.getComparator()
    return treeMode
      ? projectTableBodyRows(options.getFilteredRows(), {
          getKey: (row) => String(options.getRowKey(row, 0)),
          getChildren: compare
            ? withSortedChildren(options.getChildren, compare)
            : options.getChildren,
          isExpanded: (key) => options.getExpandedKeys().includes(key),
        })
      : null
  })
  const flatTree = $derived<Array<TreeRow<TableRow>> | null>(
    treeProjection?.map((view) => view.treeMeta!) ?? null,
  )
  const bodyData = $derived(
    treeProjection ? treeProjection.map((view) => view.row) : options.getFilteredRows(),
  )
  const liveRowFor = (row: TableRow, index: number): TableRow => {
    void options.getRevision()
    const key = options.getRowKey(row, index)
    return (
      options.findRow(key) ??
      options
        .getLiveRows()
        .find(
          (candidate, candidateIndex) => options.getRowKey(candidate, candidateIndex) === key,
        ) ??
      row
    )
  }
  return {
    get treeMode() {
      return treeMode
    },
    get flatTree() {
      return flatTree
    },
    get bodyData() {
      return bodyData
    },
    liveRowFor,
  }
}
