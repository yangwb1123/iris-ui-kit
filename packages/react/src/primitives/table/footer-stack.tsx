import * as React from 'react'
import type {
  IrisTableFooterMethodParams,
  IrisTableFooterSpanMethod,
  IrisTableColumn,
  IrisTableMergeFooterItem,
} from './types'
import { justifyFor } from './cell-helpers'
import type { FooterCellSpanState } from './summary-row'

export interface TableFooterStackProps<Row extends Record<string, unknown>> {
  tableError: boolean
  tableLoading: boolean
  footerSpanMethod?: IrisTableFooterSpanMethod<Row>
  footerMethod?: (params: IrisTableFooterMethodParams<Row>) => Row[]
  footerData?: Row[]
  bodyData: Row[]
  leafColumns: IrisTableColumn<Row>[]
  rowKey: string
  summaryRowStyle: 'default' | 'sticky'
  gridTemplateColumns: string
  borderStyle: string
  selectable: 'none' | 'single' | 'multi'
  visibleColSet: Set<number> | null
  baseCellStyle: React.CSSProperties
  cellOverflowOverride: React.CSSProperties
  showFooterOverflow: boolean
  footerAlign?: IrisTableColumn<Row>['align']
  footerCellClassName?: (column: IrisTableColumn<Row>, rowIndex: number) => string
  footerCellStyle?: (column: IrisTableColumn<Row>, rowIndex: number) => React.CSSProperties
  footerTooltip: (column: IrisTableColumn<Row>) => string | undefined
  colTrack: (columnIndex: number) => number
  footerCellSpan: (rowIndex: number, columnIndex: number) => FooterCellSpanState
  footerOccupy: React.MutableRefObject<Set<string>>
  getCellValue: (row: Row, column: IrisTableColumn<Row>) => unknown
  renderSummaryRow: (
    rows: Row[],
    groupKey?: string,
    extraStyle?: React.CSSProperties,
    footerRowIndex?: number,
  ) => React.ReactElement
}

export interface FooterCellSpanOptions<Row extends Record<string, unknown>> {
  mergeFooterItems?: IrisTableMergeFooterItem[]
  footerSpanMethod?: IrisTableFooterSpanMethod<Row>
  leafColumns: IrisTableColumn<Row>[]
  bodyData: Row[]
  footerOccupy: React.MutableRefObject<Set<string>>
}

/** Keep declarative footer merges and callback-driven spans on one pure bridge. */
export function useFooterCellSpan<Row extends Record<string, unknown>>({
  mergeFooterItems,
  footerSpanMethod,
  leafColumns,
  bodyData,
  footerOccupy,
}: FooterCellSpanOptions<Row>): (rowIndex: number, columnIndex: number) => FooterCellSpanState {
  const footerMergePlan = React.useMemo(() => {
    if (footerSpanMethod || !mergeFooterItems || mergeFooterItems.length === 0) return null
    const byCell = new Map<string, { colspan?: number }>()
    const occupied = new Set<string>()
    for (const item of mergeFooterItems) {
      if (item.row < 0 || item.col < 0) continue
      const key = `${item.row}:${item.col}`
      if (byCell.has(key)) continue
      byCell.set(key, { colspan: item.colspan })
      for (let column = 1; column < (item.colspan ?? 1); column += 1) {
        occupied.add(`${item.row}:${item.col + column}`)
      }
    }
    return { byCell, occupied }
  }, [mergeFooterItems, footerSpanMethod])

  return React.useCallback(
    (rowIndex: number, columnIndex: number): FooterCellSpanState => {
      if (footerSpanMethod && footerOccupy.current.has(`${rowIndex}:${columnIndex}`)) {
        return { skipped: true, colspan: 1, spanStyle: null }
      }
      if (footerMergePlan?.occupied.has(`${rowIndex}:${columnIndex}`)) {
        return { skipped: true, colspan: 1, spanStyle: null }
      }
      const span = footerSpanMethod
        ? footerSpanMethod({ rowIndex, columnIndex, columns: leafColumns, data: bodyData })
        : null
      const mergeSpan = footerMergePlan?.byCell.get(`${rowIndex}:${columnIndex}`)
      const colspan = footerSpanMethod ? (span?.colspan ?? 1) : (mergeSpan?.colspan ?? 1)
      if (footerSpanMethod && colspan > 1) {
        for (let column = 1; column < colspan; column += 1) {
          footerOccupy.current.add(`${rowIndex}:${columnIndex + column}`)
        }
      }
      const spanStyle = footerSpanMethod
        ? colspan > 1
          ? { gridColumnEnd: `span ${colspan}` }
          : null
        : mergeSpan && mergeSpan.colspan && mergeSpan.colspan > 1
          ? { gridColumnEnd: `span ${mergeSpan.colspan}` }
          : null
      return { skipped: false, colspan, spanStyle }
    },
    [bodyData, footerMergePlan, footerOccupy, footerSpanMethod, leafColumns],
  )
}

