import { createSignal, For, Show, type Accessor, type JSX } from 'solid-js'
import type { HeaderCell } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'
import { useDrag } from '../drag/useDrag'
import { ColumnResizeHandle as TableColumnResizeHandle } from './table-overlay'

type TableRow = Record<string, unknown>
type TableHeaderMatrix<Row extends TableRow> = HeaderCell<IrisTableColumn<Row>>[][]

function PinnedDragHandle(props: {
  colKey: string
  label: string
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
}): JSX.Element {
  const [element, setElement] = createSignal<HTMLElement | null>(null)
  const [dx, setDx] = createSignal(0)
  useDrag({
    handle: element,
    onStart: () => {
      setDx(0)
    },
    onDrag: ({ dx: next }) => setDx(next),
    onEnd: ({ dx: next }) => {
      props.commitPinnedCount(props.resolvePinnedCount(next))
      setDx(0)
    },
  })
  const nudge = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    props.commitPinnedCount(props.resolvePinnedCount(0) + (event.key === 'ArrowRight' ? 1 : -1))
  }
  return (
    <span
      ref={setElement}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Adjust pinned column count at ${props.label}`}
      tabIndex={0}
      data-iris-pinned-drag-handle=""
      data-column-key={props.colKey}
      data-iris-pinned-drag-active={dx() !== 0 ? 'true' : undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={nudge}
      style={{
        position: 'absolute',
        top: '0',
        right: '0',
        bottom: '0',
        width: '8px',
        cursor: 'col-resize',
        'touch-action': 'none',
        'user-select': 'none',
        'z-index': '2',
        transform: dx() !== 0 ? `translateX(${dx()}px)` : undefined,
      }}
    >
      <span
        aria-hidden="true"
        data-iris-pinned-drag-line=""
        style={{
          position: 'absolute',
          top: '0',
          bottom: '0',
          'inset-inline-start': '50%',
          width: '2px',
          background: 'var(--iris-primary)',
          transform: 'translateX(-50%)',
        }}
      />
    </span>
  )
}

export interface GroupedHeaderProps<Row extends TableRow> {
  grouped: Accessor<boolean>
  matrix: Accessor<TableHeaderMatrix<Row> | null>
  gridTemplate: Accessor<string>
  rowDrag: { onReorder: (rows: Row[]) => void } | undefined
  seq: boolean | undefined
  hasDetail: Accessor<boolean>
  selectable: 'none' | 'single' | 'multi' | undefined
  selection: Array<string | number> | undefined
  allSelected: Accessor<boolean>
  someSelected: Accessor<boolean>
  toggleAll: () => void
  t: (key: string, params?: Record<string, string>) => string
  columnDrag: { onReorder: (columns: IrisTableColumn<Row>[]) => void } | undefined
  columnDragActive: Accessor<string | null>
  columnDragOver: Accessor<string | null>
  handleColumnDragPointerDown: (event: PointerEvent, key: string) => void
  handleHeaderClick: (column: IrisTableColumn<Row>) => void
  sortAria: (column: IrisTableColumn<Row>) => 'none' | 'ascending' | 'descending' | undefined
  sortIndicator: (column: IrisTableColumn<Row>) => JSX.Element
  renderFilterTrigger: (column: IrisTableColumn<Row>, leaf: boolean) => JSX.Element
  pinnedDrag: boolean | undefined
  pinnedBoundaryKey: Accessor<string | null>
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
}

/** Grouped header renderer; all table state remains in IrisTable.tsx. */
export function TableGroupedHeader<Row extends TableRow>(
  props: GroupedHeaderProps<Row>,
): JSX.Element {
  return (
    <Show when={props.grouped() && props.matrix()}>
      <div
        role="row"
        data-iris-table-row="header"
        data-iris-table-header-grouped=""
        style={{
          display: 'grid',
          'grid-template-columns': props.gridTemplate(),
          'grid-template-rows': `repeat(${props.matrix()!.length}, auto)`,
        }}
      >
        <Show when={props.rowDrag}>
          <div
            role="columnheader"
            data-iris-table-header="__drag"
            style={{ 'grid-column': '1', 'grid-row': '1 / -1' }}
          />
        </Show>
        <Show when={props.seq}>
          <div
            role="columnheader"
            data-iris-table-header="__seq"
            style={{
              'grid-column': String((props.rowDrag ? 1 : 0) + 1),
              'grid-row': '1 / -1',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          />
        </Show>
        <Show when={props.hasDetail()}>
          <div
            role="columnheader"
            style={{
              'grid-column': String((props.rowDrag ? 1 : 0) + (props.seq ? 2 : 1)),
              'grid-row': '1 / -1',
            }}
          />
        </Show>
        <Show when={props.selectable !== 'none'}>
          <div
            role="columnheader"
            style={{
              'grid-column': String(
                (props.rowDrag ? 1 : 0) + (props.seq ? 1 : 0) + (props.hasDetail() ? 2 : 1),
              ),
              'grid-row': '1 / -1',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <Show when={props.selectable === 'multi'}>
              <input
                type="checkbox"
                checked={props.allSelected()}
                ref={(el) => {
                  el.indeterminate = props.someSelected()
                }}
                onChange={props.toggleAll}
                aria-label={props.t('table.selectAll')}
              />
              <Show when={props.selection && props.selection.length > 0}>
                <span
                  data-iris-table-selected-count=""
                  style={{
                    'margin-inline-start': 'var(--iris-space-xs, 8px)',
                    'font-size': 'var(--iris-font-size-sm, 13px)',
                    color: 'var(--iris-muted)',
                    'white-space': 'nowrap',
                  }}
                >
                  {props.t('table.selectedCount', { count: String(props.selection!.length) })}
                </span>
              </Show>
            </Show>
          </div>
        </Show>
        <For each={props.matrix()!.flat()}>
          {(cell) => {
            const col = cell.column
            const isLeaf = (): boolean => !col.children || col.children.length === 0
            const sortable = (): boolean => isLeaf() && !!col.sortable
            const lead =
              (props.rowDrag ? 1 : 0) +
              (props.seq ? 1 : 0) +
              (props.hasDetail() ? 1 : 0) +
              (props.selectable !== 'none' ? 1 : 0)
            return (
              <div
                role="columnheader"
                data-iris-table-header={col.key}
                data-iris-table-header-group={isLeaf() ? undefined : ''}
                data-iris-col-drag-active={
                  props.columnDragActive() === col.key ? 'true' : undefined
                }
                data-iris-col-drag-over={props.columnDragOver() === col.key ? 'true' : undefined}
                aria-colspan={cell.colSpan}
                onPointerDown={
                  props.columnDrag && isLeaf()
                    ? (event: PointerEvent) => props.handleColumnDragPointerDown(event, col.key)
                    : undefined
                }
                onClick={sortable() ? () => props.handleHeaderClick(col) : undefined}
                aria-sort={sortable() ? props.sortAria(col) : undefined}
                style={{
                  'grid-column': `${lead + cell.colStart} / span ${cell.colSpan}`,
                  'grid-row': `${cell.level + 1} / span ${cell.rowSpan}`,
                  position: 'relative',
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': isLeaf()
                    ? col.align === 'right'
                      ? 'flex-end'
                      : col.align === 'center'
                        ? 'center'
                        : 'flex-start'
                    : 'center',
                  padding: '8px var(--iris-padding-md)',
                  cursor: sortable() ? 'pointer' : 'default',
                  'user-select': sortable() ? 'none' : 'auto',
                  background: 'var(--iris-surface)',
                  'border-bottom': '1px solid var(--iris-border)',
                  'font-weight': '600',
                  'font-size': 'var(--iris-font-size-md, 14px)',
                  color: 'var(--iris-foreground)',
                  'white-space': 'nowrap',
                  overflow: 'hidden',
                  'text-overflow': 'ellipsis',
                }}
              >
                {col.title}
                <Show when={sortable()}>{props.sortIndicator(col)}</Show>
                {props.renderFilterTrigger(col, isLeaf())}
                <Show when={isLeaf() && props.pinnedDrag && props.pinnedBoundaryKey() === col.key}>
                  <PinnedDragHandle
                    colKey={col.key}
                    label={col.title}
                    resolvePinnedCount={props.resolvePinnedCount}
                    commitPinnedCount={props.commitPinnedCount}
                  />
                </Show>
              </div>
            )
          }}
        </For>
      </div>
    </Show>
  )
}

export interface FlatHeaderProps<Row extends TableRow> {
  grouped: Accessor<boolean>
  columns: Accessor<IrisTableColumn<Row>[]>
  gridTemplate: Accessor<string>
  rowDrag: { onReorder: (rows: Row[]) => void } | undefined
  seq: boolean | undefined
  hasDetail: Accessor<boolean>
  selectable: 'none' | 'single' | 'multi' | undefined
  selection: Array<string | number> | undefined
  allSelected: Accessor<boolean>
  someSelected: Accessor<boolean>
  toggleAll: () => void
  t: (key: string, params?: Record<string, string>) => string
  visibleColSet: Accessor<Set<number> | null>
  colTrack: (index: number) => number
  columnDrag: { onReorder: (columns: IrisTableColumn<Row>[]) => void } | undefined
  columnDragActive: Accessor<string | null>
  columnDragOver: Accessor<string | null>
  handleColumnDragPointerDown: (event: PointerEvent, key: string) => void
  handleHeaderClick: (column: IrisTableColumn<Row>) => void
  sortAria: (column: IrisTableColumn<Row>) => 'none' | 'ascending' | 'descending' | undefined
  sortIndicator: (column: IrisTableColumn<Row>) => JSX.Element
  renderFilterTrigger: (column: IrisTableColumn<Row>, leaf: boolean) => JSX.Element
  pinnedDrag: boolean | undefined
  pinnedBoundaryKey: Accessor<string | null>
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
  resizableColumns: boolean | undefined
  widthOf: (column: IrisTableColumn<Row>) => number
  minWidth: (column: IrisTableColumn<Row>) => number
  maxWidth: (column: IrisTableColumn<Row>) => number
  setColumnWidths: (next: Record<string, number>) => void
  effectiveWidths: Accessor<Record<string, number>>
}

/** Flat header renderer, including optional resize and column-drag handles. */
export function TableFlatHeader<Row extends TableRow>(props: FlatHeaderProps<Row>): JSX.Element {
  return (
    <Show when={!props.grouped()}>
      <div
        role="row"
        data-iris-table-header-row=""
        style={{
          display: 'grid',
          'grid-template-columns': props.gridTemplate(),
        }}
      >
        <Show when={props.rowDrag}>
          <div
            role="columnheader"
            data-iris-table-header="__drag"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          />
        </Show>
        <Show when={props.seq}>
          <div
            role="columnheader"
            data-iris-table-header="__seq"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          />
        </Show>
        <Show when={props.hasDetail()}>
          <div
            role="columnheader"
            data-iris-table-header="__expand"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          />
        </Show>
        <Show when={props.selectable !== 'none'}>
          <div
            role="columnheader"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <Show when={props.selectable === 'multi'}>
              <input
                type="checkbox"
                checked={props.allSelected()}
                ref={(el) => {
                  el.indeterminate = props.someSelected()
                }}
                onChange={props.toggleAll}
                aria-label={props.t('table.selectAll')}
              />
              <Show when={props.selection && props.selection.length > 0}>
                <span
                  data-iris-table-selected-count=""
                  style={{
                    'margin-inline-start': 'var(--iris-space-xs, 8px)',
                    'font-size': 'var(--iris-font-size-sm, 13px)',
                    color: 'var(--iris-muted)',
                    'white-space': 'nowrap',
                  }}
                >
                  {props.t('table.selectedCount', { count: String(props.selection!.length) })}
                </span>
              </Show>
            </Show>
          </div>
        </Show>
        <For each={props.columns()}>
          {(col, colIndexAccessor) => {
            const colIndex = colIndexAccessor()
            const inWindow = (): boolean => {
              const set = props.visibleColSet()
              return !set || set.has(colIndex)
            }
            return (
              <Show when={inWindow()}>
                <div
                  role="columnheader"
                  data-iris-table-header={col.key}
                  data-iris-table-pinned={col.pinned}
                  data-iris-col-drag-active={
                    props.columnDragActive() === col.key ? 'true' : undefined
                  }
                  data-iris-col-drag-over={props.columnDragOver() === col.key ? 'true' : undefined}
                  onPointerDown={
                    props.columnDrag
                      ? (event: PointerEvent) => props.handleColumnDragPointerDown(event, col.key)
                      : undefined
                  }
                  onClick={() => props.handleHeaderClick(col)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content':
                      col.align === 'right'
                        ? 'flex-end'
                        : col.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    padding: '8px var(--iris-padding-md)',
                    cursor: col.sortable ? 'pointer' : 'default',
                    'user-select': col.sortable ? 'none' : 'auto',
                    background: 'var(--iris-surface)',
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-weight': '600',
                    'font-size': 'var(--iris-font-size-md, 14px)',
                    color: 'var(--iris-foreground)',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    ...(props.visibleColSet()
                      ? { 'grid-column-start': String(props.colTrack(colIndex)) }
                      : {}),
                  }}
                  aria-sort={props.sortAria(col)}
                >
                  {col.title}
                  {props.sortIndicator(col)}
                  {props.renderFilterTrigger(col, true)}
                  <Show
                    when={
                      props.resizableColumns &&
                      !(props.pinnedDrag && props.pinnedBoundaryKey() === col.key)
                    }
                  >
                    <TableColumnResizeHandle
                      colKey={col.key}
                      label={col.title}
                      width={() => props.widthOf(col)}
                      minWidth={props.minWidth(col)}
                      maxWidth={props.maxWidth(col)}
                      onResize={(key, width) =>
                        props.setColumnWidths({ ...props.effectiveWidths(), [key]: width })
                      }
                    />
                  </Show>
                  <Show when={props.pinnedDrag && props.pinnedBoundaryKey() === col.key}>
                    <PinnedDragHandle
                      colKey={col.key}
                      label={col.title}
                      resolvePinnedCount={props.resolvePinnedCount}
                      commitPinnedCount={props.commitPinnedCount}
                    />
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
