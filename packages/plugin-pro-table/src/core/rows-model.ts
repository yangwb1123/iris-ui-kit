import { createGridCore, createGridRowsFeature, type GridRowsModel } from '@iris-ui-kit/core/grid'
import { collectProTableRows } from './rows'
import type { ProTableTreeConfig } from './types'

interface ProTableClientRowsOptions<Row extends Record<string, unknown>> {
  rows: Row[]
  rowKeyOf: (row: Row) => string
  getChildren?: (row: Row) => readonly Row[] | undefined
  setChildren?: (row: Row, children: Row[]) => Row
  onRowsChange?: (rows: readonly Row[]) => void
}

/** Client tables keep legacy source identity while mutations use Grid Core rows. */
export function createProTableClientRowsModel<Row extends Record<string, unknown>>(
  options: ProTableClientRowsOptions<Row>,
): GridRowsModel<Row> {
  const { rows, rowKeyOf, getChildren, setChildren } = options
  const coreModel = createGridCore<Row>({
    features: [
      createGridRowsFeature<Row>({
        defaultRows: rows,
        cloneDefaultRows: true,
        getRowKey: (row) => rowKeyOf(row),
        getChildren,
        setChildren,
        onRowsChange: ({ rows: nextRows }) => {
          // Keep the legacy source reference stable for existing data-source
          // fetchers and export selectors.
          rows.splice(0, rows.length, ...nextRows)
          options.onRowsChange?.(rows)
        },
      }),
    ],
  }).invoke<GridRowsModel<Row>>('getRowsModel')

  return coreModel
}

interface ProTableClientRowsBridgeOptions<Row extends Record<string, unknown>> {
  mode: 'client' | 'server'
  allRows: Row[]
  treeRoots: Row[] | null
  allRowsForEdit: Row[]
  rowKeyOf: (row: Row) => string
  tree?: Pick<ProTableTreeConfig<Row>, 'getChildren' | 'setChildren'>
}

/** Build the ProTable bridge and mirror tree projections after each commit. */
export function createProTableClientRowsBridge<Row extends Record<string, unknown>>(
  options: ProTableClientRowsBridgeOptions<Row>,
): GridRowsModel<Row> | null {
  const { mode, allRows, treeRoots, allRowsForEdit, rowKeyOf, tree } = options
  if (mode !== 'client') return null
  return createProTableClientRowsModel({
    rows: treeRoots ?? allRows,
    rowKeyOf,
    getChildren: tree?.getChildren,
    setChildren: tree?.setChildren,
    onRowsChange: tree
      ? (nextRoots) => {
          // `treeRoots` is the source consumed by the synchronous tree
          // fetcher. Keep it in lockstep with the rows feature before any
          // subsequent expand/collapse reload; otherwise a nested edit or
          // delete would be projected from the pre-transaction tree and
          // silently resurrect the old child.
          if (!treeRoots) return
          treeRoots.splice(0, treeRoots.length, ...nextRoots)
          allRows.splice(0, allRows.length, ...nextRoots)
          allRowsForEdit.splice(
            0,
            allRowsForEdit.length,
            ...collectProTableRows(allRows, treeRoots, tree, rowKeyOf),
          )
        }
      : undefined,
  })
}
