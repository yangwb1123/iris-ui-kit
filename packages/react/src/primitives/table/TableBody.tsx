import * as React from 'react'
import { aggregate, type TreeRow } from '@iris-ui-kit/core'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import { TableRow } from './TableRow'
import { BASE_CELL_STYLE, borderStyle, STATE_ROW_STYLE } from './styles'
import type { IrisTableColumn, IrisTableColumnWidths, IrisTableVirtualOptions } from './types'

interface TableBodyProps<Row extends Record<string, unknown>> {
  bodyData: Row[]
  leafColumns: IrisTableColumn<Row>[]
  flatTree: Array<TreeRow<Row>> | null
  error: boolean
  loading: boolean
  bordered: boolean
  t: (key: string, params?: Record<string, string | number>) => string
  emptyState: React.ReactNode
  loadingState: React.ReactNode
  errorState: React.ReactNode
  renderDetail?: (row: Row, rowIndex: number) => React.ReactNode
  virtualScroll?: IrisTableVirtualOptions
  treeMode: boolean
  hasDetail: boolean
  gridTemplateColumns: string
  visibleColSet: Set<number> | null
  colTrack: (i: number) => number
  pinnedStyle: (key: string) => React.CSSProperties | null
  rowKeyOf: (row: Row) => string | number
  selectable: 'none' | 'single' | 'multi'
  displaySelection: Array<string | number>
  toggleRow: (row: Row) => void
  isRowExpandable: (row: Row, idx: number) => boolean
  expansion: { toggle: (key: string) => void }
  expandedKeys: string[]
  columnWidths: IrisTableColumnWidths
  striped: boolean
  keyboardNavigation: boolean
  focusedCell: { row: number; col: number } | null
  setFocusedCell: (cell: { row: number; col: number } | null) => void
  cellRange: boolean
  cellRangeCtrl: {
    startRange: (row: number, col: number) => void
    extendRange: (row: number, col: number) => void
  }
  isInRange: (row: number, col: number) => boolean
  editingCellId: string | null
  editingDraft: string
  editError: string | null
  editorRef: React.RefObject<HTMLInputElement>
  cellId: (rowIdent: string | number, colKey: string) => string
  beginEdit: (row: Row, col: IrisTableColumn<Row>, rowIdent: string | number) => void
  cancelEdit: () => void
  commitEdit: (row: Row, col: IrisTableColumn<Row>, rowIndex: number) => void
  setDraft: (value: string) => void
}

export function TableBody<Row extends Record<string, unknown>>({
  bodyData,
  leafColumns,
  flatTree,
  error,
  loading,
  bordered,
  t,
  emptyState,
  loadingState,
  errorState,
  renderDetail,
  virtualScroll,
  treeMode,
  hasDetail,
  gridTemplateColumns,
  visibleColSet,
  colTrack,
  pinnedStyle,
  rowKeyOf,
  selectable,
  displaySelection,
  toggleRow,
  isRowExpandable,
  expansion,
  expandedKeys,
  columnWidths,
  striped,
  keyboardNavigation,
  focusedCell,
  setFocusedCell,
  cellRange,
  cellRangeCtrl,
  isInRange,
  editingCellId,
  editingDraft,
  editError,
  editorRef,
  cellId,
  beginEdit,
  cancelEdit,
  commitEdit,
  setDraft,
}: TableBodyProps<Row>): React.ReactElement {
  const bs = borderStyle(bordered)

  if (error) {
    return (
      <div role="row" data-iris-table-row="error" style={STATE_ROW_STYLE}>
        {errorState ?? t('table.error')}
      </div>
    )
  }
  if (loading) {
    return (
      <div role="row" aria-busy="true" data-iris-table-row="loading" style={STATE_ROW_STYLE}>
        {loadingState ?? t('table.loading')}
      </div>
    )
  }
  if (bodyData.length === 0) {
    return (
      <div role="row" data-iris-table-row="empty" style={STATE_ROW_STYLE}>
        {emptyState ?? t('table.empty')}
      </div>
    )
  }

  const rowProps = {
    rowKeyOf,
    selectable,
    displaySelection,
    toggleRow,
    hasDetail,
    isRowExpandable,
    expansion,
    expandedKeys,
    t,
    leafColumns,
    columnWidths,
    bordered,
    striped,
    visibleColSet,
    colTrack,
    keyboardNavigation,
    focusedCell,
    setFocusedCell,
    cellRange,
    cellRangeCtrl,
    isInRange,
    editingCellId,
    editingDraft,
    editError,
    editorRef,
    cellId,
    beginEdit,
    cancelEdit,
    commitEdit,
    setDraft,
    pinnedStyle,
  }

  if (virtualScroll && (!treeMode || !hasDetail)) {
    return (
      <IrisVirtualScroll
        items={bodyData}
        itemHeight={virtualScroll.itemHeight}
        height={virtualScroll.height}
        buffer={virtualScroll.buffer}
        keyOf={(row: Row) => rowKeyOf(row)}
        renderItem={(row: Row, idx: number) => (
          <TableRow
            {...rowProps}
            row={row}
            idx={idx}
            treeMeta={flatTree?.[idx]}
            extraStyle={{ height: '100%' }}
          />
        )}
      />
    )
  }

  return (
    <>
      {bodyData.map((row, idx) => {
        const main = <TableRow {...rowProps} row={row} idx={idx} treeMeta={flatTree?.[idx]} />
        if (
          !hasDetail ||
          !isRowExpandable(row, idx) ||
          !expandedKeys.includes(String(rowKeyOf(row)))
        ) {
          return main
        }
        return (
          <React.Fragment key={`${String(rowKeyOf(row) ?? idx)}::wrap`}>
            {main}
            <div
              role="row"
              data-iris-table-row-detail={String(rowKeyOf(row) ?? idx)}
              style={{ display: 'grid', gridTemplateColumns }}
            >
              <div
                role="cell"
                data-iris-table-detail-cell=""
                style={{ gridColumn: '1 / -1', padding: '8px 12px', borderBottom: bs }}
              >
                {renderDetail!(row, idx)}
              </div>
            </div>
          </React.Fragment>
        )
      })}

      {leafColumns.some((c) => c.summary) ? (
        <div
          role="row"
          data-iris-table-row="summary"
          style={{
            display: 'grid',
            gridTemplateColumns,
            fontWeight: 600,
            borderTop: '2px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          {selectable !== 'none' ? (
            <div role="cell" data-iris-table-cell="__selection" style={BASE_CELL_STYLE} />
          ) : null}
          {leafColumns.map((col, ci) => {
            if (visibleColSet && !visibleColSet.has(ci)) return null
            const op = col.summary
            const value = op
              ? aggregate(
                  bodyData,
                  (r) => {
                    const key = (col.dataIndex ?? col.key) as keyof Row
                    return r[key]
                  },
                  op,
                )
              : null
            return (
              <div
                key={col.key}
                role="cell"
                data-iris-table-cell={col.key}
                data-iris-table-summary-cell={op ? '' : undefined}
                style={{ ...BASE_CELL_STYLE, ...pinnedStyle(col.key) }}
              >
                {op != null && value != null
                  ? col.renderSummary
                    ? col.renderSummary(value, bodyData)
                    : String(value)
                  : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
