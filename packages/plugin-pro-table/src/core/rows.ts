import { readCell, type DataViewColumn } from '@iris-ui-kit/core'
import type { ProTableColumn, ProTableTreeConfig } from './types'

/** Flatten every tree node for edit lookup while preserving source row objects. */
export function collectProTableRows<Row>(
  flatRows: Row[],
  treeRoots: Row[] | null,
  tree: ProTableTreeConfig<Row> | undefined,
): Row[] {
  if (!treeRoots || !tree) return flatRows
  const rows: Row[] = []
  const walk = (nodes: Row[]): void => {
    for (const node of nodes) {
      rows.push(node)
      const children = tree.getChildren(node)
      if (children?.length) walk(children)
    }
  }
  walk(treeRoots)
  return rows
}

/** Map ProTable columns onto the core data-view contract. */
export function toDataViewColumns<Row extends Record<string, unknown>>(
  columns: ProTableColumn<Row>[],
): DataViewColumn<Row>[] {
  return columns.map((column) => ({
    key: column.key,
    getValue: (row: Row) => readCell(row, column),
    filterable: column.filterable,
    sorter: column.sorter,
  }))
}
