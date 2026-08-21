import { aggregate } from '@iris-ui-kit/core'
import { h, type VNode } from 'vue'
import type { IrisTableColumn } from './types'

type TableRow = Record<string, unknown>

export interface TableSummaryRendererContext {
  bodyData: TableRow[]
  leafColumns: IrisTableColumn<TableRow>[]
  visibleColSet: Set<number> | null
  gridTemplate: string
  leadingCells: VNode[]
  colTrack: (index: number) => number
  getCellValue: (row: TableRow, column: IrisTableColumn<TableRow>) => unknown
  pinnedStyle: (key: string) => Record<string, string>
}

/** Render the global summary row after its leading placeholder cells are built. */
export function renderTableSummaryRow(ctx: TableSummaryRendererContext): VNode | null {
  if (ctx.bodyData.length === 0 || !ctx.leafColumns.some((column) => column.summary)) return null

  const summaryCells: VNode[] = [...ctx.leadingCells]
  for (let columnIndex = 0; columnIndex < ctx.leafColumns.length; columnIndex += 1) {
    const column = ctx.leafColumns[columnIndex]
    if (ctx.visibleColSet && !ctx.visibleColSet.has(columnIndex)) continue
    const align = column.align ?? 'left'
    const operation = column.summary
    const value = operation
      ? aggregate(ctx.bodyData, (row) => ctx.getCellValue(row, column), operation)
      : null
    const content: VNode | VNode[] | string =
      operation != null && value != null
        ? column.renderSummary
          ? (column.renderSummary(value, ctx.bodyData) as VNode | VNode[] | string)
          : String(value)
        : ''
    summaryCells.push(
      h(
        'div',
        {
          key: column.key,
          role: 'cell',
          'data-iris-table-cell': column.key,
          'data-iris-table-summary-cell': operation ? '' : undefined,
          'data-iris-table-pinned': column.pinned,
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
            padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
            fontSize: 'var(--iris-font-size-md, 14px)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            ...(ctx.visibleColSet ? { gridColumnStart: String(ctx.colTrack(columnIndex)) } : {}),
            ...ctx.pinnedStyle(column.key),
          },
        },
        content,
      ),
    )
  }

  return h(
    'div',
    {
      role: 'row',
      'data-iris-table-row': 'summary',
      style: {
        display: 'grid',
        gridTemplateColumns: ctx.gridTemplate,
        fontWeight: '600',
        borderTop: '2px solid var(--iris-border)',
        background: 'var(--iris-surface)',
      },
    },
    summaryCells,
  )
}
