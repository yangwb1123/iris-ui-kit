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
  const parts: string[] = []
  if (rowDrag) parts.push('40px')
  if (seq) parts.push('60px')
  if (hasDetail) parts.push('40px')
  if (showSelection) parts.push('40px')
  for (const column of leafColumns) {
    if (isCollapsed(column.key)) {
      parts.push('0px')
      continue
    }
    const override = effectiveWidths[column.key]
    if (override != null) parts.push(`${override}px`)
    else if (typeof column.width === 'number') parts.push(`${column.width}px`)
    else if (column.width === 'auto') parts.push('minmax(max-content, max-content)')
    else if (typeof column.width === 'string') parts.push(column.width)
    else parts.push('minmax(0, 1fr)')
  }
  return parts.join(' ')
}
