import { h, type Ref, type Slots, type VNode } from 'vue'
import type { HeaderCell } from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import type { IrisTableColumn } from './types'

type TableRow = Record<string, unknown>
type TableColumn = IrisTableColumn<TableRow>
type HeaderMatrix = HeaderCell<TableColumn>[][]

export interface GroupedHeaderRenderContext {
  showDrag: boolean
  showSeq: boolean
  showDetail: boolean
  showSelection: boolean
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  allSelected: Readonly<Ref<boolean>>
  someSelected: Readonly<Ref<boolean>>
  toggleAll: () => void
  t: (key: string, params?: Record<string, string>) => string
  slots: Slots
  onHeaderClick: (column: TableColumn) => void
  ariaSortFor: (column: TableColumn) => 'ascending' | 'descending' | 'none' | undefined
  sortIndicator: (column: TableColumn) => VNode | null
  multiSortSeq: (column: TableColumn) => VNode | null
  renderFilterTrigger: (column: TableColumn, leaf: boolean) => VNode | null
  pinnedDragHandle?: (column: TableColumn) => VNode | null
  pinOf: (column: TableColumn) => 'left' | 'right' | null
  pinnedColumnsControlled: boolean
  columnPinMenu: boolean
  pinnedStyle: (key: string) => Record<string, string>
  onHeaderContextMenu?: (event: MouseEvent, column: TableColumn) => void
  columnFadeAttr: (column: TableColumn) => 'in' | 'out' | undefined
  columnFadeStyle: (column: TableColumn) => Record<string, string> | null
  gridTemplate: Readonly<Ref<string>>
}

/** Render a multi-level CSS-grid header while keeping setup state in Table.ts. */
export function renderGroupedHeader(ctx: GroupedHeaderRenderContext, matrix: HeaderMatrix): VNode {
  const lead =
    (ctx.showDrag ? 1 : 0) +
    (ctx.showSeq ? 1 : 0) +
    (ctx.showDetail ? 1 : 0) +
    (ctx.showSelection ? 1 : 0)
  const cells: VNode[] = []
  if (ctx.showDrag) {
    cells.push(
      h('div', {
        key: '__drag__',
        role: 'columnheader',
        'data-iris-table-header': '__drag',
        style: { gridColumn: '1', gridRow: '1 / -1' },
      }),
    )
  }
  if (ctx.showSeq) {
    cells.push(
      h('div', {
        key: '__seq__',
        role: 'columnheader',
        'data-iris-table-header': '__seq',
        style: { gridColumn: ctx.showDrag ? '2' : '1', gridRow: '1 / -1' },
      }),
    )
  }
  if (ctx.showDetail) {
    cells.push(
      h('div', {
        key: '__expand__',
        role: 'columnheader',
        style: {
          gridColumn: `${(ctx.showDrag ? 1 : 0) + (ctx.showSeq ? 1 : 0) + 1}`,
          gridRow: '1 / -1',
        },
      }),
    )
  }
  if (ctx.showSelection) {
    cells.push(
      h(
        'div',
        {
          key: '__select__',
          role: 'columnheader',
          'data-iris-table-header': '',
          style: {
            gridColumn: `${(ctx.showDrag ? 1 : 0) + (ctx.showSeq ? 1 : 0) + (ctx.showDetail ? 1 : 0) + 1}`,
            gridRow: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            background: 'var(--iris-surface)',
            borderBottom: '1px solid var(--iris-border)',
          },
        },
        ctx.selectable === 'multi'
          ? [
              [
                h(IrisCheckbox, {
                  modelValue: ctx.allSelected.value
                    ? true
                    : ctx.someSelected.value
                      ? 'indeterminate'
                      : false,
                  size: 'sm',
                  ariaLabel: ctx.t('table.selectAll'),
                  'onUpdate:modelValue': ctx.toggleAll,
                }),
                ctx.selection && ctx.selection.length > 0
                  ? h(
                      'span',
                      {
                        'data-iris-table-selected-count': '',
                        style: {
                          marginInlineStart: 'var(--iris-space-xs, 8px)',
                          fontSize: 'var(--iris-font-size-sm, 13px)',
                          color: 'var(--iris-muted)',
                          whiteSpace: 'nowrap',
                        },
                      },
                      ctx.t('table.selectedCount', { count: String(ctx.selection.length) }),
                    )
                  : null,
              ],
            ]
          : '',
      ),
    )
  }
  for (const rowCells of matrix) {
    for (const cell of rowCells) {
      const col = cell.column
      const isLeaf = !col.children || col.children.length === 0
      const sortable = isLeaf && col.sortable
      const align = col.align ?? 'left'
      const fadeStyle = ctx.columnFadeStyle(col)
      const headerSlot = ctx.slots[`header.${col.key}`]
      const title = headerSlot?.({ column: col }) ?? col.title
      cells.push(
        h(
          'div',
          {
            key: `${col.key}-${cell.level}`,
            role: 'columnheader',
            'data-iris-table-header': col.key,
            'data-iris-table-header-group': isLeaf ? undefined : '',
            'data-iris-table-pinned':
              isLeaf && (ctx.pinnedColumnsControlled || ctx.columnPinMenu)
                ? ctx.pinOf(col)
                : undefined,
            'data-iris-column-fade': ctx.columnFadeAttr(col),
            'aria-hidden': fadeStyle ? 'true' : undefined,
            inert: fadeStyle ? '' : undefined,
            'aria-colspan': cell.colSpan,
            onClick: sortable ? () => ctx.onHeaderClick(col) : undefined,
            ...(isLeaf && ctx.onHeaderContextMenu
              ? { onContextmenu: (event: MouseEvent) => ctx.onHeaderContextMenu!(event, col) }
              : {}),
            'aria-sort': sortable ? ctx.ariaSortFor(col) : undefined,
            style: {
              gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
              gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isLeaf
                ? align === 'right'
                  ? 'flex-end'
                  : align === 'center'
                    ? 'center'
                    : 'flex-start'
                : 'center',
              padding: '8px var(--iris-padding-md)',
              cursor: sortable ? 'pointer' : 'default',
              userSelect: sortable ? 'none' : 'auto',
              background: 'var(--iris-surface)',
              borderBottom: '1px solid var(--iris-border)',
              fontWeight: '600',
              fontSize: 'var(--iris-font-size-md, 14px)',
              color: 'var(--iris-foreground)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              ...(fadeStyle ?? {}),
              ...(isLeaf &&
              (ctx.pinnedColumnsControlled || ctx.columnPinMenu) &&
              ctx.pinOf(col) !== null
                ? { ...ctx.pinnedStyle(col.key), background: 'var(--iris-surface)' }
                : {}),
            },
          },
          [
            title,
            sortable ? ctx.sortIndicator(col) : null,
            ctx.multiSortSeq(col),
            ctx.renderFilterTrigger(col, isLeaf),
            isLeaf ? (ctx.pinnedDragHandle?.(col) ?? null) : null,
          ],
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
        gridTemplateColumns: ctx.gridTemplate.value,
        gridTemplateRows: `repeat(${matrix.length}, auto)`,
      },
    },
    cells,
  )
}
