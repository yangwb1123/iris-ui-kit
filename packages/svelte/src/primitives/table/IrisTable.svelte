<script lang="ts">
  import { aggregate, compareValues, createSelectionModel, createExpansion } from '@iris-ui/core'
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


  // Sort state
  let internalSort = $state<IrisTableSortState | null>(null)
  const effectiveSort = $derived(sort !== undefined ? sort : internalSort)

  const sortedRows = $derived((): Array<Record<string, unknown>> => {
    const state = effectiveSort
    if (!state) return data
    const column = columns.find((c) => c.key === state.key)
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
  // svelte-ignore state_referenced_locally — initial seed; controlled changes sync below.
  const selectionModel = createSelectionModel<string | number>({
    mode: selectable === 'single' ? 'single' : 'multiple',
    defaultSelected: selection ?? [],
    onChange: (keys) => onUpdateSelection?.(keys),
  })
  const selectedKeys = toStore(selectionModel.store)

  $effect(() => {
    if (selection !== undefined) selectionModel.sync(selection)
  })

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

  const allRowIds = $derived(sortedRows().map((r, i) => rowId(r, i)))
  const allSelected = $derived(
    allRowIds.length > 0 && allRowIds.every((id) => $selectedKeys.includes(id))
  )
  const someSelected = $derived(
    !allSelected && allRowIds.some((id) => $selectedKeys.includes(id))
  )

  function isSelected(id: string | number): boolean {
    return $selectedKeys.includes(id)
  }

  function toggleRow(id: string | number): void {
    // Mode (single vs multiple) is fixed from `selectable` at model creation;
    // the model owns the toggle/replace semantics.
    if (selectable === 'single' || selectable === 'multi') selectionModel.toggle(id)
  }

  function toggleAll(): void {
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

  // Summary/footer row appears when any column declares a `summary` aggregate op.
  const hasSummary = $derived(columns.some((c) => c.summary))

  // Base per-cell style shared by the summary cells (mirrors the body cell base).
  const summaryCellStyle = (col: IrisTableColumn): string =>
    `display: flex; align-items: center; justify-content: ${col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}; padding: 8px var(--iris-padding-md, 12px); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`

  const gridTemplate = $derived(() => {
    const parts: string[] = []
    if (hasDetail) parts.push('40px')
    if (showSelection) parts.push('40px')
    for (const col of columns) {
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
</script>

<div
  {...rest}
  role="table"
  data-iris-table
  style="background: var(--iris-background); color: var(--iris-foreground); border: {bordered ? '1px solid var(--iris-border)' : 'none'}; border-radius: var(--iris-radius-md, 6px); overflow: hidden;{style ? ' ' + style : ''}"
>
  <!-- Header row -->
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

  <!-- Body -->
  {#if error}
    <div role="row" data-iris-table-row="error" style={stateRowStyle}>{t('table.error')}</div>
  {:else if loading}
    <div role="row" aria-busy="true" data-iris-table-row="loading" style={stateRowStyle}>{t('table.loading')}</div>
  {:else if sortedRows().length === 0}
    <div role="row" data-iris-table-row="empty" style={stateRowStyle}>{t('table.empty')}</div>
  {:else}
    <div role="rowgroup" data-iris-table-body>
      {#each sortedRows() as row, index}
        {@const id = rowId(row, index)}
        {@const selected = isSelected(id)}
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
          {#each columns as col}
            {@const isEditing = editingCellId === cellId(id, col.key)}
            <div
              role="cell"
              data-iris-table-cell={col.key}
              data-editable={col.editable ? '' : undefined}
              data-editing={isEditing ? '' : undefined}
              ondblclick={col.editable ? () => beginEdit(row, col, id) : undefined}
              style="display: flex; align-items: center; justify-content: {col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}; padding: {isEditing ? '4px' : '8px var(--iris-padding-md, 12px)'}; border-bottom: 1px solid var(--iris-border); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: {col.editable ? 'cell' : 'default'}"
            >
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
  {#if !error && !loading && sortedRows().length > 0 && hasSummary}
    <div
      role="row"
      data-iris-table-row="summary"
      style="display: grid; grid-template-columns: {gridTemplate()}; font-weight: 600; border-top: 2px solid var(--iris-border); background: var(--iris-surface)"
    >
      {#if showSelection}
        <div role="cell" data-iris-table-cell="__selection" style={summaryCellStyle({ key: '__selection' } as IrisTableColumn)}></div>
      {/if}
      {#each columns as col}
        {@const op = col.summary}
        {@const value = op ? aggregate(sortedRows(), (r) => getCellValue(r, col), op) : null}
        <div
          role="cell"
          data-iris-table-cell={col.key}
          data-iris-table-summary-cell={op ? '' : undefined}
          style={summaryCellStyle(col)}
        >
          {#if op != null && value != null}{col.renderSummary ? col.renderSummary(value, sortedRows()) : String(value)}{/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
