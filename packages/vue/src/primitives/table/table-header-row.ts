import {
  clampColumnWidth,
  resolveColumnWidth,
  type HeaderCell,
  type SortableState,
} from '@iris-ui-kit/core'
import { h, shallowRef, type ExtractPropTypes, type Slots, type VNode } from 'vue'
import type { UseI18nReturn } from '../../i18n'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { tableProps } from './props'
import { renderGroupedHeader } from './table-header-renderers'
import { DEFAULT_MIN_WIDTH, RESIZE_STEP } from './table-helpers'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

type TableRuntimeProps = Readonly<ExtractPropTypes<typeof tableProps>>
type TableRow = Record<string, unknown>
type TableColumn = IrisTableColumn<TableRow>
type HeaderMatrix = HeaderCell<TableColumn>[][]
type Translate = UseI18nReturn['t']
type HandleRef = { value: HTMLElement | null | undefined }
type ColumnFadeAttrs = {
  'data-iris-column-fade': 'in' | 'out' | undefined
  'aria-hidden': 'true' | undefined
  inert: '' | undefined
}

export interface TableHeaderRowContext {
  props: TableRuntimeProps
  slots: Slots
  t: Translate
  showDrag: boolean
  showSeq: boolean
  showDetail: boolean
  showSelection: boolean
  grouped: boolean
  headerMatrix: HeaderMatrix | null
  leafColumns: TableColumn[]
  visibleColSet: Set<number> | null
  gridTemplate: string
  effectiveWidths: IrisTableColumnWidths
  allSelected: boolean
  someSelected: boolean
  toggleAll: () => void
  onHeaderClick: (column: TableColumn) => void
  ariaSortFor: (column: TableColumn) => 'ascending' | 'descending' | 'none' | undefined
  sortIndicator: (column: TableColumn) => VNode | null
  multiSortSeq: (column: TableColumn) => VNode | null
  renderFilterTrigger: (column: TableColumn, leaf: boolean) => VNode | null
  pinnedDragHandle: (column: TableColumn) => VNode | null
  pinOf: (column: TableColumn) => 'left' | 'right' | null
  pinnedStyle: (key: string) => Record<string, string>
  columnFadeAttr: (column: TableColumn) => 'in' | 'out' | undefined
  columnFadeStyle: (column: TableColumn) => Record<string, string> | null
  columnFadeAttrs: (column: TableColumn) => ColumnFadeAttrs
  colTrack: (index: number) => number
  colDragState: SortableState
  handleColDragPointerDown: (event: PointerEvent, key: string) => void
  handleHeaderContextMenu: (event: MouseEvent, column: TableColumn) => void
  wireResize: (column: TableColumn) => void
  getHandleRef: (key: string) => HandleRef
  setColumnWidths: (next: IrisTableColumnWidths) => void
}

