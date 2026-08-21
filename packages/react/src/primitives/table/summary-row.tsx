import * as React from 'react'
import { aggregate } from '@iris-ui-kit/core'
import { justifyFor } from './cell-helpers'
import { summaryStickyAttr } from './interaction-helpers'
import type { IrisTableAlign, IrisTableColumn } from './types'

export interface FooterCellSpanState {
  skipped: boolean
  colspan: number
  spanStyle: React.CSSProperties | null
}

export interface TableSummaryRowProps<Row extends Record<string, unknown>> {
  rows: Row[]
  groupKey?: string
  extraStyle?: React.CSSProperties
  footerRowIndex?: number
  gridTemplateColumns: string
  summarySticky: boolean
  rowDrag: boolean
  showRowNumbers: boolean
  seq: boolean
  hasDetail: boolean
  selectable: 'none' | 'single' | 'multi'
  leafColumns: IrisTableColumn<Row>[]
  visibleColSet: Set<number> | null
  baseCellStyle: React.CSSProperties
  cellOverflowOverride: React.CSSProperties
  showFooterOverflow: boolean
  footerAlign?: IrisTableAlign
  aggregateAccuracy?: number
  colTrack: (index: number) => number
  pinnedStyle: (key: string) => React.CSSProperties | null
  footerTooltip: (column: IrisTableColumn<Row>) => string | undefined
  footerCellSpan: (rowIndex: number, columnIndex: number) => FooterCellSpanState
  getCellValue: (row: Row, column: IrisTableColumn<Row>) => unknown
}

/** Render one global or group summary row, including footer span handling. */
export function TableSummaryRow<Row extends Record<string, unknown>>({
  rows,
  groupKey,
  extraStyle,
  footerRowIndex,
  gridTemplateColumns,
  summarySticky,
  rowDrag,
  showRowNumbers,
  seq,
  hasDetail,
  selectable,
  leafColumns,
  visibleColSet,
  baseCellStyle,
  cellOverflowOverride,
  showFooterOverflow,
  footerAlign,
  aggregateAccuracy,
  colTrack,
  pinnedStyle,
  footerTooltip,
  footerCellSpan,
  getCellValue,
}: TableSummaryRowProps<Row>): React.ReactElement {
  return (
    <div
      role="row"
      data-iris-table-row="summary"
      data-iris-group-summary={groupKey !== undefined ? groupKey : undefined}
      data-iris-summary-sticky={summaryStickyAttr(summarySticky)}
      style={{
        display: 'grid',
        gridTemplateColumns,
        fontWeight: 600,
        borderTop: '2px solid var(--iris-border)',
        background: 'var(--iris-surface)',
        ...extraStyle,
      }}
    >
      {rowDrag ? <div role="cell" data-iris-summary-track="__drag" style={baseCellStyle} /> : null}
      {showRowNumbers ? (
        <div
          role="cell"
          data-iris-summary-track={seq ? '__seq' : '__row-ref'}
          style={baseCellStyle}
        />
      ) : null}
      {hasDetail ? <div role="cell" data-iris-table-cell="__expand" style={baseCellStyle} /> : null}
      {selectable !== 'none' ? (
        <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
      ) : null}
      {leafColumns.map((column, columnIndex) => {
        if (visibleColSet && !visibleColSet.has(columnIndex)) return null
        const spanState =
          footerRowIndex === undefined ? null : footerCellSpan(footerRowIndex, columnIndex)
        if (spanState?.skipped) return null
        const operation = column.summary
        const rawValue = operation
          ? aggregate(rows, (row) => getCellValue(row, column), operation)
          : null
        const accuracy =
          aggregateAccuracy !== undefined && aggregateAccuracy >= 0 && aggregateAccuracy <= 100
            ? aggregateAccuracy
            : undefined
        const value =
          rawValue != null && accuracy !== undefined && Number.isFinite(rawValue)
            ? Number(rawValue.toFixed(accuracy))
            : rawValue
        return (
          <div
            key={column.key}
            role="cell"
            data-iris-table-cell={column.key}
            data-iris-table-summary-cell={operation ? '' : undefined}
            title={footerTooltip(column)}
            style={{
              ...baseCellStyle,
              ...(showFooterOverflow ? null : cellOverflowOverride),
              ...(spanState?.spanStyle ?? null),
              justifyContent: justifyFor(footerAlign ?? column.align),
              ...(visibleColSet ? { gridColumnStart: colTrack(columnIndex) } : null),
              ...pinnedStyle(column.key),
            }}
          >
            {operation != null && value != null
              ? column.renderSummary
                ? column.renderSummary(value, rows)
                : String(value)
              : null}
          </div>
        )
      })}
    </div>
  )
}
