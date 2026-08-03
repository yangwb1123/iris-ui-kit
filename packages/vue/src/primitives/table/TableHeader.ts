import { h, type VNode } from 'vue'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { resolveInitialWidth } from './useTableState'
import type { IrisTableColumn } from './types'
import type { TableState } from './useTableState'
export function renderTableHeader(
  state: TableState,
  props: {
    columns: IrisTableColumn[]
    selectable: string
    multi: boolean
    visibleColSet: Set<number> | null
    resizableColumns: boolean
  },
  slots: Record<string, (...args: unknown[]) => VNode[]>,
): VNode {
  const showSelection = props.selectable !== 'none'
  const showDetail = state.hasDetail.value

  if (state.grouped.value && state.headerMatrix.value) {
    return renderGroupedHeader(state, props, showSelection, showDetail, slots)
  }

  const cells: VNode[] = renderLeadingHeaderCells(state, props, showSelection, showDetail, slots)

  for (let ci = 0; ci < props.columns.length; ci += 1) {
    const col = props.columns[ci]
    if (props.visibleColSet && !props.visibleColSet.has(ci)) continue
    state.wireResize(col)

    cells.push(
      renderHeaderCell(
        col,
        ci,
        state,
        {
          visibleColSet: props.visibleColSet,
          resizableColumns: props.resizableColumns,
        },
        slots,
      ),
    )
  }

  return h(
    'div',
    {
      role: 'row',
      'data-iris-table-header-row': '',
      style: { display: 'grid', gridTemplateColumns: state.gridTemplate.value },
    },
    cells,
  )
}

function renderGroupedHeader(
  state: TableState,
  _props: { columns: IrisTableColumn[]; selectable: string },
  showSelection: boolean,
  showDetail: boolean,
  slots: Record<string, (...args: unknown[]) => VNode[]>,
): VNode {
  const matrix = state.headerMatrix.value!
  const lead = (showDetail ? 1 : 0) + (showSelection ? 1 : 0)
  const cells: VNode[] = []

  if (showDetail) {
    cells.push(
      h('div', {
        key: '__expand__',
        role: 'columnheader',
        style: { gridColumn: '1', gridRow: '1 / -1' },
      }),
    )
  }
  if (showSelection) {
    cells.push(
      h('div', {
        key: '__select__',
        role: 'columnheader',
        'data-iris-table-header': '',
        style: {
          gridColumn: showDetail ? '2' : '1',
          gridRow: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          background: 'var(--iris-surface)',
          borderBottom: '1px solid var(--iris-border)',
        },
      }),
    )
  }
  for (const rowCells of matrix) {
    for (const cell of rowCells) {
      const col = cell.column as IrisTableColumn
      const isLeaf = !col.children?.length
      const sortable = isLeaf && col.sortable
      const headerSlot = slots[`header.${col.key}`]
      const title = headerSlot?.({ column: col }) ?? col.title
      cells.push(
        h(
          'div',
          {
            key: `${col.key}-${cell.level}`,
            role: 'columnheader',
            'data-iris-table-header': col.key,
            'data-iris-table-header-group': isLeaf ? undefined : '',
            'aria-colspan': cell.colSpan,
            onClick: sortable ? () => state.onHeaderClick(col) : undefined,
            style: {
              gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
              gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isLeaf ? flexAlign(col.align) : 'center',
              padding: '8px var(--iris-padding-md)',
              cursor: sortable ? 'pointer' : 'default',
              userSelect: sortable ? 'none' : 'auto',
              background: 'var(--iris-surface)',
              borderBottom: '1px solid var(--iris-border)',
              fontWeight: '600',
              fontSize: '13px',
              color: 'var(--iris-foreground)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          },
          [title, sortable ? state.sortIndicator(col) : null],
        ),
      )
    }
  }
  return h(
    'div',
    {
      role: 'row',
      'data-iris-table-row': 'header',
      'data-iris-table-header-row': '',
      'data-iris-table-header-grouped': '',
      style: {
        display: 'grid',
        gridTemplateColumns: state.gridTemplate.value,
        gridTemplateRows: `repeat(${matrix.length}, auto)`,
      },
    },
    cells,
  )
}

function renderLeadingHeaderCells(
  state: TableState,
  props: { columns: IrisTableColumn[]; selectable: string; multi: boolean },
  showSelection: boolean,
  showDetail: boolean,
  _slots: Record<string, (...args: unknown[]) => VNode[]>,
): VNode[] {
  const cells: VNode[] = []
  if (showDetail) {
    cells.push(
      h('div', {
        role: 'columnheader',
        key: '__expand__',
        'data-iris-table-header': '__expand',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          background: 'var(--iris-surface)',
          borderBottom: '1px solid var(--iris-border)',
        },
      }),
    )
  }
  if (showSelection) {
    cells.push(
      h(
        'div',
        {
          role: 'columnheader',
          key: '__select__',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            background: 'var(--iris-surface)',
            borderBottom: '1px solid var(--iris-border)',
          },
        },
        props.multi
          ? [
              h(IrisCheckbox, {
                modelValue: state.allSelected.value
                  ? true
                  : state.someSelected.value
                    ? 'indeterminate'
                    : false,
                size: 'sm',
                ariaLabel: state.t('table.selectAll'),
                'onUpdate:modelValue': state.toggleAll,
              }),
            ]
          : '',
      ),
    )
  }
  return cells
}

