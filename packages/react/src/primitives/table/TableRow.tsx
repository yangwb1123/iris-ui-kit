import * as React from 'react'
import type { TreeRow } from '@iris-ui/core'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { BASE_CELL_STYLE, borderStyle } from './styles'

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

interface TableRowProps<Row extends Record<string, unknown>> {
  row: Row
  idx: number
  rowKeyOf: (row: Row) => string | number
  selectable: 'none' | 'single' | 'multi'
  displaySelection: Array<string | number>
  toggleRow: (row: Row) => void
  hasDetail: boolean
  isRowExpandable: (row: Row, idx: number) => boolean
  expansion: { toggle: (key: string) => void }
  expandedKeys: string[]
  t: (key: string, params?: Record<string, string | number>) => string
  leafColumns: IrisTableColumn<Row>[]
  columnWidths: IrisTableColumnWidths
  bordered: boolean
  striped: boolean
  visibleColSet: Set<number> | null
  colTrack: (i: number) => number
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
  treeMeta?: TreeRow<Row>
  pinnedStyle: (key: string) => React.CSSProperties | null
  extraStyle?: React.CSSProperties
}

export function TableRow<Row extends Record<string, unknown>>({
  row,
  idx,
  rowKeyOf,
  selectable,
  displaySelection,
  toggleRow,
  hasDetail,
  isRowExpandable,
  expansion,
  expandedKeys,
  t,
  leafColumns, // eslint-disable-line @typescript-eslint/no-unused-vars
  columnWidths: _columnWidths,
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
  treeMeta,
  pinnedStyle,
  extraStyle,
}: TableRowProps<Row>): React.ReactElement {
  const k = rowKeyOf(row)
  const selected = displaySelection.includes(k)
  const bs = borderStyle(bordered)

  return (
    <div
      key={String(k ?? idx)}
      role="row"
      aria-selected={selectable !== 'none' ? selected : undefined}
      aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
      aria-setsize={treeMeta ? treeMeta.setSize : undefined}
      aria-posinset={treeMeta ? treeMeta.posInset : undefined}
      data-iris-table-row={String(k ?? idx)}
      data-iris-table-row-selected={selected ? 'true' : undefined}
      style={{ display: 'grid', gridTemplateColumns: 'inherit', ...extraStyle }}
    >
      {hasDetail ? (
        <div
          role="cell"
          data-iris-table-cell="__expand"
          style={{
            ...BASE_CELL_STYLE,
            justifyContent: 'center',
            background: striped && idx % 2 === 1 ? 'var(--iris-surface)' : 'transparent',
            borderBottom: bs,
          }}
        >
          {isRowExpandable(row, idx) ? (
            <button
              type="button"
              data-iris-table-expand-toggle=""
              aria-expanded={expandedKeys.includes(String(k))}
              aria-label={t(
                expandedKeys.includes(String(k)) ? 'treeSelect.collapse' : 'treeSelect.expand',
              )}
              onClick={(e) => {
                e.stopPropagation()
                expansion.toggle(String(k))
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
                color: 'var(--iris-foreground)',
                transform: expandedKeys.includes(String(k)) ? 'rotate(90deg)' : 'none',
                transition: 'transform 150ms',
              }}
            >
              ▶
            </button>
          ) : null}
        </div>
      ) : null}
      {selectable !== 'none' ? (
        <div
          role="cell"
          data-iris-table-cell="__selection"
          style={{
            ...BASE_CELL_STYLE,
            justifyContent: 'center',
            background: striped && idx % 2 === 1 ? 'var(--iris-surface)' : 'transparent',
            borderBottom: bs,
          }}
        >
          <IrisCheckbox
            checked={selected}
            onChange={() => toggleRow(row)}
            aria-label={t('table.selectRow', { key: String(k ?? idx) })}
          />
        </div>
      ) : null}
      {leafColumns.map((col, ci) => {
        if (visibleColSet && !visibleColSet.has(ci)) return null
        const raw = getCellValue(row, col)
        const editing = editingCellId === cellId(k, col.key)
        return (
          <div
            key={col.key}
            role="cell"
            data-iris-table-cell={col.key}
            data-iris-table-pinned={col.pinned}
            data-editable={col.editable ? '' : undefined}
            data-editing={editing ? '' : undefined}
            {...(keyboardNavigation
              ? {
                  'data-grid-row': idx,
                  'data-grid-col': ci,
                  tabIndex: (
                    focusedCell
                      ? focusedCell.row === idx && focusedCell.col === ci
                      : idx === 0 && ci === 0
                  )
                    ? 0
                    : -1,
                  onFocus: () => setFocusedCell({ row: idx, col: ci }),
                }
              : null)}
            {...(cellRange
              ? {
                  'data-iris-cell-row': idx,
                  'data-iris-cell-col': ci,
                  'data-iris-cell-selected': isInRange(idx, ci) ? 'true' : undefined,
                  onClick: (e: React.MouseEvent) => {
                    if (e.shiftKey) {
                      cellRangeCtrl.extendRange(idx, ci)
                    } else {
                      cellRangeCtrl.startRange(idx, ci)
                    }
                  },
                }
              : null)}
            onDoubleClick={col.editable ? () => beginEdit(row, col, k) : undefined}
            style={{
              ...BASE_CELL_STYLE,
              ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
              justifyContent:
                col.align === 'right'
                  ? 'flex-end'
                  : col.align === 'center'
                    ? 'center'
                    : 'flex-start',
              background:
                cellRange && isInRange(idx, ci)
                  ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                  : striped && idx % 2 === 1
                    ? 'var(--iris-surface)'
                    : 'transparent',
              borderBottom: bs,
              cursor: col.editable ? 'cell' : cellRange ? 'default' : undefined,
              ...(editing ? { padding: '4px 8px' } : null),
              ...pinnedStyle(col.key),
            }}
          >
            {treeMeta && ci === 0 ? (
              <span
                data-iris-table-tree-indent=""
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  flex: 'none',
                  paddingLeft: treeMeta.depth * 16,
                }}
              >
                {treeMeta.hasChildren ? (
                  <button
                    type="button"
                    data-iris-table-tree-toggle=""
                    aria-expanded={treeMeta.expanded}
                    aria-label={t(treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand')}
                    onClick={(e) => {
                      e.stopPropagation()
                      expansion.toggle(treeMeta.key)
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                      marginRight: 4,
                      font: 'inherit',
                      color: 'var(--iris-foreground)',
                      transform: treeMeta.expanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 150ms',
                    }}
                  >
                    ▶
                  </button>
                ) : (
                  <span style={{ display: 'inline-block', width: 16 }} aria-hidden="true" />
                )}
              </span>
            ) : null}
            {editing ? (
              <>
                <input
                  ref={editorRef as React.Ref<HTMLInputElement>}
                  type={col.editor === 'number' ? 'number' : 'text'}
                  value={editingDraft}
                  data-iris-table-editor=""
                  aria-invalid={editError ? 'true' : undefined}
                  aria-describedby={editError ? `${cellId(k, col.key)}-error` : undefined}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitEdit(row, col, idx)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelEdit()
                    }
                  }}
                  onBlur={() => commitEdit(row, col, idx)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    border: `1px solid ${editError ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    padding: '4px 6px',
                    font: 'inherit',
                    background: 'var(--iris-background)',
                    color: 'var(--iris-foreground)',
                    outline: 'none',
                  }}
                />
                {editError ? (
                  <div
                    id={`${cellId(k, col.key)}-error`}
                    role="alert"
                    data-iris-table-editor-error=""
                    style={{ marginTop: 2, fontSize: 12, color: 'var(--iris-danger)' }}
                  >
                    {editError}
                  </div>
                ) : null}
              </>
            ) : col.render ? (
              col.render(raw, row, idx)
            ) : (
              (raw as React.ReactNode)
            )}
          </div>
        )
      })}
    </div>
  )
}
