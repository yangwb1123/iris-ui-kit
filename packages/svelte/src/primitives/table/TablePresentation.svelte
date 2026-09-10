<script lang="ts">
  import { columnGridTrack, countLeadingGridTracks, resolveTableSortInfo } from '@iris-ui-kit/core'
  import IrisVirtualScroll from '../virtual-scroll/IrisVirtualScroll.svelte'
  import TableBodyRow from './TableBodyRow.svelte'
  import TableChrome from './TableChrome.svelte'
  import TableContextMenu from './TableContextMenu.svelte'
  import TableFilterPanel from './TableFilterPanel.svelte'
  import TableHeader from './TableHeader.svelte'
  import TableScrollTop from './TableScrollTop.svelte'
  import TableStateRow from './TableStateRow.svelte'
  import TableSummary from './TableSummary.svelte'
  import TableSortIndicator from './TableSortIndicator.svelte'
  import TableTabs from './TableTabs.svelte'
  import TableViews from './TableViews.svelte'
  import type { TablePresentationProps } from './table-presentation-types'
  import type { IrisTableColumn } from './types'

  let {
    rest,
    rootRef,
    style,
    keyboardNavigation,
    treeMode,
    cellRange,
    clipConfig,
    activeCellRange,
    copyActiveRange,
    handleRootKeyDown,
    dragEnabled,
    handleDragPointerMove,
    handleDragPointerUp,
    handleDragPointerCancel,
    columnVirtualization,
    responsive,
    responsiveOverflow,
    handleRootScroll,
    bordered,
    printable,
    scrollToTop,
    effectiveDensity,
    tableTabs,
    tableViews,
    views,
    formConfig,
    formDraft,
    setFormValue,
    handleFormSubmit,
    handleFormReset,
    toolbar,
    undo,
    undoController,
    selectable,
    displaySelection,
    refreshProxy,
    setProxyParams,
    hasProxy,
    pagerConfig,
    proxyState,
    proxyConfig,
    importPreview,
    densityToggle,
    cycleDensity,
    displayColumns,
    columnFade,
    grouped,
    headerMatrix,
    rowDrag,
    rowDragSnapshot,
    handleRowDragPointerDown,
    columnDrag,
    columnDragSnapshot,
    handleColumnDragPointerDown,
    seq,
    hasDetail,
    selection,
    allSelected,
    someSelected,
    toggleAll,
    multiSort,
    effectiveMultiSort,
    effectiveSort,
    sortingModel,
    sort,
    multiSortState,
    filterValues,
    filterController,
    leafColumns,
    contextMenu,
    bodyData,
    flatTree,
    virtualScroll,
    rowId,
    liveRowFor,
    isSelected,
    toggleRow,
    rowMode,
    rowEdit,
    editConfig,
    editingCellId,
    editingColumnKey,
    editingDraft,
    editError,
    pattern,
    patternFill,
    striped,
    spanPlan,
    visibleColSet,
    gridTemplate,
    resizableColumns,
    registerResizeHandle,
    effectiveWidths,
    onResizeHandleKeydown,
    pinnedDrag,
    pinnedBoundaryKey,
    pinOf,
    pinnedStyle,
    resolvePinnedCount,
    commitPinnedCount,
    loading,
    error,
    errorState,
    loadingState,
    emptyState,
    onRetry,
    seqStartIndex,
    seqMethod,
    renderDetail,
    onRowClick,
    isRowExpandable,
    expandedKeys,
    expansionToggle,
    lazyLoad,
    hasLazyChildren,
    lazyLoading,
    loadLazyChildren,
    getCellValue,
    beginEdit,
    setCellDraft,
    commitEdit,
    cancelEdit,
    startRange,
    extendRange,
    cellTabIndex,
    isInRange,
    setFocusedCell,
    formulaTables,
    editPreview,
    t,
  }: TablePresentationProps = $props()

  let rootEl = $state<HTMLDivElement | null>(null)
  $effect(() => {
    rootRef?.(rootEl)
  })
  $effect(() => () => rootRef?.(null))

  const showSelection = $derived(selectable !== 'none')
  const lead = $derived(
    countLeadingGridTracks({
      rowDrag: Boolean(rowDrag),
      sequence: seq,
      detail: hasDetail,
      selection: showSelection,
    }),
  )
  const tableLoading = $derived(hasProxy ? proxyState.loading : loading)
  const tableError = $derived(hasProxy ? proxyState.error !== null : error)
  const useVirtual = $derived(virtualScroll != null && !(treeMode && hasDetail))
  const stateRowStyle = 'padding: 32px 12px; text-align: center; color: var(--iris-muted)'

  function seqValue(index: number): string | number {
    if (seqMethod) return seqMethod({ rowIndex: index, columnIndex: 0 })
    if (hasProxy && proxyConfig?.seq && seq) {
      return (proxyState.params.page - 1) * proxyState.params.pageSize + index + 1
    }
    return index + seqStartIndex
  }

  function sortAria(col: IrisTableColumn): 'none' | 'ascending' | 'descending' | undefined {
    const info = resolveTableSortInfo(col.key, {
      multiSort,
      multiSortState: effectiveMultiSort,
      sort: effectiveSort,
    })
    if (!info.isActive) return col.sortable ? 'none' : undefined
    return info.direction === 'asc' ? 'ascending' : 'descending'
  }

  function handleHeaderClick(column: IrisTableColumn): void {
    if (multiSort) {
      if (!column.sortable) return
      if (multiSortState !== undefined) sortingModel.syncMultiSort(multiSortState ?? [])
      sortingModel.cycleMultiSort(column.key)
      return
    }
    if (!column.sortable) return
    if (sort !== undefined) sortingModel.syncSort(sort ?? null)
    sortingModel.cycleSort(column.key)
  }

  function handleHeaderKeyDown(event: KeyboardEvent, column: IrisTableColumn): void {
    if (!column.sortable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    handleHeaderClick(column)
  }

  function handleRetry(): void {
    refreshProxy()
    onRetry?.()
  }

  function colTrack(index: number): number {
    return columnGridTrack(index, lead)
  }
</script>

{#snippet sortIndicator(col: IrisTableColumn)}
  <TableSortIndicator
    column={col}
    {multiSort}
    multiSortState={effectiveMultiSort}
    sortState={effectiveSort}
  />
{/snippet}

<TableTabs tabs={tableTabs} activeKey={tableViews.activeTab} onApply={tableViews.applyTableTab} />
<TableViews
  config={views}
  views={tableViews.viewList}
  activeKey={tableViews.activeViewKey}
  onSelect={tableViews.selectView}
  onSave={tableViews.saveView}
  onDelete={tableViews.deleteView}
/>

<TableChrome
  config={formConfig}
  draft={formDraft}
  setValue={setFormValue}
  onSubmit={handleFormSubmit}
  onReset={handleFormReset}
  {toolbar}
  {undo}
  canUndo={undoController.canUndo()}
  canRedo={undoController.canRedo()}
  onUndo={undoController.undo}
  onRedo={undoController.redo}
  {selectable}
  selectedKeys={displaySelection}
  refresh={refreshProxy}
  enabled={hasProxy}
  {pagerConfig}
  snapshot={proxyState}
  setParams={setProxyParams}
  onPageChange={proxyConfig?.onPageChange}
  {importPreview}
  {densityToggle}
  {effectiveDensity}
  onDensityToggle={cycleDensity}
  {t}
/>

<div
  {...rest}
  bind:this={rootEl}
  role={keyboardNavigation ? (treeMode ? 'treegrid' : 'grid') : 'table'}
  data-iris-table
  data-density={effectiveDensity}
  data-printable={printable ? 'true' : undefined}
  data-iris-column-fade-active={columnFade.columnFadeActive ? 'true' : undefined}
  data-column-virtualized={columnVirtualization ? 'true' : undefined}
  onkeydown={keyboardNavigation || cellRange || clipConfig ? handleRootKeyDown : undefined}
  onpointermove={dragEnabled ? handleDragPointerMove : undefined}
  onpointerup={dragEnabled ? handleDragPointerUp : undefined}
  onpointercancel={dragEnabled ? handleDragPointerCancel : undefined}
  onpointerleave={dragEnabled ? handleDragPointerCancel : undefined}
  onscroll={columnVirtualization ? handleRootScroll : undefined}
  style="background: var(--iris-background); color: var(--iris-foreground); font-size: var(--iris-font-size-md, 14px); border: {bordered
    ? '1px solid var(--iris-border)'
    : 'none'}; border-radius: var(--iris-radius-md, 6px); overflow: {columnVirtualization ||
  responsiveOverflow
    ? 'auto'
    : 'hidden'};{responsiveOverflow ? ' overflow-x: auto;' : ''}{style ? ' ' + style : ''}"
>
  {#if clipConfig && clipConfig.copy !== false && activeCellRange()}
    <button type="button" data-iris-table-range-copy onclick={copyActiveRange}>
      {t('table.range.copy')}
    </button>
  {/if}

  <TableHeader
    columns={displayColumns}
    {columnFade}
    {grouped}
    {headerMatrix}
    {rowDrag}
    {columnDrag}
    {columnDragSnapshot}
    {handleColumnDragPointerDown}
    {seq}
    {hasDetail}
    {showSelection}
    {selectable}
    {selection}
    {allSelected}
    {someSelected}
    {toggleAll}
    {lead}
    {sortAria}
    {handleHeaderClick}
    {handleHeaderKeyDown}
    {sortIndicator}
    {gridTemplate}
    {visibleColSet}
    {colTrack}
    {resizableColumns}
    {registerResizeHandle}
    {effectiveWidths}
    {onResizeHandleKeydown}
    {pinnedDrag}
    {pinnedBoundaryKey}
    {pinOf}
    {pinnedStyle}
    {resolvePinnedCount}
    {commitPinnedCount}
    {filterValues}
    onFilterOpen={filterController.open}
    showAsterisk={editConfig?.showAsterisk === true}
    {t}
  />

  <TableContextMenu
    root={rootEl}
    config={contextMenu}
    columns={leafColumns}
    getRows={() => bodyData}
  />

  {#if filterController.openKey}
    {@const filterColumn = displayColumns.find((column) => column.key === filterController.openKey)}
    {#if filterColumn}
      <TableFilterPanel
        column={filterColumn}
        values={filterController.draft}
        onToggle={filterController.toggle}
        onApply={() => filterController.apply(filterColumn.key)}
        onClear={() => filterController.clear(filterColumn.key)}
        onClose={filterController.close}
        {t}
      />
    {/if}
  {/if}

  {#if tableError}
    <TableStateRow
      kind="error"
      style={stateRowStyle}
      {errorState}
      retryable={Boolean(onRetry || hasProxy)}
      onRetry={handleRetry}
      {t}
    />
  {:else if tableLoading}
    <TableStateRow kind="loading" style={stateRowStyle} {loadingState} retryable={false} {t} />
  {:else if bodyData.length === 0}
    <TableStateRow kind="empty" style={stateRowStyle} {emptyState} retryable={false} {t} />
  {:else if useVirtual}
    <IrisVirtualScroll
      data-iris-table-body=""
      items={bodyData}
      itemHeight={virtualScroll!.itemHeight}
      height={virtualScroll!.height}
      buffer={virtualScroll!.buffer}
      keyOf={(row, index) => rowId(row as Record<string, unknown>, index)}
    >
      {#snippet item({ item: row, index })}
        <!-- prettier-ignore -->
        <TableBodyRow row={row as Record<string, unknown>} {index} treeMeta={flatTree ? flatTree[index] : null} fillHeight {rowId} {liveRowFor} {isSelected} {rowMode} {rowEdit} {editConfig} {editingCellId} {editingColumnKey} {editingDraft} {editError} {pattern} {patternFill} {striped} {rowDrag} {rowDragSnapshot} {handleRowDragPointerDown} {seq} {seqValue} {hasDetail} {showSelection} {selectable} {toggleRow} {leafColumns} {visibleColSet} {spanPlan} {gridTemplate} {pinOf} {pinnedStyle} {columnFade} {keyboardNavigation} {cellRange} {cellTabIndex} {isInRange} {setFocusedCell} {expandedKeys} {expansionToggle} {isRowExpandable} {getCellValue} {beginEdit} {setCellDraft} {commitEdit} {cancelEdit} {startRange} {extendRange} {hasLazyChildren} {lazyLoad} {lazyLoading} {loadLazyChildren} {formulaTables} {editPreview} {colTrack} {onRowClick} {t} />
      {/snippet}
    </IrisVirtualScroll>
  {:else}
    <div role="rowgroup" data-iris-table-body>
      {#each bodyData as row, index}
        {@const id = rowId(row, index)}
        <!-- prettier-ignore -->
        <TableBodyRow {row} {index} treeMeta={flatTree ? flatTree[index] : null} fillHeight={false} {rowId} {liveRowFor} {isSelected} {rowMode} {rowEdit} {editConfig} {editingCellId} {editingColumnKey} {editingDraft} {editError} {pattern} {patternFill} {striped} {rowDrag} {rowDragSnapshot} {handleRowDragPointerDown} {seq} {seqValue} {hasDetail} {showSelection} {selectable} {toggleRow} {leafColumns} {visibleColSet} {spanPlan} {gridTemplate} {pinOf} {pinnedStyle} {columnFade} {keyboardNavigation} {cellRange} {cellTabIndex} {isInRange} {setFocusedCell} {expandedKeys} {expansionToggle} {isRowExpandable} {getCellValue} {beginEdit} {setCellDraft} {commitEdit} {cancelEdit} {startRange} {extendRange} {hasLazyChildren} {lazyLoad} {lazyLoading} {loadLazyChildren} {formulaTables} {editPreview} {colTrack} {onRowClick} {t} />
        {#if hasDetail && isRowExpandable(row, index) && expandedKeys.includes(String(id))}
          <div
            role="row"
            data-iris-table-row-detail={String(id)}
            style="display: grid; grid-template-columns: {gridTemplate()}"
          >
            <div
              role="cell"
              data-iris-table-detail-cell=""
              style="grid-column: 1 / -1; padding: 8px 12px; border-bottom: 1px solid var(--iris-border)"
            >
              {renderDetail?.(row, index)}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}{'  '}{#if !tableError && !tableLoading}
    <TableSummary
      {bodyData}
      {leafColumns}
      {columnFade}
      {rowDrag}
      {seq}
      {hasDetail}
      {showSelection}
      {visibleColSet}
      {pinOf}
      {pinnedStyle}
      {gridTemplate}
      {colTrack}
      {getCellValue}
    />
  {/if}

  <TableScrollTop
    root={rootEl}
    enabled={scrollToTop && !printable}
    hasVirtual={useVirtual}
    rows={bodyData.length}
    loading={tableLoading}
    error={tableError}
  />
</div>
{#if responsive && responsiveOverflow && !printable}
  <div
    data-iris-scroll-hint=""
    role="status"
    aria-live="polite"
    style="display: flex; align-items: center; gap: var(--iris-space-xxs, 4px); padding: var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px); color: var(--iris-muted); background: var(--iris-surface); border-inline: 1px solid var(--iris-border); border-bottom: 1px solid var(--iris-border); font-size: var(--iris-font-size-sm, 13px)"
  >
    <span aria-hidden="true">⇆</span>
    <span>{t('table.scrollHint')}</span>
  </div>
{/if}