/** Render the grouped-or-flat header row while keeping behavior in Table.ts. */
export function renderTableHeaderRow(ctx: TableHeaderRowContext): VNode {
  if (ctx.grouped && ctx.headerMatrix) {
    const allSelected = shallowRef(ctx.allSelected)
    const someSelected = shallowRef(ctx.someSelected)
    const gridTemplate = shallowRef(ctx.gridTemplate)
    return renderGroupedHeader(
      {
        showDrag: ctx.showDrag,
        showSeq: ctx.showSeq,
        showDetail: ctx.showDetail,
        showSelection: ctx.showSelection,
        selectable: ctx.props.selectable,
        selection: ctx.props.selection,
        allSelected,
        someSelected,
        toggleAll: ctx.toggleAll,
        t: ctx.t,
        slots: ctx.slots,
        onHeaderClick: ctx.onHeaderClick,
        ariaSortFor: ctx.ariaSortFor,
        sortIndicator: ctx.sortIndicator,
        multiSortSeq: ctx.multiSortSeq,
        renderFilterTrigger: ctx.renderFilterTrigger,
        pinnedDragHandle: ctx.pinnedDragHandle,
        pinOf: ctx.pinOf,
        pinnedColumnsControlled: ctx.props.pinnedColumns !== undefined,
        columnPinMenu: ctx.props.columnPinMenu,
        pinnedStyle: ctx.pinnedStyle,
        onHeaderContextMenu: ctx.props.columnPinMenu ? ctx.handleHeaderContextMenu : undefined,
        columnFadeAttr: ctx.columnFadeAttr,
        columnFadeStyle: ctx.columnFadeStyle,
        gridTemplate,
      },
      ctx.headerMatrix,
    )
  }

  const headerCells: VNode[] = []
  if (ctx.showDrag) {
    headerCells.push(
      h('div', {
        role: 'columnheader',
        key: '__drag__',
        'data-iris-table-header': '__drag',
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
  if (ctx.showSeq) {
    headerCells.push(
      h('div', {
        role: 'columnheader',
        key: '__seq__',
        'data-iris-table-header': '__seq',
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
  if (ctx.showDetail) {
    headerCells.push(
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
  if (ctx.showSelection) {
    headerCells.push(
      h(
        'div',
        {
          role: 'columnheader',
          key: '__select__',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            background: 'var(--iris-surface)',
            borderBottom: '1px solid var(--iris-border)',
          },
        },
        ctx.props.selectable === 'multi'
          ? [
              h(IrisCheckbox, {
                modelValue: ctx.allSelected ? true : ctx.someSelected ? 'indeterminate' : false,
                size: 'sm',
                ariaLabel: ctx.t('table.selectAll'),
                'onUpdate:modelValue': ctx.toggleAll,
              }),
            ]
          : '',
      ),
    )
  }

  for (let ci = 0; ci < ctx.leafColumns.length; ci += 1) {
    const col = ctx.leafColumns[ci]!
    if (ctx.visibleColSet && !ctx.visibleColSet.has(ci)) continue
    const align = col.align ?? 'left'
    const headerSlot = ctx.slots[`header.${col.key}`]
    const title = headerSlot?.({ column: col }) ?? col.title
    ctx.wireResize(col)
    const pinnedHandle = ctx.pinnedDragHandle(col)
    const handle =
      ctx.props.resizableColumns && !pinnedHandle
        ? h('span', {
            ref: (el: unknown) => {
              ctx.getHandleRef(col.key).value = (el ?? null) as HTMLElement | null
            },
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
              const minW = col.minWidth ?? DEFAULT_MIN_WIDTH
              const maxW = col.maxWidth ?? Infinity
              const cur = resolveColumnWidth(col, ctx.effectiveWidths)
              const delta = e.key === 'ArrowRight' ? RESIZE_STEP : -RESIZE_STEP
              ctx.setColumnWidths({
                ...ctx.effectiveWidths,
                [col.key]: clampColumnWidth(cur + delta, minW, maxW, false),
              })
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

    headerCells.push(
      h(
        'div',
        {
          key: col.key,
          role: 'columnheader',
          'data-iris-table-header': col.key,
          'data-iris-table-pinned': ctx.pinOf(col),
          ...ctx.columnFadeAttrs(col),
          'data-iris-col-drag-active':
            ctx.props.columnDrag && ctx.colDragState.activeId === col.key ? 'true' : undefined,
          'data-iris-col-drag-over':
            ctx.props.columnDrag && ctx.colDragState.overId === col.key ? 'true' : undefined,
          onPointerdown:
            ctx.props.columnDrag && !ctx.grouped
              ? (e: PointerEvent) => ctx.handleColDragPointerDown(e, col.key)
              : undefined,
          onClick: () => ctx.onHeaderClick(col),
          ...(ctx.props.columnPinMenu
            ? { onContextmenu: (event: MouseEvent) => ctx.handleHeaderContextMenu(event, col) }
            : {}),
          style: {
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
            padding: '8px var(--iris-padding-md)',
            cursor: col.sortable ? 'pointer' : 'default',
            userSelect: col.sortable ? 'none' : 'auto',
            background: 'var(--iris-surface)',
            borderBottom: '1px solid var(--iris-border)',
            fontWeight: '600',
            fontSize: 'var(--iris-font-size-md, 14px)',
            color: 'var(--iris-foreground)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            ...(ctx.columnFadeStyle(col) ?? {}),
            ...(ctx.visibleColSet ? { gridColumnStart: String(ctx.colTrack(ci)) } : {}),
            ...(ctx.pinOf(col) !== null
              ? { ...ctx.pinnedStyle(col.key), background: 'var(--iris-surface)' }
              : {}),
          },
          'aria-sort': ctx.ariaSortFor(col),
        },
        [
          title,
          ctx.sortIndicator(col),
          ctx.multiSortSeq(col),
          ctx.renderFilterTrigger(col, true),
          pinnedHandle,
          handle,
        ],
      ),
    )
  }

  return h(
    'div',
    {
      role: 'row',
      'data-iris-table-header-row': '',
      style: {
        display: 'grid',
        gridTemplateColumns: ctx.gridTemplate,
      },
    },
    headerCells,
  )
}
