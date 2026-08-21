<script lang="ts">
  import type { HeaderCell, I18n } from '@iris-ui-kit/core'
  import type { Snippet } from 'svelte'
  import TableDragSpacer from './TableDragSpacer.svelte'
  import PinnedDragHandle from './PinnedDragHandle.svelte'
  import { tableColumnDrag } from './table-drag-actions'
  import { resolveInitialWidth, TABLE_CONST } from './tableUtils'
  import type { IrisTableColumn, IrisTableColumnWidths, IrisTableFilterValues } from './types'

  type Translate = I18n['t']
  type HeaderMatrix = HeaderCell<IrisTableColumn>[][]

  let {
    columns,
    grouped,
    headerMatrix,
    rowDrag,
    columnDrag,
    columnDragSnapshot,
    handleColumnDragPointerDown,
    seq,
    hasDetail,
    showSelection,
    selectable,
    selection,
    allSelected,
    someSelected,
    toggleAll,
    lead,
    sortAria,
    handleHeaderClick,
    handleHeaderKeyDown,
    sortIndicator,
    gridTemplate,
    visibleColSet,
    colTrack,
    resizableColumns,
    registerResizeHandle,
    effectiveWidths,
    onResizeHandleKeydown,
    filterValues,
    onFilterOpen,
    showAsterisk,
    pinnedDrag,
    pinnedBoundaryKey,
    resolvePinnedCount,
    commitPinnedCount,
    t,
  }: {
    columns: IrisTableColumn[]
    grouped: boolean
    headerMatrix: HeaderMatrix | null
    rowDrag: unknown
    columnDrag: unknown
    columnDragSnapshot: { activeId: string | null; overId: string | null }
    handleColumnDragPointerDown: (event: PointerEvent, key: string) => void
    seq: boolean
    hasDetail: boolean
    showSelection: boolean
    selectable: 'none' | 'single' | 'multi'
    selection: Array<string | number> | undefined
    allSelected: boolean
    someSelected: boolean
    toggleAll: () => void
    lead: number
    sortAria: (column: IrisTableColumn) => 'none' | 'ascending' | 'descending' | undefined
    handleHeaderClick: (column: IrisTableColumn) => void
    handleHeaderKeyDown: (event: KeyboardEvent, column: IrisTableColumn) => void
    sortIndicator: Snippet<[IrisTableColumn]>
    gridTemplate: () => string
    visibleColSet: Set<number> | null
    colTrack: (index: number) => number
    resizableColumns: boolean
    registerResizeHandle: (node: HTMLElement, key: string) => { destroy: () => void }
    effectiveWidths: IrisTableColumnWidths
    onResizeHandleKeydown: (event: KeyboardEvent, column: IrisTableColumn) => void
    filterValues: IrisTableFilterValues
    onFilterOpen: (key: string) => void
    showAsterisk: boolean
    pinnedDrag: boolean
    pinnedBoundaryKey: string | null
    resolvePinnedCount: (dx: number) => number
    commitPinnedCount: (count: number) => void
    t: Translate
  } = $props()
</script>

{#snippet filterTrigger(col: IrisTableColumn)}
  {#if col.filterable && !col.children && (col.filterOptions?.length ?? 0) > 0}
    <button
      type="button"
      data-iris-filter-trigger={col.key}
      data-iris-filter-active={filterValues[col.key]?.length ? 'true' : undefined}
      aria-label={`${t('table.filter')}: ${col.title}`}
      onclick={(event) => {
        event.stopPropagation()
        onFilterOpen(col.key)
      }}
      style="margin-inline-start: var(--iris-space-xxs, 4px); border: 0; background: transparent; color: {filterValues[
        col.key
      ]?.length
        ? 'var(--iris-primary)'
        : 'var(--iris-muted)'}; cursor: pointer; padding: 0; font: inherit">⌄</button
    >
  {/if}
{/snippet}

