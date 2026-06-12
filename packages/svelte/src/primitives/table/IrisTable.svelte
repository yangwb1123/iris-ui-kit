<script lang="ts">
  import {
    aggregate,
    buildHeaderMatrix,
    compareValues,
    createCellRange,
    createSelectionModel,
    createExpansion,
    flattenLeafColumns,
    flattenTree,
    nextGridCell,
    type GridNavKey,
    type TreeRow,
  } from '@iris-ui/core'
  import { toStore } from '../../useStore'
  import { useI18n } from '../../i18n'
  import type {
    IrisTableColumn,
    IrisTableSortState,
    IrisTableColumnWidths,
    IrisTableVirtualOptions,
    IrisTableCellEditEvent,
  } from './types'

  interface Props {
    columns: IrisTableColumn[]
    data: Array<Record<string, unknown>>
    rowKey?: string
    selectable?: 'none' | 'single' | 'multi'
    selection?: Array<string | number>
    sort?: IrisTableSortState | null
    striped?: boolean
    bordered?: boolean
    loading?: boolean
    error?: boolean
    virtualScroll?: IrisTableVirtualOptions
    resizableColumns?: boolean
    columnWidths?: IrisTableColumnWidths
    /**
     * Render an expandable detail panel beneath a row. Providing this adds a
     * leading expand-toggle column; clicking it reveals a full-width detail row.
     */
    renderDetail?: (row: Record<string, unknown>, rowIndex: number) => unknown
    /** Which rows can expand a detail panel. Defaults to all rows when `renderDetail` is set. */
    rowExpandable?: (row: Record<string, unknown>, rowIndex: number) => boolean
    /** Initially-expanded row keys (uncontrolled). */
    defaultExpandedRowKeys?: Array<string | number>
    /** Notified with the expanded row keys whenever they change. */
    onExpandedRowsChange?: (keys: Array<string | number>) => void
    /**
     * Read a row's child rows to render the table as a TREE. Providing this
     * enables tree mode: `data` is treated as the root rows, each row's first
     * cell gains a depth indent + an expand/collapse toggle (when it has
     * children), and the expand state reuses
     * `defaultExpandedRowKeys`/`onExpandedRowsChange`. Mutually exclusive with
     * `renderDetail`.
     */
    getSubRows?: (row: Record<string, unknown>) => Array<Record<string, unknown>> | undefined
    /**
     * Enable WAI-ARIA grid keyboard navigation: the table becomes `role="grid"`
     * and Arrow / Home / End / Page Up·Down move a roving cell focus across the
     * data cells. Off by default; opt-in and additive (no effect on mouse / Tab
     * behavior). Does not hijack keystrokes while a cell is being edited.
     */
    keyboardNavigation?: boolean
    /**
     * Enable rectangular cell-range selection (Excel-style). Click starts a
     * range; Shift+Click or Shift+Arrow extends it; Escape clears it.
     * Cells within the range get `data-iris-cell-selected="true"`.
     */
    cellRange?: boolean
    onUpdateSelection?: (value: Array<string | number>) => void
    onUpdateSort?: (value: IrisTableSortState | null) => void
    onRowClick?: (row: Record<string, unknown>, index: number) => void
    onCellEdit?: (event: IrisTableCellEditEvent) => void
    style?: string
    [key: string]: unknown
  }

  let {
    columns,
    data,
    rowKey = 'id',
    selectable = 'none',
    selection,
    sort,
    striped = false,
    bordered = true,
    loading = false,
    error = false,
    renderDetail,
    rowExpandable,
    defaultExpandedRowKeys,
    onExpandedRowsChange,
    getSubRows,
    keyboardNavigation = false,
    cellRange = false,
    onUpdateSelection,
    onUpdateSort,
    onRowClick,
    onCellEdit,
    style,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  const DEFAULT_COL_WIDTH = 140

  function resolveInitialWidth(col: IrisTableColumn): number {
    if (typeof col.width === 'number') return col.width
    if (typeof col.width === 'string') {
      const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
      if (m) return Number(m[1])
    }
    return DEFAULT_COL_WIDTH
  }

  function getCellValue(row: Record<string, unknown>, column: IrisTableColumn): unknown {
    const key = (column.dataIndex ?? column.key) as string
    return row[key]
  }

  // Multi-level (grouped) headers: a column with `children` forms a header group.
  // The BODY always renders the leaf columns; only the header gains extra rows.
  // When nothing is grouped, `leafColumns` is the original `columns` (same
  // reference) so the flat path is byte-identical.
  const grouped = $derived(columns.some((c) => c.children && c.children.length > 0))
  const leafColumns = $derived(grouped ? flattenLeafColumns(columns) : columns)
  const headerMatrix = $derived(grouped ? buildHeaderMatrix(columns) : null)

  // Sort state
  let internalSort = $state<IrisTableSortState | null>(null)
  const effectiveSort = $derived(sort !== undefined ? sort : internalSort)

  const sortedRows = $derived((): Array<Record<string, unknown>> => {
    const state = effectiveSort
    if (!state) return data
    const column = leafColumns.find((c) => c.key === state.key)
    if (!column) return data
    const sorter = column.sorter ?? ((a: Record<string, unknown>, b: Record<string, unknown>) =>
      compareValues(getCellValue(a, column), getCellValue(b, column)))
    const arr = [...data]
    arr.sort(sorter)
    if (state.direction === 'desc') arr.reverse()
    return arr
  })

  function handleHeaderClick(column: IrisTableColumn): void {
    if (!column.sortable) return
    const current = effectiveSort
    let next: IrisTableSortState | null
    if (!current || current.key !== column.key) {
      next = { key: column.key, direction: 'asc' }
    } else if (current.direction === 'asc') {
      next = { key: column.key, direction: 'desc' }
    } else {
      next = null
    }
    if (sort === undefined) internalSort = next
    onUpdateSort?.(next)
  }

  // Selection state — single-sourced in the core selection model (single/multiple
  // toggle, dedup, select-all). The model owns the uncontrolled state; a
  // controlled `selection` prop is mirrored in via `sync` from an effect, and
  // every change is emitted through `onUpdateSelection`.
  const selControlled = $derived(selection !== undefined)
  // svelte-ignore state_referenced_locally — initial seed; controlled changes sync below.
  const selectionModel = createSelectionModel<string | number>({
    mode: selectable === 'single' ? 'single' : 'multiple',
    defaultSelected: selection ?? [],
    onChange: (keys) => onUpdateSelection?.(keys),
  })
  const selectedKeys = toStore(selectionModel.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  $effect(() => {
    if (selControlled) selectionModel.sync(selection!)
  })

  // Controlled tables RENDER from the prop (true controlled semantics): a local
  // toggle emits onUpdateSelection, but the displayed selection only changes when
  // the parent writes `selection` back — so a parent that validates/rejects a
  // change no longer sees the row flip optimistically. Uncontrolled renders from
  // the model store as before.
  const displaySelection = $derived(selControlled ? selection! : $selectedKeys)
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  function rebaseToProp(): void {
    if (selControlled) selectionModel.sync(selection!)
  }

  // Expandable detail rows: a leading toggle column + a full-width detail panel,
  // driven by the framework-agnostic createExpansion (multiple-open). The
  // expanded keys are strings; the store is bridged into Svelte via toStore.
  const hasDetail = $derived(renderDetail !== undefined)
  // svelte-ignore state_referenced_locally — defaults are read once at creation.
  const expansion = createExpansion({
    mode: 'multiple',
    defaultExpanded: (defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => onExpandedRowsChange?.(keys),
  })
  const expandedKeys = toStore(expansion.store)

  function isRowExpandable(row: Record<string, unknown>, index: number): boolean {
    return hasDetail && (rowExpandable ? rowExpandable(row, index) : true)
  }

  function rowId(row: Record<string, unknown>, index: number): string | number {
    const v = row[rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  // Tree mode (opt-in via getSubRows): flatten the data into the visible rows
  // honoring the (shared) expansion model. `bodyData` is the row list the body,
  // selection, and summary all operate on — identical to `sortedRows()` in flat
  // mode, so non-tree behavior is unchanged. Each flat entry carries its
  // TreeRow meta (depth / hasChildren / expanded) for the first-cell indent.
  const treeMode = $derived(getSubRows !== undefined)
  const flatTree = $derived<Array<TreeRow<Record<string, unknown>>> | null>(
    treeMode
      ? flattenTree(sortedRows(), {
          getKey: (r) => String(rowId(r, 0)),
          getChildren: (r) => getSubRows!(r),
          isExpanded: (k) => $expandedKeys.includes(k),
        })
      : null,
  )
  const bodyData = $derived(flatTree ? flatTree.map((tr) => tr.row) : sortedRows())

  const allRowIds = $derived(bodyData.map((r, i) => rowId(r, i)))
  const allSelected = $derived(
    allRowIds.length > 0 && allRowIds.every((id) => displaySelection.includes(id))
  )
  const someSelected = $derived(
    !allSelected && allRowIds.some((id) => displaySelection.includes(id))
  )

  function isSelected(id: string | number): boolean {
    return displaySelection.includes(id)
  }

  function toggleRow(id: string | number): void {
    // Mode (single vs multiple) is fixed from `selectable` at model creation;
    // the model owns the toggle/replace semantics.
    if (selectable === 'single' || selectable === 'multi') {
      rebaseToProp()
      selectionModel.toggle(id)
    }
  }

  function toggleAll(): void {
    rebaseToProp()
    selectionModel.toggleAll(allRowIds)
  }

  // Column widths — seed from columns prop; use untracked read to avoid cycles
  function seedWidths(cols: IrisTableColumn[]): IrisTableColumnWidths {
    const seeded: IrisTableColumnWidths = {}
    for (const col of cols) {
      seeded[col.key] = resolveInitialWidth(col)
    }
    return seeded
  }
  // svelte-ignore state_referenced_locally
  let internalWidths = $state<IrisTableColumnWidths>(seedWidths(columns))

  const showSelection = $derived(selectable !== 'none')

  // Leading non-data columns (detail toggle, selection) that offset the grouped
  // header cells' grid placement.
  const lead = $derived((hasDetail ? 1 : 0) + (showSelection ? 1 : 0))

  // Summary/footer row appears when any column declares a `summary` aggregate op.
  const hasSummary = $derived(leafColumns.some((c) => c.summary))

  // Base per-cell style shared by the summary cells (mirrors the body cell base).
  const summaryCellStyle = (col: IrisTableColumn): string =>
    `display: flex; align-items: center; justify-content: ${col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}; padding: 8px var(--iris-padding-md, 12px); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`

  const gridTemplate = $derived(() => {
    const parts: string[] = []
    if (hasDetail) parts.push('40px')
    if (showSelection) parts.push('40px')
    for (const col of leafColumns) {
      parts.push(`${internalWidths[col.key] ?? resolveInitialWidth(col)}px`)
    }
    return parts.join(' ')
  })

  // Editing
  let editingCellId = $state<string | null>(null)
  let editingDraft = $state('')
  let editError = $state<string | null>(null)

  function cellId(rowIdent: string | number, colKey: string): string {
    return `${rowIdent}::${colKey}`
  }

  function beginEdit(row: Record<string, unknown>, column: IrisTableColumn, rowIdent: string | number): void {
    if (!column.editable) return
    editingCellId = cellId(rowIdent, column.key)
    const current = getCellValue(row, column)
    editingDraft = current == null ? '' : String(current)
    editError = null
  }

  function commitEdit(row: Record<string, unknown>, column: IrisTableColumn, rowIndex: number): void {
    if (editingCellId === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft
    const newValue = column.editor === 'number'
      ? draft === '' || isNaN(Number(draft)) ? oldValue : Number(draft)
      : draft
    // A column validator can reject the draft: keep the editor open, surface the
    // message, and skip the commit until the value is valid (or the user cancels).
    if (column.validate) {
      const error = column.validate(newValue, row)
      if (error) {
        editError = error
        return
      }
    }
    editError = null
    editingCellId = null
    if (newValue !== oldValue) {
      onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
    }
  }

  function cancelEdit(): void {
    editError = null
    editingCellId = null
  }

  const stateRowStyle = 'padding: 32px 12px; text-align: center; color: var(--iris-muted)'

  // Grid keyboard navigation (opt-in): roving cell focus over the data cells.
  let rootEl = $state<HTMLDivElement | null>(null)
  let focusedCell = $state<{ row: number; col: number } | null>(null)
  const GRID_NAV_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ])
  function handleGridKey(e: KeyboardEvent): void {
    if (!keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    // Only navigate from a grid cell — never hijack arrows inside an editing
    // cell's <input> (which carries no data-grid-row).
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyData.length,
      colCount: leafColumns.length,
      pageSize: 10,
    })
    focusedCell = next
    const cell = rootEl?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }

  // Roving tabindex: exactly one data cell is tabbable (0); the rest are -1.
  function cellTabIndex(rowIndex: number, colIndex: number): number {
    const isActive = focusedCell
      ? focusedCell.row === rowIndex && focusedCell.col === colIndex
      : rowIndex === 0 && colIndex === 0
    return isActive ? 0 : -1
  }

  // Cell-range selection (opt-in via `cellRange`). The controller is created
  // once; its state is bridged into Svelte via a $state variable subscribed to
  // the core store.
  // svelte-ignore state_referenced_locally
  const cellRangeCtrl = createCellRange()
  let cellRangeState = $state(cellRangeCtrl.getState())
  // Subscribe to core store — Svelte's $effect cleanup will run on destroy.
  $effect(() => {
    const unsub = cellRangeCtrl.subscribe((s) => {
      cellRangeState = s
    })
    return unsub
  })

  function isInRange(row: number, col: number): boolean {
    const { anchor, active } = cellRangeState
    if (!anchor || !active) return false
    const minRow = Math.min(anchor.row, active.row)
    const maxRow = Math.max(anchor.row, active.row)
    const minCol = Math.min(anchor.col, active.col)
    const maxCol = Math.max(anchor.col, active.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }

  function handleCellRangeKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    if (!e.shiftKey || !ARROW_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    const rowAttr = target.dataset.irisCellRow
    const colAttr = target.dataset.irisCellCol
    if (rowAttr === undefined || colAttr === undefined) return
    e.preventDefault()
    const anchor = cellRangeCtrl.getState().anchor
    const active = anchor
      ? (cellRangeCtrl.getState().active ?? { row: Number(rowAttr), col: Number(colAttr) })
      : { row: Number(rowAttr), col: Number(colAttr) }
    let nextRow = active.row
    let nextCol = active.col
    if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
    else if (e.key === 'ArrowDown') nextRow = Math.min(bodyData.length - 1, nextRow + 1)
    else if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
    else nextCol = Math.min(leafColumns.length - 1, nextCol + 1)
    cellRangeCtrl.extendRange(nextRow, nextCol)
  }

  function handleRootKeyDown(e: KeyboardEvent): void {
    if (keyboardNavigation) handleGridKey(e)
    if (cellRange) handleCellRangeKey(e)
  }
</script>

<div
  {...rest}
  bind:this={rootEl}
  role={keyboardNavigation ? 'grid' : 'table'}
  data-iris-table
  onkeydown={(keyboardNavigation || cellRange) ? handleRootKeyDown : undefined}
  style="background: var(--iris-background); color: var(--iris-foreground); border: {bordered ? '1px solid var(--iris-border)' : 'none'}; border-radius: var(--iris-radius-md, 6px); overflow: hidden;{style ? ' ' + style : ''}"
>
  <!-- Header row -->
  {#if grouped && headerMatrix}
    <!-- Multi-level (grouped) header: a CSS grid of `headerMatrix.length` rows;
         each cell placed by its leaf-column span (colStart/colSpan) and row span.
         The BODY still renders the leaf columns; only the header gains rows. -->
    <div
      role="row"
      data-iris-table-row="header"
      data-iris-table-header-grouped=""
      style="display: grid; grid-template-columns: {gridTemplate()}; grid-template-rows: repeat({headerMatrix.length}, auto)"
    >
      {#if hasDetail}
        <div role="columnheader" style="grid-column: 1; grid-row: 1 / -1; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"></div>
      {/if}
      {#if showSelection}
        <div
          role="columnheader"
          style="grid-column: {hasDetail ? 2 : 1}; grid-row: 1 / -1; display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
        >
          {#if selectable === 'multi'}
            <input
              type="checkbox"
              checked={allSelected}
              indeterminate={someSelected}
              onchange={toggleAll}
              aria-label={t('table.selectAll')}
            />
          {/if}
        </div>
      {/if}
      {#each headerMatrix as rowCells}
        {#each rowCells as cell}
          {@const col = cell.column}
          {@const isGroup = !!(col.children && col.children.length > 0)}
          {@const sortable = !isGroup && col.sortable}
          <div
            role="columnheader"
            data-iris-table-header={col.key}
            data-iris-table-header-group={isGroup ? '' : undefined}
            aria-colspan={cell.colSpan}
            onclick={sortable ? () => handleHeaderClick(col) : undefined}
            aria-sort={sortable ? (effectiveSort?.key === col.key ? effectiveSort.direction === 'asc' ? 'ascending' : 'descending' : 'none') : undefined}
            style="position: relative; display: flex; align-items: center; justify-content: {isGroup ? 'center' : col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}; grid-column: {lead + cell.colStart} / span {cell.colSpan}; grid-row: {cell.level + 1} / span {cell.rowSpan}; padding: 8px var(--iris-padding-md, 12px); cursor: {sortable ? 'pointer' : 'default'}; user-select: {sortable ? 'none' : 'auto'}; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border); font-weight: 600; font-size: 13px; color: var(--iris-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
          >
            {col.title}
            {#if sortable}
              <span aria-hidden="true" style="display: inline-flex; flex-direction: column; margin-inline-start: 4px; line-height: 0.6; font-size: 8px; color: {effectiveSort?.key === col.key ? 'var(--iris-primary)' : 'var(--iris-muted)'}">
                <span style="opacity: {effectiveSort?.key === col.key && effectiveSort.direction === 'asc' ? '1' : '0.45'}">▲</span>
                <span style="opacity: {effectiveSort?.key === col.key && effectiveSort.direction === 'desc' ? '1' : '0.45'}">▼</span>
              </span>
            {/if}
          </div>
        {/each}
      {/each}
    </div>
  {:else}
    <div role="row" data-iris-table-header-row style="display: grid; grid-template-columns: {gridTemplate()}">
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
          {/if}
        </div>
      {/if}
      {#each columns as col}
        <div
          role="columnheader"
          data-iris-table-header={col.key}
          onclick={() => handleHeaderClick(col)}
          aria-sort={effectiveSort?.key === col.key ? effectiveSort.direction === 'asc' ? 'ascending' : 'descending' : col.sortable ? 'none' : undefined}
          style="position: relative; display: flex; align-items: center; justify-content: {col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}; padding: 8px var(--iris-padding-md, 12px); cursor: {col.sortable ? 'pointer' : 'default'}; user-select: {col.sortable ? 'none' : 'auto'}; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border); font-weight: 600; font-size: 13px; color: var(--iris-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
        >
          {col.title}
          {#if col.sortable}
            <span aria-hidden="true" style="display: inline-flex; flex-direction: column; margin-inline-start: 4px; line-height: 0.6; font-size: 8px; color: {effectiveSort?.key === col.key ? 'var(--iris-primary)' : 'var(--iris-muted)'}">
              <span style="opacity: {effectiveSort?.key === col.key && effectiveSort.direction === 'asc' ? '1' : '0.45'}">▲</span>
              <span style="opacity: {effectiveSort?.key === col.key && effectiveSort.direction === 'desc' ? '1' : '0.45'}">▼</span>
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Body -->
  {#if error}
    <div role="row" data-iris-table-row="error" style={stateRowStyle}>{t('table.error')}</div>
  {:else if loading}
    <div role="row" aria-busy="true" data-iris-table-row="loading" style={stateRowStyle}>{t('table.loading')}</div>
  {:else if bodyData.length === 0}
    <div role="row" data-iris-table-row="empty" style={stateRowStyle}>{t('table.empty')}</div>
  {:else}
    <div role="rowgroup" data-iris-table-body>
      {#each bodyData as row, index}
        {@const id = rowId(row, index)}
        {@const selected = isSelected(id)}
        {@const treeMeta = flatTree ? flatTree[index] : null}
        <div
          role="row"
          data-iris-table-row
          data-state={selected ? 'selected' : undefined}
          onclick={() => onRowClick?.(row, index)}
          style="display: grid; grid-template-columns: {gridTemplate()}; background: {selected ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))' : striped && index % 2 === 1 ? 'var(--iris-surface)' : 'transparent'}; transition: background-color 120ms ease; cursor: default"
        >
          {#if hasDetail}
            <div
              role="cell"
              data-iris-table-cell="__expand"
              style="display: flex; align-items: center; justify-content: center; padding: 8px; border-bottom: 1px solid var(--iris-border)"
            >
              {#if isRowExpandable(row, index)}
                <button
                  type="button"
                  data-iris-table-expand-toggle=""
                  aria-expanded={$expandedKeys.includes(String(id))}
                  aria-label={t($expandedKeys.includes(String(id)) ? 'treeSelect.collapse' : 'treeSelect.expand')}
                  onclick={(e) => { e.stopPropagation(); expansion.toggle(String(id)) }}
                  style="border: none; background: transparent; cursor: pointer; padding: 0; font: inherit; color: var(--iris-foreground); transform: {$expandedKeys.includes(String(id)) ? 'rotate(90deg)' : 'none'}; transition: transform 150ms"
                >▶</button>
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
            {@const isEditing = editingCellId === cellId(id, col.key)}
            <div
              role="cell"
              data-iris-table-cell={col.key}
              data-editable={col.editable ? '' : undefined}
              data-editing={isEditing ? '' : undefined}
              data-grid-row={keyboardNavigation ? index : undefined}
              data-grid-col={keyboardNavigation ? ci : undefined}
              data-iris-cell-row={cellRange ? index : undefined}
              data-iris-cell-col={cellRange ? ci : undefined}
              data-iris-cell-selected={cellRange && isInRange(index, ci) ? 'true' : undefined}
              tabindex={keyboardNavigation ? cellTabIndex(index, ci) : undefined}
              onfocus={keyboardNavigation ? () => (focusedCell = { row: index, col: ci }) : undefined}
              onclick={cellRange ? (e: MouseEvent) => { if (e.shiftKey) { cellRangeCtrl.extendRange(index, ci) } else { cellRangeCtrl.startRange(index, ci) } } : undefined}
              ondblclick={col.editable ? () => beginEdit(row, col, id) : undefined}
              style="display: flex; align-items: center; justify-content: {col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}; padding: {isEditing ? '4px' : '8px var(--iris-padding-md, 12px)'}; border-bottom: 1px solid var(--iris-border); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: {col.editable ? 'cell' : 'default'}{cellRange && isInRange(index, ci) ? '; background: var(--iris-surface-selected, rgba(99,102,241,0.12))' : ''}"
            >
              {#if treeMeta && ci === 0}
                <span
                  data-iris-table-tree-indent=""
                  style="display: inline-flex; align-items: center; flex: none; padding-left: {treeMeta.depth * 16}px"
                >
                  {#if treeMeta.hasChildren}
                    <button
                      type="button"
                      data-iris-table-tree-toggle=""
                      aria-expanded={treeMeta.expanded}
                      aria-label={t(treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand')}
                      onclick={(e) => { e.stopPropagation(); expansion.toggle(treeMeta.key) }}
                      style="border: none; background: transparent; cursor: pointer; padding: 0; margin-right: 4px; font: inherit; color: var(--iris-foreground); transform: {treeMeta.expanded ? 'rotate(90deg)' : 'none'}; transition: transform 150ms"
                    >▶</button>
                  {:else}
                    <span style="display: inline-block; width: 16px" aria-hidden="true"></span>
                  {/if}
                </span>
              {/if}
              {#if isEditing}
                <input
                  type={col.editor === 'number' ? 'number' : 'text'}
                  value={editingDraft}
                  data-iris-table-editor
                  aria-invalid={editError ? 'true' : undefined}
                  aria-describedby={editError ? `${cellId(id, col.key)}-error` : undefined}
                  oninput={(e) => { editingDraft = (e.target as HTMLInputElement).value }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(row, col, index) }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                  }}
                  onblur={() => commitEdit(row, col, index)}
                  onclick={(e) => e.stopPropagation()}
                  style="width: 100%; border: 1px solid {editError ? 'var(--iris-danger)' : 'var(--iris-primary)'}; border-radius: var(--iris-radius-sm, 4px); padding: 4px 6px; font: inherit; background: var(--iris-background); color: var(--iris-foreground); outline: none"
                />
                {#if editError}
                  <div
                    id={`${cellId(id, col.key)}-error`}
                    role="alert"
                    data-iris-table-editor-error
                    style="margin-top: 2px; font-size: 12px; color: var(--iris-danger)"
                  >{editError}</div>
                {/if}
              {:else}
                {String(getCellValue(row, col) ?? '')}
              {/if}
            </div>
          {/each}
        </div>
        <!-- Full-width detail panel beneath an expanded, expandable row (spans
             all grid tracks). Not emitted in any virtual path (none here). -->
        {#if hasDetail && isRowExpandable(row, index) && $expandedKeys.includes(String(id))}
          <div
            role="row"
            data-iris-table-row-detail={String(id)}
            style="display: grid; grid-template-columns: {gridTemplate()}"
          >
            <div
              role="cell"
              data-iris-table-detail-cell=""
              style="grid-column: 1 / -1; padding: 8px 12px; border-bottom: 1px solid var(--iris-border)"
            >{renderDetail?.(row, index)}</div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Summary / footer row: each column with a `summary` op aggregates over the
       full sorted dataset (the core `aggregate` material). -->
  {#if !error && !loading && bodyData.length > 0 && hasSummary}
    <div
      role="row"
      data-iris-table-row="summary"
      style="display: grid; grid-template-columns: {gridTemplate()}; font-weight: 600; border-top: 2px solid var(--iris-border); background: var(--iris-surface)"
    >
      {#if showSelection}
        <div role="cell" data-iris-table-cell="__selection" style={summaryCellStyle({ key: '__selection' } as IrisTableColumn)}></div>
      {/if}
      {#each leafColumns as col}
        {@const op = col.summary}
        {@const value = op ? aggregate(bodyData, (r) => getCellValue(r, col), op) : null}
        <div
          role="cell"
          data-iris-table-cell={col.key}
          data-iris-table-summary-cell={op ? '' : undefined}
          style={summaryCellStyle(col)}
        >
          {#if op != null && value != null}{col.renderSummary ? col.renderSummary(value, bodyData) : String(value)}{/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
