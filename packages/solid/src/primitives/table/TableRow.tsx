import { Show } from 'solid-js'
import type { JSX } from 'solid-js'
import type { TreeRow } from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox'
import { BASE_CELL_STYLE } from './styles'
import { getCellValue } from './utils'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

interface TableRowProps<Row extends Record<string, unknown>> {
  onRowClick?: (row: Row, index: number) => void
  row: Row
  idx: number
  rowKeyOf: (row: Row, index: number) => string | number
  selectable: 'none' | 'single' | 'multi'
  displaySelection: () => Array<string | number>
  toggleRow: (row: Row) => void
  hasDetail: boolean
  isRowExpandable: (row: Row, idx: number) => boolean
  expansion: { toggle: (key: string) => void }
  expandedKeys: () => string[]
  t: (key: string, params?: Record<string, string | number>) => string
  leafColumns: IrisTableColumn<Row>[]
  columnWidths: IrisTableColumnWidths
  bordered: boolean
  striped: boolean
  visibleColSet: () => Set<number> | null
  colTrack: (i: number) => number
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
  treeMeta?: TreeRow<Row>
  pinnedStyle: (key: string) => JSX.CSSProperties | null
  extraStyle?: JSX.CSSProperties
}

export function TableRow<Row extends Record<string, unknown>>(
  props: TableRowProps<Row>,
): JSX.Element {
  const k = () => props.rowKeyOf(props.row, props.idx)
  const selected = () => props.displaySelection().includes(k())
  const bs = () => (props.bordered ? '1px solid var(--iris-border)' : 'none')

  return (
    <div
      role="row"
      aria-selected={props.selectable !== 'none' ? selected() : undefined}
      aria-level={props.treeMeta ? props.treeMeta.depth + 1 : undefined}
      aria-setsize={props.treeMeta ? props.treeMeta.setSize : undefined}
      aria-posinset={props.treeMeta ? props.treeMeta.posInset : undefined}
      data-iris-table-row=""
      data-iris-table-row-selected={selected() ? 'true' : undefined}
      onClick={props.onRowClick ? () => props.onRowClick!(props.row, props.idx) : undefined}
      style={{
        display: 'grid',
        'grid-template-columns': 'inherit',
        ...(props.extraStyle ?? {}),
      }}
    >
      <Show when={props.hasDetail}>
        <div
          role="cell"
          data-iris-table-cell="__expand"
          style={{
            ...BASE_CELL_STYLE,
            'justify-content': 'center',
            background:
              props.striped && props.idx % 2 === 1 ? 'var(--iris-surface)' : 'transparent',
            'border-bottom': bs(),
          }}
        >
          <Show when={props.isRowExpandable(props.row, props.idx)}>
            <button
              type="button"
              data-iris-table-expand-toggle=""
              aria-expanded={props.expandedKeys().includes(String(k()))}
              aria-label={props.t(
                props.expandedKeys().includes(String(k()))
                  ? 'treeSelect.collapse'
                  : 'treeSelect.expand',
              )}
              onClick={(e) => {
                e.stopPropagation()
                props.expansion.toggle(String(k()))
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
                color: 'var(--iris-foreground)',
                transform: props.expandedKeys().includes(String(k())) ? 'rotate(90deg)' : 'none',
                transition: 'transform 150ms',
              }}
            >
              ▶
            </button>
          </Show>
        </div>
      </Show>
      <Show when={props.selectable !== 'none'}>
        <div
          role="cell"
          data-iris-table-cell="__selection"
          style={{
            ...BASE_CELL_STYLE,
            'justify-content': 'center',
            background:
              props.striped && props.idx % 2 === 1 ? 'var(--iris-surface)' : 'transparent',
            'border-bottom': bs(),
          }}
        >
          <IrisCheckbox
            checked={selected()}
            onChange={() => props.toggleRow(props.row)}
            aria-label={props.t('table.selectRow', { key: String(k() ?? props.idx) })}
          />
        </div>
      </Show>
      {props.leafColumns.map((col, ci) => {
        const s = props.visibleColSet()
        if (s && !s.has(ci)) return null
        const raw = getCellValue(props.row, col)
        const editing = props.editingCellId() === props.cellId(k(), col.key)
        return (
          <div
            role="cell"
            data-iris-table-cell={col.key}
            data-iris-table-pinned={col.pinned}
            data-editable={col.editable ? '' : undefined}
            data-editing={editing ? '' : undefined}
            {...(props.keyboardNavigation
              ? {
                  'data-grid-row': props.idx,
                  'data-grid-col': ci,
                  tabIndex: (
                    props.focusedCell()
                      ? props.focusedCell()!.row === props.idx && props.focusedCell()!.col === ci
                      : props.idx === 0 && ci === 0
                  )
                    ? 0
                    : -1,
                  onFocus: () => props.setFocusedCell({ row: props.idx, col: ci }),
                }
              : null)}
            {...(props.cellRange
              ? {
                  'data-iris-cell-row': props.idx,
                  'data-iris-cell-col': ci,
                  'data-iris-cell-selected': props.isInRange(props.idx, ci) ? 'true' : undefined,
                  onClick: (e: MouseEvent) => {
                    if (e.shiftKey) {
                      props.cellRangeCtrl.extendRange(props.idx, ci)
                    } else {
                      props.cellRangeCtrl.startRange(props.idx, ci)
                    }
                  },
                }
              : null)}
            onDblClick={col.editable ? () => props.beginEdit(props.row, col, k()) : undefined}
            style={{
              ...BASE_CELL_STYLE,
              ...(s ? { 'grid-column-start': props.colTrack(ci) } : null),
              'justify-content':
                col.align === 'right'
                  ? 'flex-end'
                  : col.align === 'center'
                    ? 'center'
                    : 'flex-start',
              background:
                props.cellRange && props.isInRange(props.idx, ci)
                  ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                  : props.striped && props.idx % 2 === 1
                    ? 'var(--iris-surface)'
                    : 'transparent',
              'border-bottom': bs(),
              cursor: col.editable ? 'cell' : props.cellRange ? 'default' : undefined,
              ...(editing ? { padding: '4px 8px' } : null),
              ...props.pinnedStyle(col.key),
            }}
          >
            <Show when={props.treeMeta && ci === 0}>
              <span
                data-iris-table-tree-indent=""
                style={{
                  display: 'inline-flex',
                  'align-items': 'center',
                  flex: 'none',
                  'padding-left': `${props.treeMeta!.depth * 16}px`,
                }}
              >
                <Show when={props.treeMeta!.hasChildren}>
                  <button
                    type="button"
                    data-iris-table-tree-toggle=""
                    aria-expanded={props.treeMeta!.expanded}
                    aria-label={props.t(
                      props.treeMeta!.expanded ? 'treeSelect.collapse' : 'treeSelect.expand',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      props.expansion.toggle(props.treeMeta!.key)
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                      'margin-right': '4px',
                      font: 'inherit',
                      color: 'var(--iris-foreground)',
                      transform: props.treeMeta!.expanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 150ms',
                    }}
                  >
                    ▶
                  </button>
                </Show>
                <Show when={!props.treeMeta!.hasChildren}>
                  <span style={{ display: 'inline-block', width: '16px' }} aria-hidden="true" />
                </Show>
              </span>
            </Show>
            <Show when={editing}>
              <>
                <input
                  ref={(el) => {
                    props.editorRef.ref = el
                  }}
                  type={col.editor === 'number' ? 'number' : 'text'}
                  value={props.editingDraft()}
                  data-iris-table-editor=""
                  aria-invalid={props.editError() ? 'true' : undefined}
                  aria-describedby={
                    props.editError() ? `${props.cellId(k(), col.key)}-error` : undefined
                  }
                  onInput={(e) => props.setDraft((e.currentTarget as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      props.commitEdit(props.row, col, props.idx)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      props.cancelEdit()
                    }
                  }}
                  onBlur={() => props.commitEdit(props.row, col, props.idx)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    border: `1px solid ${props.editError() ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
                    'border-radius': 'var(--iris-radius-sm, 4px)',
                    padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                    font: 'inherit',
                    background: 'var(--iris-background)',
                    color: 'var(--iris-foreground)',
                    outline: 'none',
                  }}
                />
                <Show when={props.editError()}>
                  <div
                    id={`${props.cellId(k(), col.key)}-error`}
                    role="alert"
                    data-iris-table-editor-error=""
                    style={{
                      'margin-top': '2px',
                      'font-size': 'var(--iris-font-size-xs, 12px)',
                      color: 'var(--iris-danger)',
                    }}
                  >
                    {props.editError()}
                  </div>
                </Show>
              </>
            </Show>
            <Show when={!editing && col.renderCell}>{col.renderCell!(props.row, props.idx)}</Show>
            <Show when={!editing && !col.renderCell}>{raw as JSX.Element}</Show>
          </div>
        )
      })}
    </div>
  )
}