{#snippet headerTitle(col: IrisTableColumn)}
  {col.title}
  {#if showAsterisk && col.editRules?.some((rule) => rule.required)}
    <span aria-hidden="true" style="margin-inline-start: 2px; color: var(--iris-danger)">*</span>
  {/if}
{/snippet}

{#if grouped && headerMatrix}
  <div
    role="row"
    data-iris-table-row="header"
    data-iris-table-header-grouped=""
    style="display: grid; grid-template-columns: {gridTemplate()}; grid-template-rows: repeat({headerMatrix.length}, auto)"
  >
    {#if rowDrag}
      <TableDragSpacer
        role="columnheader"
        header
        style="grid-column: 1; grid-row: 1 / -1; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      />
    {/if}
    {#if seq}
      <div
        role="columnheader"
        data-iris-table-header="__seq"
        style="grid-column: {(rowDrag ? 1 : 0) +
          1}; grid-row: 1 / -1; display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      ></div>
    {/if}
    {#if hasDetail}
      <div
        role="columnheader"
        style="grid-column: {seq
          ? (rowDrag ? 1 : 0) + 2
          : (rowDrag ? 1 : 0) +
            1}; grid-row: 1 / -1; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      ></div>
    {/if}
    {#if showSelection}
      <div
        role="columnheader"
        style="grid-column: {(rowDrag ? 1 : 0) +
          (seq ? 1 : 0) +
          (hasDetail
            ? 2
            : 1)}; grid-row: 1 / -1; display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      >
        {#if selectable === 'multi'}
          <input
            type="checkbox"
            checked={allSelected}
            indeterminate={someSelected}
            onchange={toggleAll}
            aria-label={t('table.selectAll')}
          />
          {#if selection && selection.length > 0}
            <span
              data-iris-table-selected-count=""
              style="margin-inline-start: var(--iris-space-xs, 8px); font-size: var(--iris-font-size-sm, 13px); color: var(--iris-muted); white-space: nowrap"
            >
              {t('table.selectedCount', { count: String(selection.length) })}
            </span>
          {/if}
        {/if}
      </div>
    {/if}
    {#each headerMatrix as rowCells}
      {#each rowCells as cell}
        {@const col = cell.column}
        <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
        {@const isGroup = !!(col.children && col.children.length > 0)}
        {@const sortable = !isGroup && col.sortable}
        <div
          role="columnheader"
          data-iris-table-header={col.key}
          data-iris-table-header-group={isGroup ? '' : undefined}
          use:tableColumnDrag={{
            key: col.key,
            enabled: !isGroup && columnDrag !== undefined,
            active: columnDragSnapshot.activeId === col.key,
            over: columnDragSnapshot.overId === col.key,
            onPointerDown: handleColumnDragPointerDown,
          }}
          aria-colspan={cell.colSpan}
          onclick={sortable ? () => handleHeaderClick(col) : undefined}
          onkeydown={sortable ? (event) => handleHeaderKeyDown(event, col) : undefined}
          tabindex={sortable ? 0 : undefined}
          aria-sort={sortable ? sortAria(col) : undefined}
          style="position: relative; display: flex; align-items: center; justify-content: {isGroup
            ? 'center'
            : col.align === 'right'
              ? 'flex-end'
              : col.align === 'center'
                ? 'center'
                : 'flex-start'}; grid-column: {lead +
            cell.colStart} / span {cell.colSpan}; grid-row: {cell.level +
            1} / span {cell.rowSpan}; padding: 8px var(--iris-padding-md, 12px); cursor: {sortable
            ? 'pointer'
            : columnDrag && !isGroup
              ? 'grab'
              : 'default'}; user-select: {sortable
            ? 'none'
            : 'auto'}; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border); font-weight: 600; font-size: var(--iris-font-size-md, 14px); color: var(--iris-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
        >
          {@render headerTitle(col)}
          {@render sortIndicator(col)}
          {@render filterTrigger(col)}
          {#if !isGroup && pinnedDrag && pinnedBoundaryKey === col.key}
            <PinnedDragHandle
              colKey={col.key}
              label={col.title}
              {resolvePinnedCount}
              {commitPinnedCount}
            />
          {/if}
        </div>
      {/each}
    {/each}
  </div>
{:else}
  <div
    role="row"
    data-iris-table-header-row
    style="display: grid; grid-template-columns: {gridTemplate()}"
  >
    {#if rowDrag}
      <TableDragSpacer
        role="columnheader"
        header
        style="display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      />
    {/if}
    {#if seq}
      <div
        role="columnheader"
        data-iris-table-header="__seq"
        style="display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      ></div>
    {/if}
    {#if hasDetail}
      <div
        role="columnheader"
        data-iris-table-header="__expand"
        style="display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      ></div>
    {/if}
    {#if showSelection}
      <div
        role="columnheader"
        style="display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
      >
        {#if selectable === 'multi'}
          <input
            type="checkbox"
            checked={allSelected}
            indeterminate={someSelected}
            onchange={toggleAll}
            aria-label={t('table.selectAll')}
          />
          {#if selection && selection.length > 0}
            <span
              data-iris-table-selected-count=""
              style="margin-inline-start: var(--iris-space-xs, 8px); font-size: var(--iris-font-size-sm, 13px); color: var(--iris-muted); white-space: nowrap"
            >
              {t('table.selectedCount', { count: String(selection.length) })}
            </span>
          {/if}
        {/if}
      </div>
    {/if}
    {#each columns as col, ci}
      {#if !visibleColSet || visibleColSet.has(ci)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          role="columnheader"
          data-iris-table-header={col.key}
          data-iris-table-pinned={col.pinned}
          use:tableColumnDrag={{
            key: col.key,
            enabled: columnDrag !== undefined,
            active: columnDragSnapshot.activeId === col.key,
            over: columnDragSnapshot.overId === col.key,
            onPointerDown: handleColumnDragPointerDown,
          }}
          onclick={col.sortable ? () => handleHeaderClick(col) : undefined}
          onkeydown={col.sortable ? (event) => handleHeaderKeyDown(event, col) : undefined}
          tabindex={col.sortable ? 0 : undefined}
          aria-sort={sortAria(col)}
          style="position: relative; display: flex; align-items: center; justify-content: {col.align ===
          'right'
            ? 'flex-end'
            : col.align === 'center'
              ? 'center'
              : 'flex-start'};{visibleColSet
            ? ` grid-column-start: ${colTrack(ci)};`
            : ''} padding: 8px var(--iris-padding-md, 12px); cursor: {col.sortable
            ? 'pointer'
            : columnDrag
              ? 'grab'
              : 'default'}; user-select: {col.sortable
            ? 'none'
            : 'auto'}; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border); font-weight: 600; font-size: var(--iris-font-size-md, 14px); color: var(--iris-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
        >
          {@render headerTitle(col)}
          {@render sortIndicator(col)}
          {@render filterTrigger(col)}
          {#if resizableColumns && !(pinnedDrag && pinnedBoundaryKey === col.key)}
            <span
              use:registerResizeHandle={col.key}
              role="slider"
              aria-orientation="horizontal"
              aria-label={t('table.resizeColumn', { column: col.title })}
              aria-valuenow={effectiveWidths[col.key] ?? resolveInitialWidth(col)}
              aria-valuemin={col.minWidth ?? TABLE_CONST.DEFAULT_MIN_WIDTH}
              aria-valuemax={col.maxWidth ?? 10_000}
              tabindex="0"
              data-iris-table-resize-handle=""
              data-column-key={col.key}
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => onResizeHandleKeydown(e, col)}
              style="position: absolute; top: 0; right: 0; bottom: 0; width: 6px; border: 0; padding: 0; background: transparent; cursor: col-resize; touch-action: none; user-select: none; z-index: 1"
            ></span>
          {/if}
          {#if pinnedDrag && pinnedBoundaryKey === col.key}
            <PinnedDragHandle
              colKey={col.key}
              label={col.title}
              {resolvePinnedCount}
              {commitPinnedCount}
            />
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
