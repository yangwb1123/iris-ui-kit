import type { DetectedColumnType } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/**
 * Project an optional top-level order onto the caller's column declarations.
 * Unknown and repeated keys are ignored; columns omitted from the order retain
 * their source-relative order after the ordered columns. The empty/unset path
 * preserves the source array so the default render remains allocation-free.
 */
export function applyTableColumnOrder(
  columns: IrisTableColumn[],
  order: readonly string[] | undefined,
): IrisTableColumn[] {
  if (!order || order.length === 0) return columns

  const orderIndex = new Map<string, number>()
  order.forEach((key, index) => {
    if (!orderIndex.has(key)) orderIndex.set(key, index)
  })
  const ordered = columns.filter((column) => orderIndex.has(column.key))
  const rest = columns.filter((column) => !orderIndex.has(column.key))
  ordered.sort((left, right) => orderIndex.get(left.key)! - orderIndex.get(right.key)!)
  return [...ordered, ...rest]
}

export function applyDetectedTableTypes(
  columns: IrisTableColumn[],
  detected: Record<string, DetectedColumnType>,
): IrisTableColumn[] {
  const apply = (column: IrisTableColumn): IrisTableColumn => {
    const kind = detected[column.key]
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
