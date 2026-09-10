import * as React from 'react'
import { columnLetter, DEFAULT_COLUMN_MIN_WIDTH, resolveTableSortInfo } from '@iris-ui-kit/core'
import type { IrisTableSortDirection } from './types'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { TableFilterTrigger } from './filter-trigger'
import { ColumnResizeHandle, PinnedDragHandle } from './column-layout'
import { justifyFor } from './cell-helpers'
import type { FlatTableHeaderProps } from './table-header-types'

export function FlatTableHeader<Row extends Record<string, unknown>>(
  props: FlatTableHeaderProps<Row>,
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
    showHeader,
    grouped,
    responsiveDisplayColumns,
    visibleColSet,
    mergeHeaderCells,
    columnVirtualization,
    headerMergePlan,
    colTrack,
    currentColumnKey,
    setCurrentColumn,
    editShowAsterisk,
    resizableColumns,
    columnWidths,
    setColumnWidth,
    widthHint,
    autoResizeColumns,
    onAutoFitColumn,
  } = props
  return showHeader && !grouped ? (
    /* Header row (flat) */
    <div role="row" data-iris-table-row="header" style={{ display: 'grid', gridTemplateColumns }}>
      {rowDragEnabled ? (
        <div
          role="columnheader"
          data-iris-table-header="__drag"
          style={{
            ...baseCellStyle,
            background: 'var(--iris-surface)',
            borderBottom: borderStyle,
          }}
        />
      ) : null}
      {showRowNumbers ? (
        <div
          role="columnheader"
          data-iris-table-header={seq ? '__seq' : '__row-ref'}
          style={{
            ...baseCellStyle,
            background: 'var(--iris-surface)',
            borderBottom: borderStyle,
            justifyContent: 'center',
          }}
        />
      ) : null}
      {hasDetail ? (
        <div
          role="columnheader"
          data-iris-table-header="__expand"
          style={{
            ...baseCellStyle,
            background: 'var(--iris-surface)',
            borderBottom: borderStyle,
          }}
        />
      ) : null}
      {selectable === 'multi' ? (
        <div
          role="columnheader"
          data-iris-table-header=""
          style={{
            ...baseCellStyle,
            background: 'var(--iris-surface)',
            borderBottom: borderStyle,
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
            ...baseCellStyle,
            background: 'var(--iris-surface)',
            borderBottom: borderStyle,
          }}
        />
      ) : null}
      {responsiveDisplayColumns.map((col, ci) => {
        if (visibleColSet && !visibleColSet.has(ci)) return null
        // Header merge (batch P): covered cells render null; a merge
        // origin cell gets gridColumnEnd/gridRowEnd spans (row 0 only).
        // Fail-closed under columnVirtualization (JSDoc parity): the
        // visible-window track shift would misalign the spans.
        const mergeActive = !!mergeHeaderCells && !columnVirtualization
        if (mergeActive && headerMergePlan.occupied.has(`0:${ci}`)) return null
        const mergedCell = mergeActive ? headerMergePlan.byCol.get(ci) : undefined
        const sortInfo = resolveTableSortInfo(col.key, {
          multiSort,
          multiSortState,
          sort,
        })
        const multiIdx = multiSort ? sortInfo.multiIndex : -1
        const isSortKey = sortInfo.isActive
        const dir: IrisTableSortDirection | undefined = isSortKey
          ? (sortInfo.direction ?? undefined)
          : undefined
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
            onClick={
              col.sortable
                ? () => {
                    cycleHeaderSort(col)
                    setCurrentColumn(col)
                    // vxe header-click parity: informational — after the sort toggle.
                    onHeaderClick?.(col)
                  }
                : () => {
                    setCurrentColumn(col)
                    onHeaderClick?.(col)
                  }
            }
            onKeyDown={col.sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
            onContextMenu={columnPinMenu ? (e) => handleHeaderContextMenu(e, col) : undefined}
            data-iris-table-header={col.key}
            data-iris-table-pinned={pinOf(col)}
            data-iris-column-fade={columnFadeAttr(col)}
            data-iris-col-current={currentColumnKey === col.key ? 'true' : undefined}
            data-iris-col-drag-active={colDragActive === col.key ? 'true' : undefined}
            data-iris-col-drag-over={colDragOver === col.key ? 'true' : undefined}
            onPointerDown={columnDrag ? (e) => handleColDragPointerDown(e, col.key) : undefined}
            className={headerCellClassName?.(col)}
            title={headerTooltip(col)}
            data-sortable={col.sortable ? 'true' : undefined}
            data-sort-direction={dir}
            style={{
              ...baseCellStyle,
              ...(showHeaderOverflow ? null : cellOverflowOverride),
              ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
              ...(mergedCell && (mergedCell.colspan ?? 1) > 1
                ? { gridColumnEnd: `span ${mergedCell.colspan}` }
                : null),
              ...(mergedCell && (mergedCell.rowspan ?? 1) > 1
                ? { gridRowEnd: `span ${mergedCell.rowspan}` }
                : null),
              justifyContent: justifyFor(headerAlign ?? col.align ?? 'left'),
              background: 'var(--iris-surface)',
              borderBottom: borderStyle,
              cursor: col.sortable ? 'pointer' : 'default',
              fontWeight: 600,
              userSelect: col.sortable ? 'none' : 'auto',
              ...(headerCellStyle?.(col) ?? null),
              ...(columnFadeStyle(col) ?? null),
              ...(editShowAsterisk && col.editRules?.some((r) => r.required)
                ? { '::after': undefined }
                : {}),
              position: 'relative',
              // Pinned header keeps a solid surface bg + sticky position
              // (overrides position: relative above for the sticky edge).
              ...(pinnedStyle(col.key)
                ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                : null),
            }}
          >
            <span>
              {col.titlePrefix}
              {col.title}
              {col.titleSuffix}
            </span>
            {headerStats && headerStatsByKey[col.key] ? (
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
            {showCellRefs ? (
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
                {columnLetter(ci)}
              </span>
            ) : null}
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
            {col.filterable ? (
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
            {pinnedBoundaryCol && pinnedBoundaryCol.key === col.key ? (
              <PinnedDragHandle
                colKey={col.key}
                label={col.title}
                resolve={resolvePinnedCount}
                commit={commitPinnedCount}
              />
            ) : null}
            {resizableColumns && !(pinnedBoundaryCol && pinnedBoundaryCol.key === col.key) ? (
              <ColumnResizeHandle
                colKey={col.key}
                label={col.title}
                width={columnWidths[col.key]}
                minWidth={col.minWidth ?? DEFAULT_COLUMN_MIN_WIDTH}
                maxWidth={col.maxWidth ?? Infinity}
                onResize={setColumnWidth}
                widthHint={widthHint}
                onAutoFit={autoResizeColumns ? () => onAutoFitColumn?.(col) : undefined}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  ) : null
}
