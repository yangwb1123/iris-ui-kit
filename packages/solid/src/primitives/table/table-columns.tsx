import type { DetectedColumnType } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/** Apply a controlled top-level order without mutating the source declaration. */
export function applyTableColumnOrder<Row extends Record<string, unknown>>(
  columns: IrisTableColumn<Row>[],
  order?: readonly string[],
): IrisTableColumn<Row>[] {
  if (order === undefined || order.length === 0) return columns

  const orderIndex = new Map<string, number>()
  order.forEach((key, index) => {
    if (!orderIndex.has(key)) orderIndex.set(key, index)
  })
  const ordered = columns.filter((column) => orderIndex.has(column.key))
  if (ordered.length === 0) return columns
  ordered.sort((left, right) => orderIndex.get(left.key)! - orderIndex.get(right.key)!)
  const rest = columns.filter((column) => !orderIndex.has(column.key))
  return [...ordered, ...rest]
}

export function applyDetectedTableTypes<Row extends Record<string, unknown>>(
  columns: IrisTableColumn<Row>[],
  detectedTypes: Record<string, DetectedColumnType>,
): IrisTableColumn<Row>[] {
  const apply = (column: IrisTableColumn<Row>): IrisTableColumn<Row> => {
    const kind = detectedTypes[column.key]
    const next = kind
      ? {
          ...column,
          ...(kind === 'number'
            ? column.align === undefined
              ? { align: 'right' as const }
              : null
            : column.align === undefined
              ? { align: 'left' as const }
              : null),
        }
      : column
    return next.children && next.children.length > 0
      ? { ...next, children: next.children.map(apply) }
      : next
  }
  return columns.map(apply)
}
