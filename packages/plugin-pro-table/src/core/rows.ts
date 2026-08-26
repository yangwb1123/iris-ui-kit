import { readCell, type DataViewColumn } from '@iris-ui-kit/core'
import { collectTreeRows } from '@iris-ui-kit/core/grid'
import type { ProTableColumn, ProTableTreeConfig } from './types'

/** Flatten every tree node for edit lookup while preserving source row objects. */
export function collectProTableRows<Row extends Record<string, unknown>>(
  flatRows: Row[],
  treeRoots: Row[] | null,
  tree: ProTableTreeConfig<Row> | undefined,
  rowKeyOf?: (row: Row, index: number) => string | number | undefined,
): Row[] {
  if (!treeRoots || !tree) return flatRows
  return collectTreeRows(treeRoots, {
    getRowKey: rowKeyOf ?? (() => undefined),
    getChildren: tree.getChildren,
  })
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
