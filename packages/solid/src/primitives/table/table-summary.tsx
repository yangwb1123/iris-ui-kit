import { aggregate } from '@iris-ui-kit/core'
import { For, Show, type Accessor, type JSX } from 'solid-js'
import type { IrisTableColumn } from './types'

interface TableSummaryProps<Row extends Record<string, unknown>> {
  bodyRows: Accessor<Row[]>
  leafColumns: Accessor<IrisTableColumn<Row>[]>
  visibleColSet: Accessor<Set<number> | null>
  gridTemplate: Accessor<string>
  colTrack: (index: number) => number
  getCellValue: (row: Row, column: IrisTableColumn<Row>) => unknown
  rowDrag?: { onReorder: (rows: Row[]) => void }
  seq?: boolean
  hasDetail: Accessor<boolean>
  selectable: 'none' | 'single' | 'multi'
}

const spacerStyle = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  padding: '8px',
  'border-bottom': '1px solid var(--iris-border)',
}

/** Summary/footer row kept separate from the table shell to keep the adapter thin. */
export function TableSummary<Row extends Record<string, unknown>>(
  props: TableSummaryProps<Row>,
): JSX.Element {
  return (
    <Show
      when={props.bodyRows().length > 0 && props.leafColumns().some((column) => column.summary)}
    >
      <div
        role="row"
        data-iris-table-row="summary"
        style={{
          display: 'grid',
          'grid-template-columns': props.gridTemplate(),
          'font-weight': '600',
          'border-top': '2px solid var(--iris-border)',
          background: 'var(--iris-surface)',
        }}
      >
        <Show when={props.rowDrag}>
          <div role="cell" data-iris-table-cell="__drag" style={spacerStyle} />
        </Show>
        <Show when={props.seq}>
          <div role="cell" data-iris-table-cell="__seq" style={spacerStyle} />
        </Show>
        <Show when={props.hasDetail()}>
          <div role="cell" data-iris-table-cell="__expand" style={spacerStyle} />
        </Show>
        <Show when={props.selectable !== 'none'}>
          <div role="cell" data-iris-table-cell="__selection" style={spacerStyle} />
        </Show>
        <For each={props.leafColumns()}>
          {(column, colIndexAccessor) => {
            const colIndex = colIndexAccessor()
            const op = column.summary
            const value = op
              ? aggregate(props.bodyRows(), (row) => props.getCellValue(row, column), op)
              : null
            const inWindow = (): boolean => {
              const set = props.visibleColSet()
              return !set || set.has(colIndex)
            }
            return (
              <Show when={inWindow()}>
                <div
                  role="cell"
                  data-iris-table-cell={column.key}
                  data-iris-table-summary-cell={op ? '' : undefined}
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content':
                      column.align === 'right'
                        ? 'flex-end'
                        : column.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    padding: '8px var(--iris-padding-md)',
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-size': 'var(--iris-font-size-md, 14px)',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    ...(props.visibleColSet()
                      ? { 'grid-column-start': String(props.colTrack(colIndex)) }
                      : {}),
                  }}
                >
                  <Show when={op != null && value != null}>
                    <Show when={column.renderSummary} fallback={String(value)}>
                      {column.renderSummary!(value!, props.bodyRows())}
                    </Show>
                  </Show>
                </div>
              </Show>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
