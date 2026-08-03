import { h, type Component, type VNode } from 'vue'
import { aggregate } from '@iris-ui-kit/core'
import type { TreeRow } from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type { IrisTableColumn } from './types'
import type { TableState } from './useTableState'
import { getCellValue } from './useTableState'

export function renderTableBody(
  state: TableState,
  props: {
    columns: IrisTableColumn[]
    data: Array<Record<string, unknown>>
    selectable: string
    striped: boolean
    error: boolean
    loading: boolean
    virtualScroll?: { itemHeight: number; height: number; buffer?: number }
    keyboardNavigation: boolean
    cellRange: boolean
    renderDetail?: (row: Record<string, unknown>, index: number) => unknown
    visibleColSet: Set<number> | null
  },
  slots: Record<string, (...args: unknown[]) => VNode[]>,
  emit: (event: string, ...args: unknown[]) => void,
): VNode {
  const stateRowStyle = { padding: '32px 12px', textAlign: 'center', color: 'var(--iris-muted)' }

  if (props.error) {
    return h(
      'div',
      { role: 'row', 'data-iris-table-row': 'error', style: stateRowStyle },
      slots.error ? slots.error() : state.t('table.error'),
    )
  }
  if (props.loading) {
    return h(
      'div',
      { role: 'row', 'aria-busy': 'true', 'data-iris-table-row': 'loading', style: stateRowStyle },
      slots.loading ? slots.loading() : state.t('table.loading'),
    )
  }
  if (state.bodyData.value.length === 0) {
    return h(
      'div',
      { role: 'row', 'data-iris-table-row': 'empty', style: stateRowStyle },
      slots.empty ? slots.empty() : state.t('table.empty'),
    )
  }

  if (props.virtualScroll && (!state.treeMode.value || !state.hasDetail.value)) {
    return h(
      IrisVirtualScroll as Component,
      {
        items: state.bodyData.value,
        itemHeight: props.virtualScroll.itemHeight,
        height: props.virtualScroll.height as number,
        buffer: props.virtualScroll.buffer,
        'data-iris-table-body': '',
        style: { width: '100%' },
      },
      {
        item: ({ item, index }: { item: Record<string, unknown>; index: number }) =>
          renderRow(
            state,
            props,
            slots,
            emit,
            item,
            index,
            undefined,
            state.flatTree.value?.[index],
          ),
      },
    )
  }

  const children: VNode[] = []
  state.bodyData.value.forEach((row, i) => {
    children.push(
      renderRow(state, props, slots, emit, row, i, undefined, state.flatTree.value?.[i]),
    )
    if (state.hasDetail.value && state.isRowExpandable(row, i)) {
      const id = state.rowId(row, i)
      if (state.expandedKeys.value.includes(String(id))) {
        children.push(
          h(
            'div',
            {
              key: `${String(id)}::detail`,
              role: 'row',
              'data-iris-table-row-detail': String(id),
              style: { display: 'grid', gridTemplateColumns: state.gridTemplate.value },
            },
            [
              h(
                'div',
                {
                  role: 'cell',
                  'data-iris-table-detail-cell': '',
                  style: {
                    gridColumn: '1 / -1',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--iris-border)',
                  },
                },
                props.renderDetail!(row, i) as VNode,
              ),
            ],
          ),
        )
      }
    }
  })
  return h('div', { role: 'rowgroup', 'data-iris-table-body': '' }, children)
}

