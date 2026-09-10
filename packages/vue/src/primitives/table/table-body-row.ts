import {
  applyTableMask,
  resolveGridSpan,
  tableDisplayText,
  type SortableState,
  type TreeRow,
} from '@iris-ui-kit/core'
import { h, type ExtractPropTypes, type Slots, type VNode } from 'vue'
import type { UseI18nReturn } from '../../i18n'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { tableProps } from './props'
import { applySearchHighlight } from './search-highlight'
import { cellId, isEditableColumn } from './table-helpers'
import type { TableRowEditSession } from './table-row-edit'
import type { IrisTableColumn } from './types'

type TableRuntimeProps = Readonly<ExtractPropTypes<typeof tableProps>>
type TableRow = Record<string, unknown>
type TableColumn = IrisTableColumn<TableRow>
type Translate = UseI18nReturn['t']
type ColumnFadeAttrs = {
  'data-iris-column-fade': 'in' | 'out' | undefined
  'aria-hidden': 'true' | undefined
  inert: '' | undefined
}
type FocusedCell = { row: number; col: number } | null
type TableCellContent = VNode | string | Array<VNode | string | null | undefined>
type RowEditingState = { k: string | number; idx: number } | null

export interface TableBodyRowContext {
  props: TableRuntimeProps
  slots: Slots
  t: Translate
  showDrag: boolean
  showSeq: boolean
  showDetail: boolean
  showSelection: boolean
  leafColumns: TableColumn[]
  visibleColSet: Set<number> | null
  gridTemplate: string
  expandedKeys: Array<string | number>
  rowMode: boolean
  rowEditing: RowEditingState
  rowSessions: ReadonlyMap<string, TableRowEditSession>
  editingCellId: string | null
  editingColumnKey: string | null
  editingDraft: string
  focusedCell: FocusedCell
  setFocusedCell: (cell: Exclude<FocusedCell, null>) => void
  getCellValue: (row: TableRow, column: TableColumn) => unknown
  pinOf: (column: TableColumn) => 'left' | 'right' | null
  pinnedStyle: (key: string) => Record<string, string>
  columnFadeStyle: (column: TableColumn) => Record<string, string> | null
  columnFadeAttrs: (column: TableColumn) => ColumnFadeAttrs
  columnFadeActive: boolean
  colTrack: (index: number) => number
  rowDragState: SortableState
  spanOccupy: Set<string>
  handleRowDragPointerDown: (event: PointerEvent, rowId: string) => void
  toggleRow: (rowId: string | number) => void
  isSelected: (rowId: string | number) => boolean
  isSelectionIndeterminate: (rowId: string | number) => boolean
  expansionToggle: (rowId: string) => void
  handleContextMenu: (
    event: MouseEvent,
    row: TableRow,
    column: TableColumn,
    rowIndex: number,
    columnIndex: number,
  ) => void
  rowId: (row: TableRow, index: number) => string | number
  isRowExpandable: (row: TableRow, index: number) => boolean
  buildRowSessionContent: (
    row: TableRow,
    column: TableColumn,
    index: number,
    key: string | number,
    editCellId: string,
    session: TableRowEditSession,
  ) => TableCellContent
  buildCellEditContent: (
    row: TableRow,
    column: TableColumn,
    index: number,
    editCellId: string,
  ) => TableCellContent
  buildTreeIndent: (treeMeta: TreeRow<TableRow>, row: TableRow) => VNode | null
  switchRowEdit: (row: TableRow, index: number, focusColKey?: string) => void
  beginEdit: (row: TableRow, column: TableColumn, rowId: string | number) => void
  handleRowModeCellClick: (
    row: TableRow,
    column: TableColumn,
    index: number,
    key: string | number,
  ) => void
  isInRange: (row: number, col: number) => boolean
  cellRangeCtrl: {
    startRange: (row: number, col: number) => void
    extendRange: (row: number, col: number) => void
  }
  emitRowClick: (row: TableRow, index: number) => void
  emitRowDblclick: (row: TableRow, index: number) => void
}

