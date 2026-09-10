import type { GridRowKey } from './grid-rows'

type GridTreeValidationOptions<Row extends Record<string, unknown>> = {
  readonly getRowKey: (row: Row, index: number) => GridRowKey | undefined
  readonly getChildren: (row: Row) => readonly Row[] | undefined
}

export function hasMalformedTree<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  options: GridTreeValidationOptions<Row>,
): boolean {
  const seenKeys = new Set<GridRowKey>()
  const seenRows = new Set<Row>()
  const visit = (siblings: readonly Row[]): boolean => {
    for (const [index, row] of siblings.entries()) {
      const rowKey = options.getRowKey(row, index)
      if (wasSeen(row, rowKey, seenKeys, seenRows)) return true
      const children = options.getChildren(row)
      if (children?.length && visit(children)) return true
    }
    return false
  }
  return visit(nodes)
}

export function wasSeen<Row extends Record<string, unknown>>(
  row: Row,
  rowKey: GridRowKey | undefined,
  seenKeys: Set<GridRowKey>,
  seenRows: Set<Row>,
): boolean {
  if (seenRows.has(row)) return true
  seenRows.add(row)
  if (rowKey === undefined) return false
  if (seenKeys.has(rowKey)) return true
  seenKeys.add(rowKey)
  return false
}
