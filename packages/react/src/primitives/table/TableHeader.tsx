import * as React from 'react'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortDirection,
  IrisTableSortState,
} from './types'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { ColumnResizeHandle } from './ColumnResizeHandle'
import { BASE_CELL_STYLE, borderStyle } from './styles'

interface TableHeaderProps<Row extends Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  leafColumns: IrisTableColumn<Row>[]
  grouped: boolean
  headerMatrix: Array<
    Array<{
      column: IrisTableColumn<Row>
      colStart: number
      colSpan: number
      rowSpan: number
      level: number
    }>
  > | null
  selectable: 'none' | 'single' | 'multi'
  hasDetail: boolean
  bordered: boolean
  t: (key: string, params?: Record<string, string | number>) => string
  gridTemplateColumns: string
  sort: IrisTableSortState | null
  cycleSort: (col: IrisTableColumn<Row>) => void
  onHeaderKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, col: IrisTableColumn<Row>) => void
  allSelected: boolean
  someSelected: boolean
  toggleAll: () => void
  resizableColumns?: boolean
  columnWidths: IrisTableColumnWidths
  setColumnWidth: (key: string, width: number) => void
  visibleColSet: Set<number> | null
  colTrack: (i: number) => number
  pinnedStyle: (key: string) => React.CSSProperties | null
}

export function TableHeader<Row extends Record<string, unknown>>({
  columns,
  grouped,
  headerMatrix,
  selectable,
  hasDetail,
  bordered,
  t,
  gridTemplateColumns,
  sort,
  cycleSort,
  onHeaderKeyDown,
  allSelected,
  someSelected,
  toggleAll,
  resizableColumns,
  columnWidths,
  setColumnWidth,
  visibleColSet,
  colTrack,
  pinnedStyle,
}: TableHeaderProps<Row>): React.ReactElement {
  const bs = borderStyle(bordered)

  if (grouped && headerMatrix) {
    return (
      <div
        role="row"
        data-iris-table-row="header"
        data-iris-table-header-grouped=""
        style={{
          display: 'grid',
          gridTemplateColumns,
          gridTemplateRows: `repeat(${headerMatrix.length}, auto)`,
        }}
      >
        {hasDetail ? (
          <div role="columnheader" style={{ gridColumn: '1', gridRow: '1 / -1' }} />
        ) : null}
        {selectable !== 'none' ? (
          <div
            role="columnheader"
            data-iris-table-header=""
            style={{
              gridColumn: hasDetail ? '2' : '1',
              gridRow: '1 / -1',
              ...BASE_CELL_STYLE,
              background: 'var(--iris-surface)',
              borderBottom: bs,
              justifyContent: 'center',
            }}
          >
            {selectable === 'multi' ? (
              <IrisCheckbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onChange={toggleAll}
                aria-label={t('table.selectAll')}
              />
            ) : null}
          </div>
        ) : null}
        {headerMatrix.flatMap((cells) =>
          cells.map((cell) => {
            const col = cell.column
            const isLeaf = !col.children || col.children.length === 0
            const sortable = isLeaf && col.sortable
            const isSortKey = sortable && sort?.key === col.key
            const dir: IrisTableSortDirection | undefined = isSortKey ? sort?.direction : undefined
            const lead = (hasDetail ? 1 : 0) + (selectable !== 'none' ? 1 : 0)
            return (
              <div
                key={`${col.key}-${cell.level}`}
                role="columnheader"
                data-iris-table-header={col.key}
                data-iris-table-header-group={isLeaf ? undefined : ''}
                aria-colspan={cell.colSpan}
                aria-sort={
                  isSortKey
                    ? dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : sortable
                      ? 'none'
                      : undefined
                }
                tabIndex={sortable ? 0 : undefined}
                onClick={sortable ? () => cycleSort(col) : undefined}
                onKeyDown={sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                style={{
                  gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
                  gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
                  ...BASE_CELL_STYLE,
                  justifyContent: isLeaf ? 'flex-start' : 'center',
                  background: 'var(--iris-surface)',
                  borderBottom: bs,
                  borderInlineEnd: isLeaf ? 'none' : bs,
                  cursor: sortable ? 'pointer' : 'default',
                  fontWeight: 600,
                  userSelect: sortable ? 'none' : 'auto',
                }}
              >
                <span>{col.title}</span>
                {sortable ? (
                  <span
                    aria-hidden="true"
                    data-iris-table-sort-indicator=""
                    style={{
                      marginInlineStart: 'var(--iris-space-xs, 8px)',
                      fontSize: 'var(--iris-font-size-xs, 12px)',
                      color: dir ? 'var(--iris-primary)' : 'var(--iris-muted)',
                    }}
                  >
                    {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
                  </span>
                ) : null}
              </div>
            )
          }),
        )}
      </div>
    )
  }

  // Flat header
  return (
    <div role="row" data-iris-table-row="header" style={{ display: 'grid', gridTemplateColumns }}>
      {hasDetail ? (
        <div
          role="columnheader"
          data-iris-table-header="__expand"
          style={{ ...BASE_CELL_STYLE, background: 'var(--iris-surface)', borderBottom: bs }}
        />
      ) : null}
      {selectable === 'multi' ? (
        <div
          role="columnheader"
          data-iris-table-header=""
          style={{
            ...BASE_CELL_STYLE,
            background: 'var(--iris-surface)',
            borderBottom: bs,
            justifyContent: 'center',
          }}
        >
          <IrisCheckbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onChange={toggleAll}
            aria-label={t('table.selectAll')}
          />
        </div>
      ) : selectable === 'single' ? (
        <div
          role="columnheader"
          data-iris-table-header=""
          style={{
            ...BASE_CELL_STYLE,
            background: 'var(--iris-surface)',
            borderBottom: bs,
          }}
        />
      ) : null}
      {columns.map((col, ci) => {
        if (visibleColSet && !visibleColSet.has(ci)) return null
        const isSortKey = sort?.key === col.key
        const dir: IrisTableSortDirection | undefined = isSortKey ? sort?.direction : undefined
        return (
          <div
            key={col.key}
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
            onClick={col.sortable ? () => cycleSort(col) : undefined}
            onKeyDown={col.sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
            data-iris-table-header={col.key}
            data-iris-table-pinned={col.pinned}
            data-sortable={col.sortable ? 'true' : undefined}
            data-sort-direction={dir}
            style={{
              ...BASE_CELL_STYLE,
              ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
              justifyContent:
                col.align === 'right'
                  ? 'flex-end'
                  : col.align === 'center'
                    ? 'center'
                    : 'flex-start',
              background: 'var(--iris-surface)',
              borderBottom: bs,
              cursor: col.sortable ? 'pointer' : 'default',
              fontWeight: 600,
              userSelect: col.sortable ? 'none' : 'auto',
              position: 'relative',
              ...(pinnedStyle(col.key)
                ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                : null),
            }}
          >
            <span>{col.title}</span>
            {col.sortable ? (
              <span
                aria-hidden="true"
                data-iris-table-sort-indicator=""
                style={{
                  marginInlineStart: 'var(--iris-space-xs, 8px)',
                  fontSize: 'var(--iris-font-size-xs, 12px)',
                  color: dir ? 'var(--iris-primary)' : 'var(--iris-muted)',
                }}
              >
                {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
              </span>
            ) : null}
            {resizableColumns ? (
              <ColumnResizeHandle
                colKey={col.key}
                label={col.title}
                width={columnWidths[col.key]}
                minWidth={col.minWidth ?? 60}
                maxWidth={col.maxWidth ?? Infinity}
                onResize={setColumnWidth}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