function renderRow(
  state: TableState,
  props: {
    columns: IrisTableColumn[]
    selectable: string
    striped: boolean
    keyboardNavigation: boolean
    cellRange: boolean
    visibleColSet: Set<number> | null
  },
  slots: Record<string, (...args: unknown[]) => VNode[]>,
  emit: (event: string, ...args: unknown[]) => void,
  row: Record<string, unknown>,
  index: number,
  extraStyle?: Record<string, string>,
  treeMeta?: TreeRow<Record<string, unknown>>,
): VNode {
  const id = state.rowId(row, index)
  const selected = state.isSelected(id)
  const showSelection = props.selectable !== 'none'
  const showDetail = state.hasDetail.value
  const cells: VNode[] = []

  if (showDetail) {
    const expandable = state.isRowExpandable(row, index)
    const isExpanded = state.expandedKeys.value.includes(String(id))
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
            padding: '8px',
            borderBottom: '1px solid var(--iris-border)',
          },
        },
        expandable
          ? [
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-table-expand-toggle': '',
                  'aria-expanded': isExpanded ? 'true' : 'false',
                  'aria-label': state.t(isExpanded ? 'treeSelect.collapse' : 'treeSelect.expand'),
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    state.expansion.toggle(String(id))
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

  if (showSelection) {
    cells.push(
      h(
        'div',
        {
          key: '__select',
          role: 'cell',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderBottom: '1px solid var(--iris-border)',
          },
        },
        [
          h(IrisCheckbox, {
            modelValue: selected,
            size: 'sm',
            ariaLabel: state.t('table.selectRow', { key: id }),
            'onUpdate:modelValue': () => state.toggleRow(id),
            onClick: (e: MouseEvent) => e.stopPropagation(),
          }),
        ],
      ),
    )
  }

  for (let ci = 0; ci < state.leafColumns.value.length; ci += 1) {
    const col = state.leafColumns.value[ci]
    if (props.visibleColSet && !props.visibleColSet.has(ci)) continue
    const cellSlot = slots[`cell.${col.key}`]
    const isEditing = state.editingCellId.value === state.cellId(id, col.key)

    let content: unknown
    if (isEditing) {
      content = renderEditingCell(state, col, row, index, id)
    } else {
      content =
        cellSlot?.({ row, index, value: getCellValue(row, col) }) ??
        String(getCellValue(row, col) ?? '')
    }

    if (treeMeta && ci === 0) {
      content = [
        renderTreeIndent(state, treeMeta),
        ...(Array.isArray(content) ? content : [content as VNode | string]),
      ]
    }

    cells.push(
      h(
        'div',
        {
          key: col.key,
          role: 'cell',
          'data-iris-table-cell': col.key,
          'data-iris-table-pinned': col.pinned,
          'data-editable': col.editable ? '' : undefined,
          'data-editing': isEditing ? '' : undefined,
          ...(props.keyboardNavigation
            ? {
                'data-grid-row': index,
                'data-grid-col': ci,
                tabindex: state.focusedCell.value
                  ? state.focusedCell.value.row === index && state.focusedCell.value.col === ci
                    ? 0
                    : -1
                  : index === 0 && ci === 0
                    ? 0
                    : -1,
                onFocus: () => {
                  state.focusedCell.value = { row: index, col: ci }
                },
              }
            : {}),
          ...(props.cellRange
            ? {
                'data-iris-cell-row': index,
                'data-iris-cell-col': ci,
                'data-iris-cell-selected': state.isInRange(index, ci) ? 'true' : undefined,
                onClick: (e: MouseEvent) => {
                  if (e.shiftKey) state.cellRangeCtrl.extendRange(index, ci)
                  else state.cellRangeCtrl.startRange(index, ci)
                },
              }
            : {}),
          onDblclick: col.editable ? () => state.beginEdit(row, col, id) : undefined,
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: flexAlign(col.align),
            padding: isEditing ? '4px' : '8px var(--iris-padding-md)',
            borderBottom: '1px solid var(--iris-border)',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: col.editable ? 'cell' : 'default',
            ...(props.cellRange && state.isInRange(index, ci)
              ? { background: 'var(--iris-surface-selected, rgba(99,102,241,0.12))' }
              : {}),
            ...(props.visibleColSet ? { gridColumnStart: String(state.colTrack(ci)) } : {}),
            ...state.pinnedStyle(col.key),
          },
        },
        content as VNode | VNode[] | string,
      ),
    )
  }

  return h(
    'div',
    {
      key: String(id),
      role: 'row',
      'aria-selected': props.selectable !== 'none' ? selected : undefined,
      'aria-level': treeMeta ? treeMeta.depth + 1 : undefined,
      'aria-setsize': treeMeta ? treeMeta.setSize : undefined,
      'aria-posinset': treeMeta ? treeMeta.posInset : undefined,
      'data-iris-table-row': '',
      'data-state': selected ? 'selected' : undefined,
      onClick: () => emit('rowClick', row, index),
      onDblclick: () => emit('rowDblclick', row, index),
      style: {
        display: 'grid',
        gridTemplateColumns: state.gridTemplate.value,
        background: selected
          ? 'var(--iris-surface-hover)'
          : props.striped && index % 2 === 1
            ? 'var(--iris-surface)'
            : 'transparent',
        transition: 'background-color 120ms ease',
        cursor: 'default',
        ...extraStyle,
      },
    },
    cells,
  )
}

