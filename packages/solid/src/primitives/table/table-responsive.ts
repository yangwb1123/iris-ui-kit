import {
  computeResponsiveColumns,
  flattenLeafColumns,
  RESPONSIVE_NARROW_WIDTH,
} from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

export interface ResponsiveTableResult<Row extends Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  overflow: boolean
}

/** Calculates the narrow-table column fit and overflow state in one pass. */
export function computeTableResponsiveColumns<Row extends Record<string, unknown>>(
  columns: IrisTableColumn<Row>[],
  containerWidth: number,
  leadingWidth: number,
  widthOf: (column: IrisTableColumn<Row>) => number,
): ResponsiveTableResult<Row> {
  if (containerWidth <= 0 || containerWidth >= RESPONSIVE_NARROW_WIDTH) {
    return { columns, overflow: false }
  }
  const budget = Math.max(1, containerWidth - leadingWidth)
  const isPinned = (column: IrisTableColumn<Row>): boolean =>
    column.children && column.children.length > 0
      ? column.children.some(isPinned)
      : column.pinned !== undefined
  const fitted = computeResponsiveColumns(columns, budget, {
    widthOf: (column) => widthOf(column as IrisTableColumn<Row>),
    isPinned: (column) => isPinned(column as IrisTableColumn<Row>),
    narrowWidth: RESPONSIVE_NARROW_WIDTH - leadingWidth,
  }) as IrisTableColumn<Row>[]
  const natural = fitted.reduce(
    (sum, column) =>
      sum +
      (column.children && column.children.length > 0
        ? flattenLeafColumns(column.children).reduce((nested, leaf) => nested + widthOf(leaf), 0)
        : widthOf(column)),
    leadingWidth,
  )
  return { columns: fitted, overflow: natural > containerWidth }
}
