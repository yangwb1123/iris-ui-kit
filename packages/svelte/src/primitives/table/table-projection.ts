import { reconcileProjectedRows } from '@iris-ui-kit/core'
type TableRow = Record<string, unknown>

export function createTableClipboardRowReconciler(options: {
  getVisibleRows: () => TableRow[]
  getRowKey: (row: TableRow, index: number) => string | number
  getChildren: () => ((row: TableRow) => readonly TableRow[] | undefined) | undefined
  setChildren: () => ((row: TableRow, children: TableRow[]) => TableRow) | undefined
}): (
  sourceRows: readonly TableRow[],
  previousRows: readonly TableRow[],
  rows: readonly TableRow[],
) => TableRow[] {
  return (sourceRows, previousRows, rows) =>
    reconcileProjectedRows(sourceRows, previousRows, rows, {
      visibleRows: options.getVisibleRows(),
      getRowKey: options.getRowKey,
      getChildren: options.getChildren(),
      setChildren: options.setChildren(),
    })
}
