import type { DetectedColumnType } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

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
