import { For, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import type { HeaderCell } from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox'
import { ColumnResizeHandle } from './ColumnResizeHandle'
import { BASE_CELL_STYLE } from './styles'
import type { IrisTableColumn, IrisTableColumnWidths, IrisTableSortState } from './types'

interface TableHeaderProps<Row extends Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  leafColumns: IrisTableColumn<Row>[]
  grouped: boolean
  headerMatrix: HeaderCell<IrisTableColumn<Row>>[][] | null
  selectable: 'none' | 'single' | 'multi'
  hasDetail: boolean
  bordered: boolean
  t: (key: string, params?: Record<string, string | number>) => string
  gridTemplateColumns: string
  sort: IrisTableSortState | null
  cycleSort: (col: IrisTableColumn<Row>) => void
  onHeaderKeyDown: (e: KeyboardEvent, col: IrisTableColumn<Row>) => void
  allSelected: boolean
  someSelected: boolean
  toggleAll: () => void
  resizableColumns?: boolean
  columnWidths: IrisTableColumnWidths
  setColumnWidth: (key: string, width: number) => void
  visibleColSet: () => Set<number> | null
  colTrack: (i: number) => number
  pinnedStyle: (key: string) => JSX.CSSProperties | null
  columnWidthFn: (colKey: string) => number
}

