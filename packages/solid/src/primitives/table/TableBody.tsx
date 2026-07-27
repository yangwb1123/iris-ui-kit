import { createMemo, For, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { aggregate, type TreeRow } from '@iris-ui-kit/core'
import { IrisVirtualScroll } from '../virtual-scroll/IrisVirtualScroll'
import { TableRow } from './TableRow'
import { BASE_CELL_STYLE, STATE_ROW_STYLE } from './styles'
import { getCellValue } from './utils'
import type { IrisTableColumn, IrisTableColumnWidths, IrisTableVirtualOptions } from './types'

interface TableBodyProps<Row extends Record<string, unknown>> {
  bodyData: () => Row[]
  leafColumns: IrisTableColumn<Row>[]
  flatTree: () => Array<TreeRow<Row>> | null
  error: boolean
  loading: boolean
  bordered: boolean
  t: (key: string, params?: Record<string, string | number>) => string
  emptyState: JSX.Element
  loadingState: JSX.Element
  errorState: JSX.Element
  renderDetail?: (row: Row, rowIndex: number) => JSX.Element
  virtualScroll?: IrisTableVirtualOptions
  treeMode: boolean
  hasDetail: boolean
  gridTemplateColumns: () => string
  visibleColSet: () => Set<number> | null
  colTrack: (i: number) => number
  pinnedStyle: (key: string) => JSX.CSSProperties | null
  rowKeyOf: (row: Row, index: number) => string | number
  onRowClick?: (row: Row, index: number) => void
  selectable: 'none' | 'single' | 'multi'
  displaySelection: () => Array<string | number>
  toggleRow: (row: Row) => void
  isRowExpandable: (row: Row, idx: number) => boolean
  expansion: { toggle: (key: string) => void }
  expandedKeys: () => string[]
  columnWidths: IrisTableColumnWidths
  striped: boolean
  keyboardNavigation: boolean
  focusedCell: () => { row: number; col: number } | null
  setFocusedCell: (cell: { row: number; col: number } | null) => void
  cellRange: boolean
  cellRangeCtrl: {
    startRange: (row: number, col: number) => void
    extendRange: (row: number, col: number) => void
  }
  isInRange: (row: number, col: number) => boolean
  editingCellId: () => string | null
  editingDraft: () => string
  editError: () => string | null
  editorRef: { ref: HTMLInputElement | undefined }
  cellId: (rowIdent: string | number, colKey: string) => string
  beginEdit: (row: Row, col: IrisTableColumn<Row>, rowIdent: string | number) => void
  cancelEdit: () => void
  commitEdit: (row: Row, col: IrisTableColumn<Row>, rowIndex: number) => void
  setDraft: (value: string) => void
}

export function TableBody<Row extends Record<string, unknown>>(
  props: TableBodyProps<Row>,
): JSX.Element {
  const bs = () => (props.bordered ? '1px solid var(--iris-border)' : 'none')

  // Error / loading / empty states
  if (props.error) {
    return (
      <div role="row" data-iris-table-row="error" style={STATE_ROW_STYLE}>
        {props.errorState ?? props.t('table.error')}
      </div>
    )
  }
  if (props.loading) {
    return (
      <div role="row" aria-busy="true" data-iris-table-row="loading" style={STATE_ROW_STYLE}>
        {props.loadingState ?? props.t('table.loading')}
      </div>
    )
  }
  const rowProps = {
    onRowClick: props.onRowClick,
    rowKeyOf: props.rowKeyOf,
    selectable: props.selectable,
    displaySelection: props.displaySelection,
    toggleRow: props.toggleRow,
    hasDetail: props.hasDetail,
    isRowExpandable: props.isRowExpandable,
    expansion: props.expansion,
    expandedKeys: props.expandedKeys,
    t: props.t,
    leafColumns: props.leafColumns,
    columnWidths: props.columnWidths,
    bordered: props.bordered,
    striped: props.striped,
    visibleColSet: props.visibleColSet,
    colTrack: props.colTrack,
    keyboardNavigation: props.keyboardNavigation,
    focusedCell: props.focusedCell,
    setFocusedCell: props.setFocusedCell,
    cellRange: props.cellRange,
    cellRangeCtrl: props.cellRangeCtrl,
    isInRange: props.isInRange,
    editingCellId: props.editingCellId,
    editingDraft: props.editingDraft,
    editError: props.editError,
    editorRef: props.editorRef,
    cellId: props.cellId,
    beginEdit: props.beginEdit,
    cancelEdit: props.cancelEdit,
    commitEdit: props.commitEdit,
    setDraft: props.setDraft,
    pinnedStyle: props.pinnedStyle,
  }

  // Virtual scroll path
  if (props.virtualScroll && (!props.treeMode || !props.hasDetail)) {
    return (
      <IrisVirtualScroll
        items={props.bodyData()}
        itemHeight={props.virtualScroll.itemHeight}
        height={props.virtualScroll.height}
        buffer={props.virtualScroll.buffer}
        keyOf={(row: Row, idx: number) => props.rowKeyOf(row, idx)}
        renderItem={(row: Row, idx: number) => (
          <TableRow
            {...rowProps}
            row={row}
            idx={idx}
            treeMeta={props.flatTree()?.[idx]}
            extraStyle={{ height: '100%' }}
          />
        )}
      />
    )
  }

  // Flat / detail path — wrap in createMemo so Solid re-renders on signal changes
  const bodyContent = createMemo(() => {
    const bd = props.bodyData()
    return bd.map((row, idx) => {
      const treeMeta = props.flatTree()?.[idx]
      const key = String(props.rowKeyOf(row, idx) ?? idx)
      const expanded = props.expandedKeys().includes(key)
      const showDetail = props.hasDetail && props.isRowExpandable(row, idx) && expanded
      return (
        <>
          <TableRow {...rowProps} row={row} idx={idx} treeMeta={treeMeta} />
          {showDetail ? (
            <div
              role="row"
              data-iris-table-row-detail={key}
              style={{ display: 'grid', 'grid-template-columns': props.gridTemplateColumns() }}
            >
              <div
                role="cell"
                data-iris-table-detail-cell=""
                style={{ 'grid-column': '1 / -1', padding: '8px 12px', 'border-bottom': bs() }}
              >
                {props.renderDetail!(row, idx)}
              </div>
            </div>
          ) : null}
        </>
      )
    })
  })

  return (
    <>
      <Show when={props.bodyData().length === 0} fallback={bodyContent()}>
        <div role="row" data-iris-table-row="empty" style={STATE_ROW_STYLE}>
          {props.emptyState ?? props.t('table.empty')}
        </div>
      </Show>

      {/* Summary / footer row */}
      <Show when={props.leafColumns.some((c) => c.summary) && props.bodyData().length > 0}>
        <div
          role="row"
          data-iris-table-row="summary"
          style={{
            display: 'grid',
            'grid-template-columns': props.gridTemplateColumns(),
            'font-weight': 600,
            'border-top': '2px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          <Show when={props.selectable !== 'none'}>
            <div role="cell" data-iris-table-cell="__selection" style={BASE_CELL_STYLE} />
          </Show>
          <For each={props.leafColumns}>
            {(col, ci) => {
              const s = props.visibleColSet()
              if (s && !s.has(ci())) return null
              const op = col.summary
              const value = op ? aggregate(props.bodyData(), (r) => getCellValue(r, col), op) : null
              return (
                <div
                  role="cell"
                  data-iris-table-cell={col.key}
                  data-iris-table-summary-cell={op ? '' : undefined}
                  style={{ ...BASE_CELL_STYLE, ...props.pinnedStyle(col.key) }}
                >
                  <Show when={op != null && value != null}>
                    {col.renderSummary
                      ? col.renderSummary(value!, props.bodyData())
                      : String(value)}
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </>
  )
}
