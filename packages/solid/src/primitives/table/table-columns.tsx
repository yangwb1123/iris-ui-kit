import type { DetectedColumnType } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

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
