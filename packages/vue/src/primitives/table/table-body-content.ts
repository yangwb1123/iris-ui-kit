import { type ExtractPropTypes, h, type Slots, type VNode } from 'vue'
import type { TreeRow } from '@iris-ui-kit/core'
import type { UseI18nReturn } from '../../i18n'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import { tableProps } from './props'
import { renderTableBodyRow, type TableBodyRowContext } from './table-body-row'
import { renderTableStateRow } from './table-state-renderer'
import { renderTableSummaryRow } from './table-summary-renderer'
import type { IrisTableColumn } from './types'

type TableRuntimeProps = Readonly<ExtractPropTypes<typeof tableProps>>
type TableRow = Record<string, unknown>
type TableColumn = IrisTableColumn<TableRow>
type Translate = UseI18nReturn['t']

export interface TableBodyContentContext extends TableBodyRowContext {
  props: TableRuntimeProps
  slots: Slots
  t: Translate
  treeMode: boolean
  bodyData: TableRow[]
  leafColumns: TableColumn[]
  tableError: boolean
  tableLoading: boolean
  retry?: () => void
  flatTree: Array<TreeRow<TableRow>> | null
  columnFadeAttr: (column: TableColumn) => 'in' | 'out' | undefined
}

export interface TableBodyContentResult {
  bodyNode: VNode
  summaryRow: VNode | null
}

function leadSummaryCells(ctx: TableBodyContentContext): VNode[] {
  const cells: VNode[] = []
  if (ctx.showDrag) {
    cells.push(
      h('div', {
        key: '__drag',
        role: 'cell',
        'data-iris-table-cell': '__drag',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
        },
      }),
    )
  }
  if (ctx.showSeq) {
    cells.push(
      h('div', {
        key: '__seq',
        role: 'cell',
        'data-iris-table-cell': '__seq',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
        },
      }),
    )
  }
  if (ctx.showDetail) {
    cells.push(
      h('div', {
        key: '__expand',
        role: 'cell',
        'data-iris-table-cell': '__expand',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
        },
      }),
    )
  }
  if (ctx.showSelection) {
    cells.push(
      h('div', {
        key: '__selection',
        role: 'cell',
        'data-iris-table-cell': '__selection',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
        },
      }),
    )
  }
  return cells
}

/** Render state/virtual/detail switching around the extracted row renderer. */
export function renderTableBodyContent(ctx: TableBodyContentContext): TableBodyContentResult {
  const stateNode = renderTableStateRow({
    error: ctx.tableError,
    loading: ctx.tableLoading,
    rowCount: ctx.bodyData.length,
    stateRowStyle: {
      padding: '32px 12px',
      textAlign: 'center',
      color: 'var(--iris-muted)',
    },
    errorContent: ctx.slots.error ? ctx.slots.error() : ctx.t('table.error'),
    loadingContent: ctx.slots.loading ? ctx.slots.loading() : ctx.t('table.loading'),
    emptyContent: ctx.slots.empty ? ctx.slots.empty() : ctx.t('table.empty'),
    retry: ctx.retry,
    onRetry: ctx.props.onRetry,
    retryLabel: ctx.t('table.retry'),
  })

  let bodyNode: VNode
  if (stateNode) {
    bodyNode = stateNode
  } else if (ctx.props.virtualScroll && (!ctx.treeMode || !ctx.showDetail)) {
    bodyNode = h(
      IrisVirtualScroll,
      {
        items: ctx.bodyData,
        itemHeight: ctx.props.virtualScroll.itemHeight,
        height: ctx.props.virtualScroll.height,
        buffer: ctx.props.virtualScroll.buffer,
        'data-iris-table-body': '',
        style: { width: '100%' },
      },
      {
        item: ({ item, index }: { item: TableRow; index: number }) =>
          renderTableBodyRow(ctx, item, index, undefined, ctx.flatTree?.[index]),
      },
    )
  } else {
    const bodyChildren: VNode[] = []
    ctx.bodyData.forEach((row, index) => {
      bodyChildren.push(renderTableBodyRow(ctx, row, index, undefined, ctx.flatTree?.[index]))
      if (ctx.showDetail && ctx.isRowExpandable(row, index)) {
        const id = ctx.rowId(row, index)
        if (ctx.expandedKeys.includes(String(id))) {
          bodyChildren.push(
            h(
              'div',
              {
                key: `${String(id)}::detail`,
                role: 'row',
                'data-iris-table-row-detail': String(id),
                style: {
                  display: 'grid',
                  gridTemplateColumns: ctx.gridTemplate,
                },
              },
              [
                h(
                  'div',
                  {
                    role: 'cell',
                    'data-iris-table-detail-cell': '',
                    style: {
                      gridColumn: '1 / -1',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--iris-border)',
                    },
                  },
                  [ctx.props.renderDetail!(row, index)],
                ),
              ],
            ),
          )
        }
      }
    })
    bodyNode = h(
      'div',
      {
        role: 'rowgroup',
        'data-iris-table-body': '',
      },
      bodyChildren,
    )
  }

  const summaryRow =
    !ctx.tableError && !ctx.tableLoading
      ? renderTableSummaryRow({
          bodyData: ctx.bodyData,
          leafColumns: ctx.leafColumns,
          visibleColSet: ctx.visibleColSet,
          gridTemplate: ctx.gridTemplate,
          leadingCells: leadSummaryCells(ctx),
          columnFadeAttr: ctx.columnFadeAttr,
          columnFadeStyle: ctx.columnFadeStyle,
          colTrack: ctx.colTrack,
          getCellValue: ctx.getCellValue,
          pinOf: ctx.pinOf,
          pinnedStyle: ctx.pinnedStyle,
        })
      : null

  return { bodyNode, summaryRow }
}
