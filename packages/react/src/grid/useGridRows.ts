import * as React from 'react'
import {
  createGridRowsFeature,
  type GridRowKey,
  type GridCore,
  type GridRowsModel,
  type GridRowsTransaction,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

export interface UseGridRowsOptions<Row extends Record<string, unknown>, Meta = unknown> {
  cloneDefaultRows?: boolean
  rowKeyField?: string
  getRowKey?: (row: Row, index: number) => GridRowKey | undefined
  /** Read nested rows when the source is a tree; omitted keeps flat-row semantics. */
  getChildren?: (row: Row) => readonly Row[] | undefined
  /** Replace nested rows immutably when `getChildren` is not a direct property. */
  setChildren?: (row: Row, children: Row[]) => Row
  onBeforeRowsChange?: (transaction: GridRowsTransaction<Row, Meta>) => void
  onRowsChange?: (transaction: GridRowsTransaction<Row, Meta>) => void
}

export interface UseGridRowsResult<Row extends Record<string, unknown>, Meta = unknown> {
  model: GridRowsModel<Row, Meta>
  rows: Row[]
}

/** Installs the single Grid Core row source and bridges it to React rendering. */
export function useGridRows<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Meta = unknown,
>(
  core: GridCore<Row>,
  initialRows: readonly Row[],
  options: UseGridRowsOptions<Row, Meta> = {},
): UseGridRowsResult<Row, Meta> {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridRowsModel<Row, Meta>>(core, 'rows', 'getRowsModel', () =>
    createGridRowsFeature<Row, Meta>({
      defaultRows: initialRows,
      cloneDefaultRows: options.cloneDefaultRows,
      rowKeyField: options.rowKeyField,
      getRowKey: (row: Row, index: number) => latest.current.getRowKey?.(row, index),
      getChildren: options.getChildren,
      setChildren: options.setChildren,
      onBeforeRowsChange: (transaction) => latest.current.onBeforeRowsChange?.(transaction),
      onRowsChange: (transaction) => latest.current.onRowsChange?.(transaction),
    }),
  )
  const rows = useStore(model.store)
  return { model, rows }
}