/** Render the ordered footer-method, summary, and footer-data stack. */
export function TableFooterStack<Row extends Record<string, unknown>>({
  tableError,
  tableLoading,
  footerSpanMethod,
  footerMethod,
  footerData,
  bodyData,
  leafColumns,
  rowKey,
  summaryRowStyle,
  gridTemplateColumns,
  borderStyle,
  selectable,
  visibleColSet,
  baseCellStyle,
  cellOverflowOverride,
  showFooterOverflow,
  footerAlign,
  footerCellClassName,
  footerCellStyle,
  footerTooltip,
  colTrack,
  footerCellSpan,
  footerOccupy,
  getCellValue,
  renderSummaryRow,
}: TableFooterStackProps<Row>): React.ReactNode {
  if (tableError || tableLoading) return null
  if (footerSpanMethod) footerOccupy.current.clear()
  const nodes: React.ReactNode[] = []
  let footerRowIndex = 0

  if (bodyData.length > 0) {
    const methodRows = footerMethod ? footerMethod({ columns: leafColumns, data: bodyData }) : null
    if (methodRows) {
      for (const footerRow of methodRows) {
        const rowIndex = footerRowIndex
        footerRowIndex += 1
        nodes.push(
          <div
            key={String((footerRow as Record<string, unknown>)[rowKey] ?? rowIndex)}
            role="row"
            data-iris-table-row="summary"
            data-iris-table-footer-method-row={String(rowIndex)}
            data-iris-summary-sticky={summaryRowStyle === 'sticky' ? 'true' : undefined}
            style={{
              display: 'grid',
              gridTemplateColumns,
              fontWeight: 600,
              borderTop: rowIndex === 0 ? '2px solid var(--iris-border)' : borderStyle,
              background: 'var(--iris-surface)',
            }}
          >
            {selectable !== 'none' ? (
              <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
            ) : null}
            {leafColumns.map((column, columnIndex) => {
              if (visibleColSet && !visibleColSet.has(columnIndex)) return null
              const spanState = footerCellSpan(rowIndex, columnIndex)
              if (spanState.skipped) return null
              const value = getCellValue(footerRow, column)
              return (
                <div
                  key={column.key}
                  role="cell"
                  data-iris-table-cell={column.key}
                  data-iris-table-footer-method-cell=""
                  className={footerCellClassName?.(column, rowIndex)}
                  title={footerTooltip(column)}
                  style={{
                    ...baseCellStyle,
                    ...(showFooterOverflow ? null : cellOverflowOverride),
                    ...(spanState.spanStyle ?? null),
                    justifyContent: justifyFor(footerAlign ?? column.align),
                    ...(visibleColSet ? { gridColumnStart: colTrack(columnIndex) } : null),
                    ...(footerCellStyle?.(column, rowIndex) ?? null),
                  }}
                >
                  {String(value ?? '')}
                </div>
              )
            })}
          </div>,
        )
      }
    } else if (leafColumns.some((column) => column.summary)) {
      const rowIndex = footerRowIndex
      footerRowIndex += 1
      nodes.push(
        <React.Fragment key={`summary:${rowIndex}`}>
          {renderSummaryRow(bodyData, undefined, undefined, rowIndex)}
        </React.Fragment>,
      )
    }
  }

  if (footerData && footerData.length > 0) {
    nodes.push(
      <div key="iris-table-footer-data" data-iris-table-footer="" style={{ display: 'contents' }}>
        {footerData.map((footerRow, dataIndex) => {
          const rowIndex = footerRowIndex
          footerRowIndex += 1
          return (
            <div
              key={String((footerRow as Record<string, unknown>)[rowKey] ?? dataIndex)}
              role="row"
              data-iris-table-row={`footer-${dataIndex}`}
              style={{
                display: 'grid',
                gridTemplateColumns,
                fontWeight: 600,
                background: 'var(--iris-surface)',
              }}
            >
              {selectable !== 'none' ? (
                <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
              ) : null}
              {leafColumns.map((column, columnIndex) => {
                if (visibleColSet && !visibleColSet.has(columnIndex)) return null
                const spanState = footerCellSpan(rowIndex, columnIndex)
                if (spanState.skipped) return null
                const value = getCellValue(footerRow, column)
                return (
                  <div
                    key={column.key}
                    role="cell"
                    data-iris-table-cell={column.key}
                    data-iris-table-footer-cell=""
                    className={footerCellClassName?.(column, dataIndex)}
                    title={footerTooltip(column)}
                    style={{
                      ...baseCellStyle,
                      ...(showFooterOverflow ? null : cellOverflowOverride),
                      ...(spanState.spanStyle ?? null),
                      justifyContent: justifyFor(
                        footerAlign ??
                          column.align ??
                          (typeof value === 'number' ? 'right' : 'left'),
                      ),
                      ...(visibleColSet ? { gridColumnStart: colTrack(columnIndex) } : null),
                      ...(footerCellStyle?.(column, dataIndex) ?? null),
                    }}
                  >
                    {String(value ?? '')}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>,
    )
  }

  return nodes.length > 0 ? nodes : null
}
