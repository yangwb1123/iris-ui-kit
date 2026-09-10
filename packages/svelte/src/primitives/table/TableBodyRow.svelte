<script lang="ts">
  import { tableDisplayText, type GridSpanPlan, type I18n, type TreeRow } from '@iris-ui-kit/core'
  import type { Snippet } from 'svelte'
  import TableCellEditor from './TableCellEditor.svelte'
  import TableDragHandle from './TableDragHandle.svelte'
  import { handleTableRowKeyDown } from './table-events'
  import { cellId, editPreviewText, isEditableColumn } from './tableUtils'
  import type { IrisTableProps } from './props'
  import type { TableColumnFadeController } from './table-column-fade.svelte'
  import type { TableRowEditController, TableRowEditSession } from './table-row-edit.svelte'
  import type { IrisTableColumn } from './types'

  type RowSnippet = Snippet<[Record<string, unknown>]>
  type Translate = I18n['t']

  let {
    row,
    index,
    treeMeta,
    fillHeight,
    rowId,
    liveRowFor,
    isSelected,
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
    rowDrag,
    rowDragSnapshot,
    handleRowDragPointerDown,
    seq,
    seqValue,
    hasDetail,
    showSelection,
    selectable,
    toggleRow,
    leafColumns,
    visibleColSet,
    spanPlan,
    gridTemplate,
    pinOf,
    pinnedStyle,
    columnFade,
    keyboardNavigation,
    cellRange,
    cellTabIndex,
    isInRange,
    setFocusedCell,
    expansionToggle,
    expandedKeys,
    isRowExpandable,
    getCellValue,
    beginEdit,
    setCellDraft,
    commitEdit,
    cancelEdit,
    startRange,
    extendRange,
    hasLazyChildren,
    lazyLoad,
    lazyLoading,
    loadLazyChildren,
    formulaTables,
    editPreview,
    colTrack,
    onRowClick,
    t,
  }: {
    row: Record<string, unknown>
    index: number
    treeMeta: TreeRow<Record<string, unknown>> | null
    fillHeight: boolean
    rowId: (row: Record<string, unknown>, index: number) => string | number
    liveRowFor: (row: Record<string, unknown>, index: number) => Record<string, unknown>
    isSelected: (id: string | number) => boolean
    rowMode: boolean
    rowEdit: TableRowEditController
    editConfig: IrisTableProps['editConfig']
    editingCellId: string | null
    editingColumnKey: string | null
    editingDraft: string
    editError: string | null
    pattern: boolean
    patternFill: boolean
    striped: boolean
    rowDrag: IrisTableProps['rowDrag']
    rowDragSnapshot: { activeId: string | null; overId: string | null }
    handleRowDragPointerDown: (event: PointerEvent, id: string) => void
    seq: boolean
    seqValue: (index: number) => string | number
    hasDetail: boolean
    showSelection: boolean
    selectable: 'none' | 'single' | 'multi'
    toggleRow: (id: string | number) => void
    leafColumns: IrisTableColumn[]
    visibleColSet: Set<number> | null
    spanPlan: GridSpanPlan | null
    gridTemplate: () => string
    pinOf: (column: IrisTableColumn) => 'left' | 'right' | null
    pinnedStyle: (key: string) => string
    columnFade: TableColumnFadeController
    keyboardNavigation: boolean
    cellRange: boolean
    cellTabIndex: (row: number, col: number) => number
    isInRange: (row: number, col: number) => boolean
    setFocusedCell: (cell: { row: number; col: number }) => void
    expansionToggle: (key: string) => void
    expandedKeys: string[]
    isRowExpandable: (row: Record<string, unknown>, index: number) => boolean
    getCellValue: (row: Record<string, unknown>, column: IrisTableColumn) => unknown
    beginEdit: (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowId: string | number,
    ) => void
    setCellDraft: (value: string) => void
    commitEdit: (row: Record<string, unknown>, column: IrisTableColumn, rowIndex: number) => void
    cancelEdit: () => void
    startRange: (row: number, col: number) => void
    extendRange: (row: number, col: number) => void
    hasLazyChildren: (row: Record<string, unknown>, key: string) => boolean
    lazyLoad: IrisTableProps['lazyLoad']
    lazyLoading: Set<string>
    loadLazyChildren: (
      row: Record<string, unknown>,
      key: string,
      effectiveKey: string | number,
    ) => void
    formulaTables: IrisTableProps['formulaTables']
    editPreview: boolean
    colTrack: (index: number) => number
    onRowClick: IrisTableProps['onRowClick']
    t: Translate
  } = $props()

  const id = $derived(rowId(row, index))
  const renderedRow = $derived(liveRowFor(row, index))
  const selected = $derived(isSelected(id))
  const rowEditing = $derived(rowMode && rowEdit.active?.key === id)
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  role="row"
  aria-selected={selectable !== 'none' ? selected : undefined}
  data-iris-table-row
  data-iris-table-row-key={String(id)}
  data-iris-table-row-index={index}
  data-iris-row-editing={rowEditing ? 'true' : undefined}
  data-state={selected ? 'selected' : undefined}
  aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
  aria-setsize={treeMeta ? treeMeta.setSize : undefined}
  aria-posinset={treeMeta ? treeMeta.posInset : undefined}
  onclick={onRowClick ? () => onRowClick(renderedRow, index) : undefined}
  onkeydown={onRowClick
    ? (event) => handleTableRowKeyDown(event, renderedRow, index, onRowClick)
    : undefined}
  tabindex={onRowClick ? 0 : undefined}
  style="display: grid; grid-template-columns: {gridTemplate()};{fillHeight
    ? ' height: 100%;'
    : ''} background: {selected
    ? 'var(--iris-surface-selected)'
    : rowEditing
      ? 'var(--iris-surface-selected)'
      : striped && index % 2 === 1
        ? 'var(--iris-surface)'
        : 'var(--iris-row-bg, transparent)'}; transition: background-color var(--iris-transition-fast, 150ms) ease{columnFade.columnFadeActive
    ? ', grid-template-columns var(--iris-duration-md, 200ms) ease'
    : ''}; cursor: default"
