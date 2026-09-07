import { resolveGridTemplateColumns } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

/** Build the shared table tracks while collapsing only in-flight fade leaves. */
export function buildTableGridTemplate(
  leafColumns: IrisTableColumn[],
  effectiveWidths: IrisTableColumnWidths,
  rowDrag: boolean,
  seq: boolean,
  hasDetail: boolean,
  showSelection: boolean,
  isCollapsed: (key: string) => boolean,
): string {
  return resolveGridTemplateColumns(leafColumns, effectiveWidths, {
    leadingTracks: [
      ...(rowDrag ? [40] : []),
      ...(seq ? [60] : []),
      ...(hasDetail ? [40] : []),
      ...(showSelection ? [40] : []),
    ],
    isCollapsed: (column) => isCollapsed(column.key),
  })
}
