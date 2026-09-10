import * as React from 'react'
import type { Virtualizer, TreeRow } from '@iris-ui-kit/core'
import { IrisVirtualScroll, type IrisVirtualScrollHandle } from '../virtual-scroll/VirtualScroll'
import type { TableGroupHeaderEntry } from './group-header'
import type { IrisTableProps } from './props'
import { virtualItemKeyOf, type BodyPlanEntry } from './interaction-helpers'
import { STATE_ROW_STYLE } from './styles'

export interface TableBodyContentProps<Row extends Record<string, unknown>> {
  tableError: React.ReactNode
  retry?: () => void
  errorState?: React.ReactNode
  t: (key: string) => string
  tableLoading: boolean
  loadingState?: React.ReactNode
  emptyContent: React.ReactNode
  bodyData: Row[]
  virtualScroll?: IrisTableProps<Row>['virtualScroll']
  virtualItems: BodyPlanEntry<Row>[]
  effectiveRowHeight: number | ((index: number) => number) | 'auto' | undefined
  virtualScrollHandleRef: React.Ref<IrisVirtualScrollHandle>
  rowKeyOf: (row: Row, index?: number) => string | number
  virtualModel: Virtualizer
  handleVirtualScrollScroll: (top: number) => void
  renderGroupHeader: (
    entry: TableGroupHeaderEntry,
    extraStyle?: React.CSSProperties,
  ) => React.ReactElement
  renderSummaryRow: (
    rows: Row[],
    groupKey?: string,
    extraStyle?: React.CSSProperties,
  ) => React.ReactElement
  renderDetailSlot: (row: Row, index: number) => React.ReactElement
  renderRow: (
    row: Row,
    index: number,
    extraStyle?: React.CSSProperties,
    treeMeta?: TreeRow<Row>,
  ) => React.ReactElement
  flatTree: TreeRow<Row>[] | null
  groupPlan: BodyPlanEntry<Row>[] | null
  renderBodyEntry: (row: Row, index: number) => React.ReactNode
}

/** Presentation-only body state switch. The table supplies the already-wired
 * row renderers so this module owns no grid behavior or framework-free logic. */
export function TableBodyContent<Row extends Record<string, unknown>>({
  tableError,
  retry,
  errorState,
  t,
  tableLoading,
  loadingState,
  emptyContent,
  bodyData,
  virtualScroll,
  virtualItems,
  effectiveRowHeight,
  virtualScrollHandleRef,
  rowKeyOf,
  virtualModel,
  handleVirtualScrollScroll,
  renderGroupHeader,
  renderSummaryRow,
  renderDetailSlot,
  renderRow,
  flatTree,
  groupPlan,
  renderBodyEntry,
}: TableBodyContentProps<Row>): React.ReactElement {
  return (
    <>
      {tableError ? (
        <div role="row" data-iris-table-row="error" style={STATE_ROW_STYLE}>
          <span style={{ marginInlineEnd: retry ? 'var(--iris-space-sm, 12px)' : 0 }}>
            {errorState ?? t('table.error')}
          </span>
          {retry ? (
            <button
              type="button"
              data-iris-table-retry=""
              onClick={retry}
              style={{
                border: '1px solid var(--iris-border)',
                background: 'var(--iris-surface)',
                color: 'var(--iris-foreground)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                cursor: 'pointer',
              }}
            >
              {t('table.retry')}
            </button>
          ) : null}
        </div>
      ) : tableLoading ? (
        <div role="row" aria-busy="true" data-iris-table-row="loading" style={STATE_ROW_STYLE}>
          {loadingState ?? t('table.loading')}
        </div>
      ) : bodyData.length === 0 ? (
        <div role="row" data-iris-table-row="empty" style={STATE_ROW_STYLE}>
          {emptyContent}
        </div>
      ) : virtualScroll ? (
        <IrisVirtualScroll
          ref={virtualScrollHandleRef}
          items={virtualItems}
          itemHeight={effectiveRowHeight ?? virtualScroll.itemHeight}
          height={virtualScroll.height}
          buffer={virtualScroll.buffer}
          keyOf={(item) => virtualItemKeyOf(item, rowKeyOf)}
          virtualizer={virtualModel}
          onScroll={handleVirtualScrollScroll}
          renderItem={(item) =>
            item.kind === 'group-header'
              ? renderGroupHeader(item, { height: '100%' })
              : item.kind === 'group-summary'
                ? renderSummaryRow(item.rows, item.groupKey, { height: '100%' })
                : item.kind === 'detail'
                  ? renderDetailSlot(item.row, item.rowIndex)
                  : renderRow(
                      item.row,
                      item.rowIndex,
                      { height: '100%' },
                      flatTree?.[item.rowIndex],
                    )
          }
        />
      ) : groupPlan ? (
        groupPlan.map((entry) => {
          if (entry.kind === 'group-header') return renderGroupHeader(entry)
          if (entry.kind === 'group-summary')
            return (
              <React.Fragment key={`group-summary:${entry.groupKey}`}>
                {renderSummaryRow(entry.rows, entry.groupKey)}
              </React.Fragment>
            )
          return renderBodyEntry(entry.row, entry.rowIndex)
        })
      ) : (
        bodyData.map((row, idx) => renderBodyEntry(row, idx))
      )}
    </>
  )
}