>
  {#if rowDrag}
    <TableDragHandle
      id={String(id)}
      active={rowDragSnapshot.activeId === String(id)}
      over={rowDragSnapshot.overId === String(id)}
      onPress={(event) => handleRowDragPointerDown(event, String(id))}
    />
  {/if}
  {#if seq}
    <div
      role="cell"
      data-iris-table-cell="__seq"
      style="display: flex; align-items: center; justify-content: center; padding: 8px; font-size: var(--iris-font-size-md, 14px); border-bottom: 1px solid var(--iris-border); color: var(--iris-muted); user-select: none"
    >
      {seqValue(index)}
    </div>
  {/if}
  {#if hasDetail}
    <div
      role="cell"
      data-iris-table-cell="__expand"
      style="display: flex; align-items: center; justify-content: center; padding: 8px; font-size: var(--iris-font-size-md, 14px); border-bottom: 1px solid var(--iris-border)"
    >
      {#if isRowExpandable(row, index)}
        <button
          type="button"
          data-iris-table-expand-toggle=""
          aria-expanded={expandedKeys.includes(String(id))}
          aria-label={t(
            expandedKeys.includes(String(id)) ? 'treeSelect.collapse' : 'treeSelect.expand',
          )}
          onclick={(e) => {
            e.stopPropagation()
            expansionToggle(String(id))
          }}
          style="border: none; background: transparent; cursor: pointer; padding: 0; font: inherit; color: var(--iris-foreground); transform: {expandedKeys.includes(
            String(id),
          )
            ? 'rotate(90deg)'
            : 'none'}; transition: transform 150ms">▶</button
        >
      {/if}
    </div>
  {/if}
  {#if showSelection}
    <div
      role="cell"
      style="display: flex; align-items: center; justify-content: center; padding: 8px; border-bottom: 1px solid var(--iris-border)"
    >
      <input
        type="checkbox"
        checked={selected}
        onchange={() => toggleRow(id)}
        onclick={(e) => e.stopPropagation()}
        aria-label={t('table.selectRow', { key: id })}
      />
    </div>
  {/if}
  {#each leafColumns as col, ci}
    {#if !visibleColSet || visibleColSet.has(ci)}
      {@const pin = pinOf(col)}
      {@const spanKey = `${index}:${ci}`}
      {@const spanEntry = spanPlan?.spans.get(spanKey)}
      {@const spanCovered = spanPlan ? spanPlan.occupied.has(spanKey) : false}
      {@const editId = cellId(id, col.key)}
      {@const rowSession = rowMode ? rowEdit.session(editId) : undefined}
      {@const isEditing = rowSession !== undefined || (!rowMode && editingCellId === editId)}
      {@const patternHint =
        (pattern || patternFill) &&
        !rowMode &&
        editingColumnKey === col.key &&
        !isEditing &&
        editingDraft !== '' &&
        String(getCellValue(renderedRow, col) ?? '') === editingDraft}
      {#if !spanCovered}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          role="cell"
          data-iris-table-cell={col.key}
          data-iris-table-pinned={pin}
          {...columnFade.columnFadeAttrs(col)}
          data-editable={isEditableColumn(col) ? '' : undefined}
          data-editing={isEditing ? '' : undefined}
          data-iris-input-hint={patternHint ? 'true' : undefined}
          data-grid-row={keyboardNavigation ? index : undefined}
          data-grid-col={keyboardNavigation ? ci : undefined}
          data-iris-cell-row={cellRange ? index : undefined}
          data-iris-cell-col={cellRange ? ci : undefined}
          data-iris-cell-selected={cellRange && isInRange(index, ci) ? 'true' : undefined}
          tabindex={keyboardNavigation ? cellTabIndex(index, ci) : undefined}
          onfocus={keyboardNavigation ? () => setFocusedCell({ row: index, col: ci }) : undefined}
          onclick={rowMode && editConfig?.trigger !== 'manual'
            ? () => rowEdit.handleCellClick(renderedRow, col, index, id)
            : cellRange
              ? (e: MouseEvent) => {
                  if (e.shiftKey) {
                    extendRange(index, ci)
                  } else {
                    startRange(index, ci)
                  }
                }
              : editConfig?.trigger === 'click' && isEditableColumn(col)
                ? () => beginEdit(renderedRow, col, id)
                : undefined}
          onkeydown={cellRange
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                if (event.shiftKey) extendRange(index, ci)
                else startRange(index, ci)
              }
            : undefined}
          ondblclick={rowMode && editConfig?.trigger !== 'manual'
            ? () => rowEdit.switchTo(renderedRow, index, col.key)
            : isEditableColumn(col) &&
                editConfig?.trigger !== 'click' &&
                editConfig?.trigger !== 'manual'
              ? () => beginEdit(renderedRow, col, id)
              : undefined}
          style="display: flex; align-items: center; justify-content: {(col.align ??
            (typeof getCellValue(renderedRow, col) === 'number' ? 'right' : 'left')) === 'right'
            ? 'flex-end'
            : col.align === 'center'
              ? 'center'
              : 'flex-start'};{visibleColSet
            ? ` grid-column-start: ${colTrack(ci)};`
            : ''}{spanEntry && spanEntry.colspan > 1
            ? ` grid-column-end: span ${spanEntry.colspan};`
            : ''} padding: {isEditing
            ? '4px'
            : '8px var(--iris-padding-md, 12px)'}; border-bottom: 1px solid var(--iris-border); font-size: var(--iris-font-size-md, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: {isEditableColumn(
            col,
          )
            ? 'cell'
            : 'default'}{cellRange && isInRange(index, ci)
            ? '; background: var(--iris-surface-selected, color-mix(in srgb, var(--iris-primary) 12%, transparent))'
            : ''}{isEditing ? '; flex-wrap: wrap' : ''}{patternHint
            ? '; background-image: linear-gradient(var(--iris-input-hint, rgba(251, 191, 36, 0.16)), var(--iris-input-hint, rgba(251, 191, 36, 0.16)))'
            : ''}{columnFade.columnFadeStyle(col) ? '; opacity: 0' : ''}{pin
            ? `; ${pinnedStyle(col.key)}`
            : ''}"
        >
          {#if treeMeta && ci === 0}
            <span
              data-iris-table-tree-indent=""
              style="display: inline-flex; align-items: center; flex: none; padding-left: {treeMeta.depth *
                16}px"
            >
              {#if treeMeta.hasChildren || (lazyLoad !== undefined && !hasLazyChildren(row, treeMeta.key))}
                <button
                  type="button"
                  data-iris-table-tree-toggle=""
                  data-iris-tree-loading={lazyLoading.has(treeMeta.key) ? '' : undefined}
                  aria-expanded={treeMeta.expanded}
                  aria-label={t(treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand')}
                  onclick={(e) => {
                    e.stopPropagation()
                    if (!treeMeta.hasChildren && !hasLazyChildren(row, treeMeta.key))
                      loadLazyChildren(renderedRow, treeMeta.key, rowId(renderedRow, index))
                    else if (!lazyLoading.has(treeMeta.key)) expansionToggle(treeMeta.key)
                  }}
                  style="border: none; background: transparent; cursor: pointer; padding: 0; margin-right: 4px; font: inherit; color: var(--iris-foreground); transform: {treeMeta.expanded
                    ? 'rotate(90deg)'
                    : 'none'}; transition: transform 150ms">▶</button
                >
              {:else}
                <span style="display: inline-block; width: 16px" aria-hidden="true"></span>
              {/if}
            </span>
          {/if}
          {#if isEditing}
            {#key rowMode ? (rowSession as TableRowEditSession | undefined)?.identity : editId}
              <TableCellEditor
                type={col.editor}
                value={rowMode
                  ? ((rowSession as TableRowEditSession | undefined)?.draft ?? '')
                  : editingDraft}
                error={rowMode
                  ? ((rowSession as TableRowEditSession | undefined)?.error ?? null)
                  : editError}
                errorId={`${editId}-error`}
                onInput={(value) => {
                  if (rowMode) rowEdit.setDraft(editId, value)
                  else setCellDraft(value)
                }}
                sessionIdentity={rowMode
                  ? (rowSession as TableRowEditSession | undefined)?.identity
                  : undefined}
                onCommit={(identity) => {
                  if (rowMode) {
                    rowEdit.commit(editId, renderedRow, col, index, id, rowSession, identity)
                  } else commitEdit(renderedRow, col, index)
                }}
                onCancel={() =>
                  rowMode
                    ? rowEdit.cancel(
                        rowSession as TableRowEditSession | undefined,
                        (rowSession as TableRowEditSession | undefined)?.identity,
                      )
                    : cancelEdit()}
                showPreview={editPreview && col.formatter !== undefined}
                preview={editPreview && col.formatter !== undefined
                  ? editPreviewText(
                      renderedRow,
                      col,
                      rowMode
                        ? ((rowSession as TableRowEditSession | undefined)?.draft ?? '')
                        : editingDraft,
                      formulaTables,
                    )
                  : undefined}
                onTab={rowMode && rowSession
                  ? (direction, identity) =>
                      rowEdit.tab(
                        editId,
                        renderedRow,
                        col,
                        index,
                        id,
                        direction,
                        rowSession,
                        identity,
                      )
                  : undefined}
                inputRef={rowMode ? (node) => rowEdit.registerInput(col.key, node) : undefined}
              />
            {/key}
          {:else if col.render}
            {@render (col.render(getCellValue(renderedRow, col), renderedRow) as RowSnippet)(
              renderedRow,
            )}
          {:else}
            {tableDisplayText(renderedRow, col, getCellValue)}
          {/if}
        </div>
      {/if}
    {/if}
  {/each}
</div>