function renderHeaderCell(
  col: IrisTableColumn,
  ci: number,
  state: TableState,
  p: { visibleColSet: Set<number> | null; resizableColumns: boolean },
  slots: Record<string, (...args: unknown[]) => VNode[]>,
): VNode {
  const align = col.align ?? 'left'
  const headerSlot = slots[`header.${col.key}`]
  const title = headerSlot?.({ column: col }) ?? col.title
  const handle = p.resizableColumns
    ? h('span', {
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': `Resize ${col.title}`,
        tabindex: 0,
        'data-iris-table-resize-handle': '',
        'data-column-key': col.key,
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onKeydown: (e: KeyboardEvent) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          e.stopPropagation()
          const cur = state.effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
          const delta = e.key === 'ArrowRight' ? 16 : -16
          state.setColumnWidths({ ...state.effectiveWidths.value, [col.key]: cur + delta })
        },
        style: {
          position: 'absolute',
          right: '0',
          top: '0',
          bottom: '0',
          width: '6px',
          cursor: 'col-resize',
          touchAction: 'none',
          userSelect: 'none',
          zIndex: '1',
        },
      })
    : null
  const sortActive = state.internalSort.value?.key === col.key
  const sortDir = sortActive ? state.internalSort.value!.direction : null
  return h(
    'div',
    {
      key: col.key,
      role: 'columnheader',
      'data-iris-table-header': col.key,
      'data-iris-table-pinned': col.pinned,
      onClick: () => state.onHeaderClick(col),
      'aria-sort': sortActive
        ? sortDir === 'asc'
          ? 'ascending'
          : 'descending'
        : col.sortable
          ? 'none'
          : undefined,
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: flexAlign(align),
        padding: '8px var(--iris-padding-md)',
        cursor: col.sortable ? 'pointer' : 'default',
        userSelect: col.sortable ? 'none' : 'auto',
        background: 'var(--iris-surface)',
        borderBottom: '1px solid var(--iris-border)',
        fontWeight: '600',
        fontSize: '13px',
        color: 'var(--iris-foreground)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(p.visibleColSet ? { gridColumnStart: String(state.colTrack(ci)) } : {}),
        ...(col.pinned ? { ...state.pinnedStyle(col.key), background: 'var(--iris-surface)' } : {}),
      },
    },
    [title, state.sortIndicator(col), handle],
  )
}

function flexAlign(align?: string): string {
  return align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'
}
