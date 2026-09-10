import { applyTableMask, tableDisplayText, type I18n, type TreeRow } from '@iris-ui-kit/core'
import { For, Show, type Accessor, type JSX } from 'solid-js'
import type { IrisTableProps } from './props'
import { applySearchHighlight } from './search-highlight'
import type { RowCellSession } from './table-row-edit'
import { TableCellEditorContent, TableRowSessionEditorContent } from './table-edit-renderers'
import type { TableColumnFadeController } from './table-column-fade'
import { TableTreeIndent } from './table-tree-indent'
import type { IrisTableColumn } from './types'
import { isEditableColumn } from './utils'

type TableRow = Record<string, unknown>
type TableRowKey = string | number
type Translate = I18n['t']
type FocusedCell = { row: number; col: number } | null

interface TableBodyRowState<Row extends TableRow> {
  selectable: 'none' | 'single' | 'multi'
  striped: boolean
  rowDrag?: IrisTableProps<Row>['rowDrag']
  seq: boolean
  keyboardNavigation: boolean
  cellRange: boolean
  contextMenu?: IrisTableProps<Row>['contextMenu']
  pattern?: IrisTableProps<Row>['pattern']
  patternFill?: IrisTableProps<Row>['patternFill']
  searchHighlight?: IrisTableProps<Row>['searchHighlight']
  editConfig?: IrisTableProps<Row>['editConfig']
  editPreview?: IrisTableProps<Row>['editPreview']
  onRowClick?: IrisTableProps<Row>['onRowClick']
}

interface TableBodyRowEditing<Row extends TableRow> {
  rowEditing: Accessor<{ k: TableRowKey; idx: number } | null>
  rowSessions: Accessor<ReadonlyMap<string, RowCellSession<Row>>>
  rowEditorRefs: Map<string, HTMLInputElement>
  cellId: Accessor<string | null>
  columnKey: Accessor<string | null>
  draft: Accessor<string>
  error: Accessor<string | null>
  setCellDraft: (value: string) => void
  beginEdit: (row: Row, column: IrisTableColumn<Row>, rowId: TableRowKey) => void
  commitEdit: (row: Row, column: IrisTableColumn<Row>, rowIndex: number) => void
  cancelEdit: () => void
  editPreviewText: (row: Row, column: IrisTableColumn<Row>, draft: string) => string
  handleRowCellClick: (
    row: Row,
    column: IrisTableColumn<Row>,
    rowIndex: number,
    rowId: TableRowKey,
  ) => void
  switchRowEdit: (row: Row, rowIndex: number, focusColKey?: string) => void
  commitRowSession: (session: RowCellSession<Row>, row: Row, key: TableRowKey) => boolean
  cancelRowEdit: () => void
  handleRowTab: (
    row: Row,
    column: IrisTableColumn<Row>,
    session: RowCellSession<Row>,
    rowId: TableRowKey,
    dir: 1 | -1,
  ) => void
}

export interface TableBodyRowRendererOptions<Row extends TableRow> {
  t: Translate
  table: TableBodyRowState<Row>
  live: {
    rowId: (row: Row, index: number) => TableRowKey
    resolveRow: (id: TableRowKey, fallback: Row) => Row
  }
  gridTemplate: Accessor<string>
  hasDetail: Accessor<boolean>
  leafColumns: Accessor<IrisTableColumn<Row>[]>
  rowMode: Accessor<boolean>
  beforeRender: () => void
  selection: {
    isSelected: (id: TableRowKey) => boolean
    toggleRow: (id: TableRowKey) => void
  }
  expansion: {
    keys: Accessor<string[]>
    toggle: (key: string) => void
    isRowExpandable: (row: Row, index: number) => boolean
  }
  drag: {
    active: Accessor<string | null>
    over: Accessor<string | null>
    onPointerDown: (event: PointerEvent, id: string) => void
  }
  focus: {
    focusedCell: Accessor<FocusedCell>
    setFocusedCell: (cell: Exclude<FocusedCell, null>) => void
  }
  range: {
    isInRange: (row: number, column: number) => boolean
    start: (row: number, column: number) => void
    extend: (row: number, column: number) => void
  }
  cells: {
    visibleColSet: Accessor<Set<number> | null>
    resolveValue: (row: Row, column: IrisTableColumn<Row>) => unknown
    resolveColspan: (rowIndex: number, columnIndex: number, inWindow: boolean) => number | null
    colTrack: (index: number) => number
    pinOf: (column: IrisTableColumn<Row>) => 'left' | 'right' | null
    pinnedStyle: (key: string) => JSX.CSSProperties | null
    columnFade: TableColumnFadeController<Row>
  }
  tree: {
    lazy: Accessor<boolean>
    hasLoadedChildren: (row: Row) => boolean
    loading: Accessor<Set<string>>
    loadChildren: (row: Row, treeMeta: TreeRow<Row>) => void
  }
  editing: TableBodyRowEditing<Row>
  seqValue: (index: number) => string | number
  onContextMenu: (
    event: MouseEvent,
    row: Row,
    column: IrisTableColumn<Row>,
    rowIndex: number,
    columnIndex: number,
  ) => void
}