/** Render one body row from the current Vue table adapter state snapshot. */
export function renderTableBodyRow(
  ctx: TableBodyRowContext,
  row: TableRow,
  index: number,
  style?: Record<string, string>,
  treeMeta?: TreeRow<TableRow>,
): VNode {
  const id = ctx.rowId(row, index)
  const selected = ctx.isSelected(id)
  const cells: VNode[] = []
  if (ctx.showDrag) {
    const rowDragActive = ctx.rowDragState.activeId === String(id)
    const rowDragOver = ctx.rowDragState.overId === String(id)
    cells.push(
      h(
        'div',
        {
          key: '__drag',
          role: 'cell',
          'data-iris-table-cell': '__drag',
          'data-iris-row-drag-handle': String(id),
          'data-iris-row-drag-active': rowDragActive ? 'true' : undefined,
          'data-iris-row-drag-over': rowDragOver ? 'true' : undefined,
          onPointerdown: (e: PointerEvent) => ctx.handleRowDragPointerDown(e, String(id)),
          onClick: (e: MouseEvent) => e.stopPropagation(),
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid var(--iris-border)',
            cursor: 'grab',
            color: 'var(--iris-muted)',
            background: rowDragActive
              ? 'var(--iris-surface-hover)'
              : rowDragOver
                ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                : 'transparent',
          },
        },
        [
          h(
            'span',
            {
              'aria-hidden': 'true',
              style: { fontSize: 'var(--iris-font-size-sm, 13px)' },
            },
            '⠿',
          ),
        ],
      ),
    )
  }
  if (ctx.showSeq) {
    cells.push(
      h(
        'div',
        {
          key: '__seq',
          role: 'cell',
          'data-iris-table-cell': '__seq',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid var(--iris-border)',
            color: 'var(--iris-muted)',
            userSelect: 'none',
          },
        },
        String(index + ctx.props.seqStartIndex),
      ),
    )
  }
  if (ctx.showDetail) {
    const rowExpandable = ctx.isRowExpandable(row, index)
    const isExpanded = ctx.expandedKeys.includes(String(id))
    cells.push(
      h(
        'div',
        {
          key: '__expand',
          role: 'cell',
          'data-iris-table-cell': '__expand',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid var(--iris-border)',
          },
        },
        rowExpandable
          ? [
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-table-expand-toggle': '',
                  'aria-expanded': isExpanded ? 'true' : 'false',
                  'aria-label': ctx.t(isExpanded ? 'treeSelect.collapse' : 'treeSelect.expand'),
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    ctx.expansionToggle(String(id))
                  },
                  style: {
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '0',
                    font: 'inherit',
                    color: 'var(--iris-foreground)',
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 150ms',
                  },
                },
                '▶',
              ),
            ]
          : '',
      ),
    )
  }
  if (ctx.showSelection) {
    cells.push(
      h(
        'div',
        {
          role: 'cell',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid var(--iris-border)',
          },
        },
        [
          h(IrisCheckbox, {
            modelValue: ctx.isSelectionIndeterminate(id) ? 'indeterminate' : selected,
            size: 'sm',
            ariaLabel: ctx.t('table.selectRow', { key: id }),
            'onUpdate:modelValue': () => ctx.toggleRow(id),
            onClick: (e: MouseEvent) => e.stopPropagation(),
          }),
        ],
      ),
    )
  }
  for (let ci = 0; ci < ctx.leafColumns.length; ci += 1) {
    const col = ctx.leafColumns[ci]!
    if (ctx.visibleColSet && !ctx.visibleColSet.has(ci)) continue
    const span = resolveGridSpan(ctx.spanOccupy, index, ci, ctx.props.spanMethod)
    if (span === null) continue
    const rowspan = span.rowspan
    const colspan = span.colspan
    const align = col.align ?? 'left'
    const cellSlot = ctx.slots[`cell.${col.key}`]
    const isRowEditing =
      ctx.rowMode &&
      ctx.rowEditing !== null &&
      ctx.rowEditing.k === id &&
      ctx.rowSessions.has(cellId(id, col.key))
    const isEditing = isRowEditing || ctx.editingCellId === cellId(id, col.key)
    const patternHint =
      (ctx.props.pattern || ctx.props.patternFill) &&
      !ctx.rowMode &&
      ctx.editingColumnKey === col.key &&
      !isEditing &&
      ctx.editingDraft !== '' &&
      String(ctx.getCellValue(row, col) ?? '') === ctx.editingDraft

    let content: TableCellContent
    if (isEditing) {
      const editCellId = cellId(id, col.key)
      content = isRowEditing
        ? ctx.buildRowSessionContent(
            row,
            col,
            index,
            id,
            editCellId,
            ctx.rowSessions.get(editCellId)!,
          )
        : ctx.buildCellEditContent(row, col, index, editCellId)
    } else {
      content = (cellSlot?.({ row, index, value: ctx.getCellValue(row, col) }) ??
        (ctx.props.searchHighlight
          ? (() => {
              const displayValue = applyTableMask(ctx.getCellValue(row, col), col)
              const renderedValue = col.formatter ? col.formatter(displayValue, row) : displayValue
              return applySearchHighlight(renderedValue, ctx.props.searchHighlight)
            })()
          : tableDisplayText(row, col, ctx.getCellValue))) as TableCellContent
    }

    const treeIndent = treeMeta && ci === 0 ? ctx.buildTreeIndent(treeMeta, row) : null
    const cellChildren: TableCellContent = treeIndent
      ? [treeIndent, ...(Array.isArray(content) ? content : [content])]
      : content

    cells.push(
      h(
        'div',
        {
          key: col.key,
          role: 'cell',
          'data-iris-table-cell': col.key,
          'data-iris-table-pinned': ctx.pinOf(col),
          ...ctx.columnFadeAttrs(col),
          'data-editable': isEditableColumn(col) ? '' : undefined,
          'data-editing': isEditing ? '' : undefined,
          'data-iris-input-hint': patternHint ? 'true' : undefined,
          ...(ctx.props.keyboardNavigation
            ? {
                'data-grid-row': index,
                'data-grid-col': ci,
                tabindex: (
                  ctx.focusedCell
                    ? ctx.focusedCell.row === index && ctx.focusedCell.col === ci
                    : index === 0 && ci === 0
                )
                  ? 0
                  : -1,
                onFocus: () => {
                  ctx.setFocusedCell({ row: index, col: ci })
                },
              }
            : {}),
          ...(ctx.props.cellRange
            ? {
                'data-iris-cell-row': index,
                'data-iris-cell-col': ci,
                'data-iris-cell-selected': ctx.isInRange(index, ci) ? 'true' : undefined,
                onClick: (e: MouseEvent) => {
                  if (e.shiftKey) {
                    ctx.cellRangeCtrl.extendRange(index, ci)
                  } else {
                    ctx.cellRangeCtrl.startRange(index, ci)
                  }
                },
              }
            : {}),
          onDblclick: ctx.rowMode
            ? () => ctx.switchRowEdit(row, index, col.key)
            : isEditableColumn(col)
              ? () => ctx.beginEdit(row, col, id)
              : undefined,
          onClick: ctx.rowMode
            ? () => ctx.handleRowModeCellClick(row, col, index, id)
            : ctx.props.cellRange
              ? (e: MouseEvent) => {
                  if (e.shiftKey) ctx.cellRangeCtrl.extendRange(index, ci)
                  else ctx.cellRangeCtrl.startRange(index, ci)
                }
              : isEditableColumn(col) && ctx.props.editConfig?.trigger === 'click'
                ? () => ctx.beginEdit(row, col, id)
                : undefined,
          onContextmenu: ctx.props.contextMenu
            ? (e: MouseEvent) => ctx.handleContextMenu(e, row, col, index, ci)
            : undefined,
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
            background: 'var(--iris-cell-bg, transparent)',
            padding: isEditing
              ? 'var(--iris-space-xxs, 4px)'
              : 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
            ...(isEditing ? { flexWrap: 'wrap' } : {}),
            borderBottom: '1px solid var(--iris-border)',
            fontSize: 'var(--iris-font-size-md, 14px)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: isEditableColumn(col) ? 'cell' : 'default',
            ...(ctx.props.cellRange && ctx.isInRange(index, ci)
              ? { background: 'var(--iris-surface-selected, rgba(99,102,241,0.12))' }
              : {}),
            ...(ctx.visibleColSet ? { gridColumnStart: String(ctx.colTrack(ci)) } : {}),
            ...(colspan > 1 ? { gridColumnEnd: `span ${colspan}` } : {}),
            ...(rowspan > 1 ? { gridRowEnd: `span ${rowspan}` } : {}),
            ...(patternHint
              ? {
                  backgroundImage:
                    'linear-gradient(var(--iris-input-hint, rgba(251, 191, 36, 0.16)), var(--iris-input-hint, rgba(251, 191, 36, 0.16)))',
                }
              : {}),
            ...ctx.pinnedStyle(col.key),
            ...(ctx.columnFadeStyle(col) ?? {}),
          },
        },
        cellChildren,
      ),
    )
  }

  return h(
    'div',
    {
      key: String(id),
      role: 'row',
      'aria-selected': ctx.props.selectable !== 'none' ? selected : undefined,
      'aria-level': treeMeta ? treeMeta.depth + 1 : undefined,
      'aria-setsize': treeMeta ? treeMeta.setSize : undefined,
      'aria-posinset': treeMeta ? treeMeta.posInset : undefined,
      'data-iris-table-row': '',
      'data-iris-table-row-key': String(id),
      'data-iris-row-editing': ctx.rowMode && ctx.rowEditing?.k === id ? 'true' : undefined,
      'data-state': selected ? 'selected' : undefined,
      onClick: () => ctx.emitRowClick(row, index),
      onDblclick: () => ctx.emitRowDblclick(row, index),
      style: {
        display: 'grid',
        gridTemplateColumns: ctx.gridTemplate,
        background: selected ? 'var(--iris-surface-hover)' : 'transparent',
        transition: ctx.columnFadeActive
          ? 'background-color 120ms ease, grid-template-columns var(--iris-duration-md, 200ms) ease'
          : 'background-color 120ms ease',
        cursor: 'default',
        ...style,
      },
    },
    cells,
  )
}
