import * as React from 'react'
import { columnLetter, resolveTableSortInfo } from '@iris-ui-kit/core'
import type { IrisTableSortDirection } from './types'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { TableFilterTrigger } from './filter-trigger'
import { PinnedDragHandle } from './column-layout'
import { justifyFor } from './cell-helpers'
import type { GroupedTableHeaderProps } from './table-header-types'

export function GroupedTableHeader<Row extends Record<string, unknown>>(
  props: GroupedTableHeaderProps<Row>,
): React.ReactElement | null {
  const {
    gridTemplateColumns,
    borderStyle,
    baseCellStyle,
    cellOverflowOverride,
    rowDragEnabled,
    showRowNumbers,
    seq,
    hasDetail,
    selectable,
    allSelected,
    someSelected,
    displaySelection,
    toggleAll,
    t,
    headerAlign,
    headerCellClassName,
    headerCellStyle,
    headerTooltip,
    columnFadeAttr,
    columnFadeStyle,
    pinOf,
    pinnedStyle,
    showHeaderOverflow,
    columnDrag,
    handleColDragPointerDown,
    colDragActive,
    colDragOver,
    cycleHeaderSort,
    onHeaderClick,
    onHeaderKeyDown,
    columnPinMenu,
    handleHeaderContextMenu,
    multiSort,
    multiSortState,
    sort,
    showCellRefs,
    headerStats,
    headerStatsByKey,
    filterValues,
    filterPanelOpenKey,
    openFilterPanel,
    pinnedBoundaryCol,
    resolvePinnedCount,
    commitPinnedCount,
    utilityTrack,
    showHeader,
    grouped,
    headerMatrix,
    leadingTrackCount,
  } = props
  return showHeader && grouped && headerMatrix && utilityTrack ? (
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
      {rowDragEnabled ? (
        <div
          role="columnheader"
          data-iris-table-header="__drag"
          style={{ gridColumn: String(utilityTrack('rowDrag')), gridRow: '1 / -1' }}
        />
      ) : null}
      {showRowNumbers ? (
        <div
          role="columnheader"
          data-iris-table-header={seq ? '__seq' : '__row-ref'}
          style={{
            gridColumn: String(utilityTrack('sequence')),
            gridRow: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            background: 'var(--iris-surface)',
            borderBottom: borderStyle,
          }}
        />
      ) : null}
      {hasDetail ? (
        <div
          role="columnheader"
          style={{
            gridColumn: String(utilityTrack('detail')),
            gridRow: '1 / -1',
          }}
        />
      ) : null}
      {selectable !== 'none' ? (
        <div
          role="columnheader"
          data-iris-table-header=""
          style={{
            gridColumn: String(utilityTrack('selection')),
            gridRow: '1 / -1',
            ...baseCellStyle,
            background: 'var(--iris-surface)',
            borderBottom: borderStyle,
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
          {selectable === 'multi' && displaySelection.length > 0 ? (
            <span
              data-iris-table-selected-count=""
              style={{
                marginInlineStart: 'var(--iris-space-xs, 8px)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                color: 'var(--iris-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {t('table.selectedCount', { count: String(displaySelection.length) })}
            </span>
          ) : null}
        </div>
      ) : null}
      {headerMatrix.flatMap((cells) =>
        cells.map((cell) => {
          const col = cell.column
          const isLeaf = !col.children || col.children.length === 0
          const sortable = isLeaf && col.sortable
          const sortInfo = resolveTableSortInfo(col.key, {
            multiSort,
            multiSortState,
            sort,
          })
          const multiIdx = multiSort && sortable ? sortInfo.multiIndex : -1
          const isSortKey = sortable && sortInfo.isActive
          const dir: IrisTableSortDirection | undefined = isSortKey
            ? (sortInfo.direction ?? undefined)
            : undefined
          const lead = leadingTrackCount
          return (
            <div
              key={`${col.key}-${cell.level}`}
              role="columnheader"
              data-iris-table-header={col.key}
              data-iris-table-header-group={isLeaf ? undefined : ''}
              data-iris-table-pinned={isLeaf ? pinOf(col) : undefined}
              data-iris-column-fade={columnFadeAttr(col)}
              data-iris-col-drag-active={colDragActive === col.key ? 'true' : undefined}
              data-iris-col-drag-over={colDragOver === col.key ? 'true' : undefined}
              className={headerCellClassName?.(col)}
              title={headerTooltip(col)}
              onPointerDown={
                columnDrag && isLeaf ? (e) => handleColDragPointerDown(e, col.key) : undefined
              }
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
              onClick={
                sortable
                  ? () => {
                      cycleHeaderSort(col)
                      // vxe header-click parity: informational — after the sort toggle.
                      onHeaderClick?.(col)
                    }
                  : () => onHeaderClick?.(col)
              }
              onKeyDown={sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
              onContextMenu={
                columnPinMenu && isLeaf ? (e) => handleHeaderContextMenu(e, col) : undefined
              }
              style={{
                gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
                gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
                ...baseCellStyle,
                ...(showHeaderOverflow ? null : cellOverflowOverride),
                justifyContent: isLeaf
                  ? justifyFor(headerAlign ?? col.align ?? 'left')
                  : justifyFor(headerAlign ?? 'center'),
                background: 'var(--iris-surface)',
                borderBottom: borderStyle,
                borderInlineEnd: isLeaf ? 'none' : borderStyle,
                cursor: sortable ? 'pointer' : 'default',
                fontWeight: 600,
                userSelect: sortable ? 'none' : 'auto',
                ...(headerCellStyle?.(col) ?? null),
                ...(columnFadeStyle(col) ?? null),
                position: isLeaf ? 'relative' : undefined,
                // Pinned leaf header keeps a solid surface bg + sticky
                // position (flat-header precedent; group cells never pin).
                ...(isLeaf && pinnedStyle(col.key)
                  ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                  : null),
              }}
            >
              <span>
                {col.titlePrefix}
                {col.title}
                {col.titleSuffix}
              </span>
              {headerStats && isLeaf && headerStatsByKey[col.key] ? (
                <span
                  data-iris-header-stats=""
                  aria-label={`count ${headerStatsByKey[col.key]!.count}, average ${headerStatsByKey[col.key]!.average.toFixed(2)}`}
                  style={{
                    marginInlineStart: 'var(--iris-space-xxs, 4px)',
                    fontSize: 'var(--iris-font-size-xs, 12px)',
                    color: 'var(--iris-muted)',
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`n=${headerStatsByKey[col.key]!.count} · avg=${headerStatsByKey[col.key]!.average.toFixed(2)}`}
                </span>
              ) : null}
              {showCellRefs && isLeaf ? (
                <span
                  aria-hidden="true"
                  data-iris-cell-ref=""
                  style={{
                    marginInlineStart: 'var(--iris-space-xxs, 4px)',
                    fontSize: 'var(--iris-font-size-xs, 12px)',
                    color: 'var(--iris-muted)',
                    fontWeight: 400,
                  }}
                >
                  {columnLetter(cell.colStart - 1)}
                </span>
              ) : null}
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
              {isLeaf ? (
                <TableFilterTrigger
                  column={col}
                  active={(filterValues?.[col.key]?.length ?? 0) > 0}
                  expanded={filterPanelOpenKey === col.key}
                  ariaLabel={t('table.filter')}
                  onOpen={openFilterPanel}
                />
              ) : null}
              {/* Multi mode: non-primary sort columns show their click-order
                      sequence number (vxe sort-config sequence parity). */}
              {multiSort && multiIdx > 0 ? (
                <span
                  data-iris-sort-seq=""
                  style={{
                    marginInlineStart: 'var(--iris-space-xxs, 4px)',
                    fontSize: 'var(--iris-font-size-xs, 12px)',
                    color: 'var(--iris-muted)',
                  }}
                >
                  {multiIdx + 1}
                </span>
              ) : null}
              {isLeaf && pinnedBoundaryCol && pinnedBoundaryCol.key === col.key ? (
                <PinnedDragHandle
                  colKey={col.key}
                  label={col.title}
                  resolve={resolvePinnedCount}
                  commit={commitPinnedCount}
                />
              ) : null}
            </div>
          )
        }),
      )}
    </div>
  ) : null
}