export function TableHeader<Row extends Record<string, unknown>>(
  props: TableHeaderProps<Row>,
): JSX.Element {
  const bs = () => (props.bordered ? '1px solid var(--iris-border)' : 'none')

  const sortIndicator = (col: IrisTableColumn<Row>) => {
    if (!col.sortable) return null
    const isSortKey = props.sort?.key === col.key
    const dir = isSortKey ? props.sort?.direction : undefined
    return (
      <span
        aria-hidden="true"
        data-iris-table-sort-indicator=""
        style={{
          'margin-inline-start': '6px',
          'font-size': 'var(--iris-font-size-xs, 12px)',
          color: dir ? 'var(--iris-primary)' : 'var(--iris-muted)',
        }}
      >
        {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
      </span>
    )
  }

  // Grouped header
  if (props.grouped && props.headerMatrix) {
    const lead = (props.hasDetail ? 1 : 0) + (props.selectable !== 'none' ? 1 : 0)
    return (
      <div
        role="row"
        data-iris-table-row="header"
        data-iris-table-header-row=""
        data-iris-table-header-grouped=""
        style={{
          display: 'grid',
          'grid-template-columns': props.gridTemplateColumns,
          'grid-template-rows': `repeat(${props.headerMatrix.length}, auto)`,
        }}
      >
        <Show when={props.hasDetail}>
          <div role="columnheader" style={{ 'grid-column': '1', 'grid-row': '1 / -1' }} />
        </Show>
        <Show when={props.selectable !== 'none'}>
          <div
            role="columnheader"
            data-iris-table-header=""
            style={{
              'grid-column': props.hasDetail ? '2' : '1',
              'grid-row': '1 / -1',
              ...BASE_CELL_STYLE,
              background: 'var(--iris-surface)',
              'border-bottom': bs(),
              'justify-content': 'center',
            }}
          >
            <Show when={props.selectable === 'multi'}>
              <IrisCheckbox
                checked={props.allSelected ? true : props.someSelected ? 'indeterminate' : false}
                onChange={props.toggleAll}
                aria-label={props.t('table.selectAll')}
              />
            </Show>
          </div>
        </Show>
        <For each={props.headerMatrix}>
          {(row) => (
            <For each={row}>
              {(cell) => {
                const col = cell.column
                const isLeaf = !col.children || col.children.length === 0
                const sortable = isLeaf && col.sortable
                return (
                  <div
                    role="columnheader"
                    data-iris-table-header={col.key}
                    data-iris-table-header-group={isLeaf ? undefined : ''}
                    aria-colspan={cell.colSpan}
                    aria-sort={
                      sortable && props.sort?.key === col.key
                        ? props.sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : sortable
                          ? 'none'
                          : undefined
                    }
                    tabIndex={sortable ? 0 : undefined}
                    onClick={sortable ? () => props.cycleSort(col) : undefined}
                    onKeyDown={sortable ? (e) => props.onHeaderKeyDown(e, col) : undefined}
                    style={{
                      'grid-column': `${lead + cell.colStart} / span ${cell.colSpan}`,
                      'grid-row': `${cell.level + 1} / span ${cell.rowSpan}`,
                      ...BASE_CELL_STYLE,
                      'justify-content': isLeaf ? 'flex-start' : 'center',
                      background: 'var(--iris-surface)',
                      'border-bottom': bs(),
                      'border-inline-end': isLeaf ? 'none' : bs(),
                      cursor: sortable ? 'pointer' : 'default',
                      'font-weight': 600,
                      'user-select': sortable ? 'none' : 'auto',
                    }}
                  >
                    <span>{col.title}</span>
                    {sortIndicator(col)}
                  </div>
                )
              }}
            </For>
          )}
        </For>
      </div>
    )
  }

  // Flat header
  return (
    <div
      role="row"
      data-iris-table-header-row=""
      style={{ display: 'grid', 'grid-template-columns': props.gridTemplateColumns }}
    >
      <Show when={props.hasDetail}>
        <div
          role="columnheader"
          data-iris-table-header="__expand"
          style={{ ...BASE_CELL_STYLE, background: 'var(--iris-surface)', 'border-bottom': bs() }}
        />
      </Show>
      <Show when={props.selectable === 'multi'}>
        <div
          role="columnheader"
          data-iris-table-header=""
          style={{
            ...BASE_CELL_STYLE,
            background: 'var(--iris-surface)',
            'border-bottom': bs(),
            'justify-content': 'center',
          }}
        >
          <IrisCheckbox
            checked={props.allSelected ? true : props.someSelected ? 'indeterminate' : false}
            onChange={props.toggleAll}
            aria-label={props.t('table.selectAll')}
          />
        </div>
      </Show>
      <Show when={props.selectable === 'single'}>
        <div
          role="columnheader"
          data-iris-table-header=""
          style={{
            ...BASE_CELL_STYLE,
            background: 'var(--iris-surface)',
            'border-bottom': bs(),
          }}
        />
      </Show>
      {props.columns.map((col, ci) => {
        const s = props.visibleColSet()
        if (s && !s.has(ci)) return null
        const isSortKey = props.sort?.key === col.key
        const dir = isSortKey ? props.sort?.direction : undefined
        return (
          <div
            role="columnheader"
            aria-sort={
              isSortKey
                ? dir === 'asc'
                  ? 'ascending'
                  : 'descending'
                : col.sortable
                  ? 'none'
                  : undefined
            }
            tabIndex={col.sortable ? 0 : undefined}
            onClick={col.sortable ? () => props.cycleSort(col) : undefined}
            onKeyDown={col.sortable ? (e) => props.onHeaderKeyDown(e, col) : undefined}
            data-iris-table-header={col.key}
            data-iris-table-pinned={col.pinned}
            data-sortable={col.sortable ? 'true' : undefined}
            data-sort-direction={dir}
            style={{
              ...BASE_CELL_STYLE,
              ...(s ? { 'grid-column-start': props.colTrack(ci) } : null),
              'justify-content':
                col.align === 'right'
                  ? 'flex-end'
                  : col.align === 'center'
                    ? 'center'
                    : 'flex-start',
              background: 'var(--iris-surface)',
              'border-bottom': bs(),
              cursor: col.sortable ? 'pointer' : 'default',
              'font-weight': 600,
              'user-select': col.sortable ? 'none' : 'auto',
              position: 'relative',
              ...(props.pinnedStyle(col.key)
                ? { ...props.pinnedStyle(col.key), background: 'var(--iris-surface)' }
                : null),
            }}
          >
            <span>{col.title}</span>
            {sortIndicator(col)}
            <Show when={props.resizableColumns}>
              <ColumnResizeHandle
                colKey={col.key}
                label={col.title}
                width={() => props.columnWidthFn(col.key)}
                minWidth={col.minWidth ?? 60}
                maxWidth={col.maxWidth ?? Infinity}
                onResize={props.setColumnWidth}
              />
            </Show>
          </div>
        )
      })}
    </div>
  )
}