/** Body-row renderer extracted from IrisTable.tsx; state stays in the parent. */
export function createTableBodyRowRenderer<Row extends TableRow>(
  options: TableBodyRowRendererOptions<Row>,
): (row: Row, index: number, treeMeta: TreeRow<Row> | null) => JSX.Element {
  return (row: Row, index: number, treeMeta: TreeRow<Row> | null): JSX.Element => {
    const id = options.live.rowId(row, index)
    const liveRow = (): Row => options.live.resolveRow(id, row)
    options.beforeRender()
    const selected = (): boolean => options.selection.isSelected(id)
    const expanded = (): boolean => options.expansion.keys().includes(String(id))
    const expandable = (): boolean => options.expansion.isRowExpandable(row, index)

    return (
      <div
        role="row"
        aria-selected={options.table.selectable !== 'none' ? selected() : undefined}
        data-iris-table-row=""
        data-iris-table-row-key={String(id)}
        data-iris-row-editing={
          options.rowMode() && options.editing.rowEditing()?.k === id ? 'true' : undefined
        }
        data-state={selected() ? 'selected' : undefined}
        aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
        aria-setsize={treeMeta ? treeMeta.setSize : undefined}
        aria-posinset={treeMeta ? treeMeta.posInset : undefined}
        onClick={() => options.table.onRowClick?.(row, index)}
        style={{
          display: 'grid',
          'grid-template-columns': options.gridTemplate(),
          background: selected()
            ? 'var(--iris-surface-selected)'
            : options.table.striped && index % 2 === 1
              ? 'var(--iris-surface)'
              : 'var(--iris-row-bg, transparent)',
          transition: options.cells.columnFade.columnFadeActive()
            ? 'background-color 120ms ease, grid-template-columns var(--iris-duration-md, 200ms) ease'
            : 'background-color 120ms ease',
          cursor: 'default',
        }}
      >
        <Show when={options.table.rowDrag}>
          <div
            role="cell"
            data-iris-table-cell="__drag"
            data-iris-row-drag-handle={String(id)}
            data-iris-row-drag-active={options.drag.active() === String(id) ? 'true' : undefined}
            data-iris-row-drag-over={options.drag.over() === String(id) ? 'true' : undefined}
            onPointerDown={(event: PointerEvent) => options.drag.onPointerDown(event, String(id))}
            onClick={(event) => event.stopPropagation()}
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
              cursor: 'grab',
              color: 'var(--iris-muted)',
              background:
                options.drag.active() === String(id)
                  ? 'var(--iris-surface-hover)'
                  : options.drag.over() === String(id)
                    ? 'var(--iris-surface-selected)'
                    : 'transparent',
            }}
          >
            <span aria-hidden="true" style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}>
              ⠿
            </span>
          </div>
        </Show>
        <Show when={options.table.seq}>
          <div
            role="cell"
            data-iris-table-cell="__seq"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
              color: 'var(--iris-muted)',
              'user-select': 'none',
            }}
          >
            {options.seqValue(index)}
          </div>
        </Show>
        <Show when={options.hasDetail()}>
          <div
            role="cell"
            data-iris-table-cell="__expand"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <Show when={expandable()}>
              <button
                type="button"
                data-iris-table-expand-toggle=""
                aria-expanded={expanded()}
                aria-label={options.t(expanded() ? 'treeSelect.collapse' : 'treeSelect.expand')}
                onClick={(event) => {
                  event.stopPropagation()
                  options.expansion.toggle(String(id))
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '0',
                  font: 'inherit',
                  color: 'var(--iris-foreground)',
                  transform: expanded() ? 'rotate(90deg)' : 'none',
                  transition: 'transform 150ms',
                }}
              >
                ▶
              </button>
            </Show>
          </div>
        </Show>
        <Show when={options.table.selectable !== 'none'}>
          <div
            role="cell"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <input
              type="checkbox"
              checked={selected()}
              onChange={() => options.selection.toggleRow(id)}
              onClick={(event) => event.stopPropagation()}
              aria-label={options.t('table.selectRow', { key: index + 1 })}
            />
          </div>
        </Show>
        <For each={options.leafColumns()}>
          {(col, colIndexAccessor) => {
            const cid = `${id}::${col.key}`
            const rowSession = (): RowCellSession<Row> | undefined =>
              options.rowMode() ? options.editing.rowSessions().get(cid) : undefined
            const isEditing = (): boolean =>
              options.rowMode() ? rowSession() !== undefined : options.editing.cellId() === cid
            const isFirstCol = colIndexAccessor() === 0
            const colIndex = colIndexAccessor()
            const isFocused = (): boolean => {
              const fc = options.focus.focusedCell()
              return fc ? fc.row === index && fc.col === colIndex : index === 0 && colIndex === 0
            }
            const inWindow = (): boolean => {
              const set = options.cells.visibleColSet()
              return !set || set.has(colIndex)
            }
            const patternHint = (): boolean =>
              Boolean(options.table.pattern || options.table.patternFill) &&
              !options.rowMode() &&
              options.editing.columnKey() === col.key &&
              !isEditing() &&
              options.editing.draft() !== '' &&
              String(options.cells.resolveValue(liveRow(), col) ?? '') === options.editing.draft()
            const displayText = (): string =>
              tableDisplayText<Row>(liveRow(), col, options.cells.resolveValue)
            const displayNode = (): JSX.Element => {
              if (!options.table.searchHighlight) return displayText()
              const rowValue = liveRow()
              const masked = applyTableMask(options.cells.resolveValue(rowValue, col), col)
              const finalNode = col.formatter ? col.formatter(masked, rowValue) : masked
              return applySearchHighlight(finalNode, options.table.searchHighlight)
            }
            const colspan = options.cells.resolveColspan(index, colIndex, inWindow())
            if (colspan === null) return <></>
            return (
              <Show when={inWindow()}>
                <div
                  role="cell"
                  data-iris-table-cell={col.key}
                  data-iris-table-pinned={options.cells.pinOf(col)}
                  {...options.cells.columnFade.columnFadeAttrs(col)}
                  data-editable={isEditableColumn(col) ? '' : undefined}
                  data-editing={isEditing() ? '' : undefined}
                  data-iris-input-hint={patternHint() ? 'true' : undefined}
                  data-grid-row={options.table.keyboardNavigation ? index : undefined}
                  data-grid-col={options.table.keyboardNavigation ? colIndex : undefined}
                  data-iris-cell-row={options.table.cellRange ? index : undefined}
                  data-iris-cell-col={options.table.cellRange ? colIndex : undefined}
                  data-iris-cell-selected={
                    options.table.cellRange && options.range.isInRange(index, colIndex)
                      ? 'true'
                      : undefined
                  }
                  tabindex={options.table.keyboardNavigation ? (isFocused() ? 0 : -1) : undefined}
                  onFocus={
                    options.table.keyboardNavigation
                      ? () => {
                          options.cells.columnFade.rememberFocus(index, colIndex)
                          options.focus.setFocusedCell({ row: index, col: colIndex })
                        }
                      : undefined
                  }
                  onClick={
                    options.rowMode()
                      ? () => options.editing.handleRowCellClick(row, col, index, id)
                      : options.table.cellRange
                        ? (event: MouseEvent) => {
                            if (event.shiftKey) {
                              options.range.extend(index, colIndex)
                            } else {
                              options.range.start(index, colIndex)
                            }
                          }
                        : isEditableColumn(col) && options.table.editConfig?.trigger === 'click'
                          ? () => options.editing.beginEdit(row, col, id)
                          : undefined
                  }
                  onDblClick={
                    options.rowMode()
                      ? () => options.editing.switchRowEdit(row, index, col.key)
                      : isEditableColumn(col)
                        ? () => options.editing.beginEdit(row, col, id)
                        : undefined
                  }
                  onContextMenu={
                    options.table.contextMenu
                      ? (event: MouseEvent) =>
                          options.onContextMenu(event, row, col, index, colIndex)
                      : undefined
                  }
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content':
                      (col.align ??
                        (typeof options.cells.resolveValue(liveRow(), col) === 'number'
                          ? 'right'
                          : 'left')) === 'right'
                        ? 'flex-end'
                        : col.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    padding: isEditing() ? '4px' : '8px var(--iris-padding-md)',
                    'flex-wrap': isEditing() ? 'wrap' : undefined,
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-size': 'var(--iris-font-size-md, 14px)',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    cursor: isEditableColumn(col) ? 'cell' : 'default',
                    background:
                      options.table.cellRange && options.range.isInRange(index, colIndex)
                        ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                        : undefined,
                    'background-image': patternHint()
                      ? 'linear-gradient(var(--iris-input-hint, rgba(251, 191, 36, 0.16)), var(--iris-input-hint, rgba(251, 191, 36, 0.16)))'
                      : undefined,
                    ...(options.cells.visibleColSet()
                      ? { 'grid-column-start': String(options.cells.colTrack(colIndex)) }
                      : {}),
                    ...(colspan > 1 ? { 'grid-column-end': `span ${colspan}` } : {}),
                    ...(options.cells.columnFade.columnFadeStyle(col) ?? {}),
                    ...(options.cells.pinnedStyle(col.key) ?? {}),
                  }}
                >
                  <Show when={treeMeta && isFirstCol}>
                    <TableTreeIndent
                      row={row}
                      treeMeta={treeMeta!}
                      t={options.t}
                      expandedKeys={options.expansion.keys}
                      toggle={options.expansion.toggle}
                      lazy={options.tree.lazy}
                      hasLoadedChildren={options.tree.hasLoadedChildren}
                      loading={options.tree.loading}
                      loadChildren={options.tree.loadChildren}
                    />
                  </Show>
                  <Show
                    when={isEditing()}
                    fallback={
                      <Show when={col.renderCell} fallback={displayNode()}>
                        {col.renderCell!(liveRow(), index)}
                      </Show>
                    }
                  >
                    <Show
                      when={rowSession()}
                      keyed
                      fallback={
                        <TableCellEditorContent
                          row={row}
                          column={col}
                          rowIndex={index}
                          cellId={cid}
                          editingDraft={options.editing.draft}
                          editError={options.editing.error}
                          setCellDraft={options.editing.setCellDraft}
                          commitEdit={options.editing.commitEdit}
                          cancelEdit={options.editing.cancelEdit}
                          editPreview={options.table.editPreview}
                          editPreviewText={options.editing.editPreviewText}
                        />
                      }
                    >
                      {(session) => (
                        <TableRowSessionEditorContent
                          row={row}
                          rowKey={id}
                          column={col}
                          cellId={cid}
                          session={session}
                          rowEditorRefs={options.editing.rowEditorRefs}
                          commitRowSession={options.editing.commitRowSession}
                          cancelRowEdit={options.editing.cancelRowEdit}
                          handleRowTab={options.editing.handleRowTab}
                          editPreview={options.table.editPreview}
                          editPreviewText={options.editing.editPreviewText}
                        />
                      )}
                    </Show>
                  </Show>
                </div>
              </Show>
            )
          }}
        </For>
      </div>
    )
  }
}