function renderEditingCell(
  state: TableState,
  col: IrisTableColumn,
  row: Record<string, unknown>,
  index: number,
  id: string | number,
): VNode | VNode[] {
  const editCellId = state.cellId(id, col.key)
  const error = state.editError.value
  const input = h('input', {
    ref: (el: unknown) => {
      state.editorInputRef.value = (el ?? null) as HTMLInputElement | null
    },
    type: col.editor === 'number' ? 'number' : 'text',
    value: state.editingDraft.value,
    'data-iris-table-editor': '',
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${editCellId}-error` : undefined,
    onInput: (e: Event) => {
      state.editingDraft.value = (e.target as HTMLInputElement).value
    },
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        state.commitEdit(row, col, index)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        state.cancelEdit()
      }
    },
    onBlur: () => state.commitEdit(row, col, index),
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onDblclick: (e: MouseEvent) => e.stopPropagation(),
    style: {
      width: '100%',
      border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
      borderRadius: 'var(--iris-radius-sm)',
      padding: '4px 6px',
      font: 'inherit',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      outline: 'none',
    },
  })
  return error
    ? [
        input,
        h(
          'div',
          {
            id: `${editCellId}-error`,
            role: 'alert',
            'data-iris-table-editor-error': '',
            style: { marginTop: '2px', fontSize: '12px', color: 'var(--iris-danger)' },
          },
          error,
        ),
      ]
    : input
}

function renderTreeIndent(state: TableState, treeMeta: TreeRow<Record<string, unknown>>): VNode {
  return h(
    'span',
    {
      'data-iris-table-tree-indent': '',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        flex: 'none',
        paddingLeft: `${treeMeta.depth * 16}px`,
      },
    },
    treeMeta.hasChildren
      ? [
          h(
            'button',
            {
              type: 'button',
              'data-iris-table-tree-toggle': '',
              'aria-expanded': treeMeta.expanded ? 'true' : 'false',
              'aria-label': state.t(
                treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand',
              ),
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                state.expansion.toggle(String(treeMeta.key))
              },
              style: {
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0',
                marginRight: '4px',
                font: 'inherit',
                color: 'var(--iris-foreground)',
                transform: treeMeta.expanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 150ms',
              },
            },
            '▶',
          ),
        ]
      : [h('span', { 'aria-hidden': 'true', style: { display: 'inline-block', width: '16px' } })],
  )
}

export function renderSummaryRow(
  state: TableState,
  props: {
    error: boolean
    loading: boolean
    selectable: string
    visibleColSet: Set<number> | null
  },
): VNode | null {
  if (props.error || props.loading || state.bodyData.value.length === 0 || !state.hasSummary.value)
    return null

  const showSelection = props.selectable !== 'none'
  const cells: VNode[] = []
  if (showSelection) {
    cells.push(
      h('div', {
        key: '__selection',
        role: 'cell',
        'data-iris-table-cell': '__selection',
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' },
      }),
    )
  }
  for (let ci = 0; ci < state.leafColumns.value.length; ci += 1) {
    const col = state.leafColumns.value[ci]
    if (props.visibleColSet && !props.visibleColSet.has(ci)) continue
    const op = col.summary
    const value = op ? aggregate(state.bodyData.value, (r) => getCellValue(r, col), op) : null
    cells.push(
      h(
        'div',
        {
          key: col.key,
          role: 'cell',
          'data-iris-table-cell': col.key,
          'data-iris-table-summary-cell': op ? '' : undefined,
          'data-iris-table-pinned': col.pinned,
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: flexAlign(col.align),
            padding: '8px var(--iris-padding-md)',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            ...(props.visibleColSet ? { gridColumnStart: String(state.colTrack(ci)) } : {}),
            ...state.pinnedStyle(col.key),
          },
        },
        op != null && value != null
          ? col.renderSummary
            ? (col.renderSummary(value, state.bodyData.value) as VNode)
            : String(value)
          : '',
      ),
    )
  }
  return h(
    'div',
    {
      role: 'row',
      'data-iris-table-row': 'summary',
      style: {
        display: 'grid',
        gridTemplateColumns: state.gridTemplate.value,
        fontWeight: '600',
        borderTop: '2px solid var(--iris-border)',
        background: 'var(--iris-surface)',
      },
    },
    cells,
  )
}

function flexAlign(align?: string): string {
  return align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'
}
