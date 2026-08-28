import {
  computeResponsiveColumns,
  flattenLeafColumns,
  RESPONSIVE_NARROW_WIDTH,
} from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/** Compute the visible display columns and overflow state for narrow tables. */
export function computeResponsiveTableColumns(
  columns: IrisTableColumn<Record<string, unknown>>[],
  containerWidth: number,
  leadingWidth: number,
  widthOf: (column: IrisTableColumn<Record<string, unknown>>) => number,
  pinOf: (column: IrisTableColumn<Record<string, unknown>>) => 'left' | 'right' | null,
): {
  columns: IrisTableColumn<Record<string, unknown>>[]
  overflow: boolean
} {
  if (containerWidth <= 0 || containerWidth >= RESPONSIVE_NARROW_WIDTH) {
    return { columns, overflow: false }
  }
  const isPinned = (column: IrisTableColumn): boolean =>
    column.children && column.children.length > 0
      ? column.children.some(isPinned)
      : pinOf(column) !== null
  const fitted = computeResponsiveColumns(columns, Math.max(1, containerWidth - leadingWidth), {
    widthOf: (column) => widthOf(column as IrisTableColumn<Record<string, unknown>>),
    isPinned: (column) => isPinned(column as IrisTableColumn),
    narrowWidth: RESPONSIVE_NARROW_WIDTH - leadingWidth,
  }) as IrisTableColumn<Record<string, unknown>>[]
  const natural = fitted.reduce(
    (sum, column) =>
      sum +
      (column.children && column.children.length > 0
        ? flattenLeafColumns([column]).reduce((nested, leaf) => nested + widthOf(leaf), 0)
        : widthOf(column)),
    leadingWidth,
  )
  return { columns: fitted, overflow: natural > containerWidth }
}
