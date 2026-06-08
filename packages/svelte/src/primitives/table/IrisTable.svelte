<script lang="ts">
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
    onUpdateSelection,
    onUpdateSort,
    onRowClick,
    onCellEdit,
    style,
    ...rest
  }: Props = $props()

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

  function defaultSorter(a: unknown, b: unknown): number {
    if (a === b) return 0
    if (a == null) return -1
    if (b == null) return 1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
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
      defaultSorter(getCellValue(a, column), getCellValue(b, column)))
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

  // Selection state
  let internalSelection = $state<Array<string | number>>([])
  const effectiveSelection = $derived(selection ?? internalSelection)

  function rowId(row: Record<string, unknown>, index: number): string | number {
    const v = row[rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  const allRowIds = $derived(sortedRows().map((r, i) => rowId(r, i)))
  const allSelected = $derived(
    allRowIds.length > 0 && allRowIds.every((id) => effectiveSelection.includes(id))
  )
  const someSelected = $derived(
    !allSelected && allRowIds.some((id) => effectiveSelection.includes(id))
  )

  function isSelected(id: string | number): boolean {
    return effectiveSelection.includes(id)
  }

  function setSelection(next: Array<string | number>): void {
    if (selection === undefined) internalSelection = next
    onUpdateSelection?.(next)
  }

  function toggleRow(id: string | number): void {
    if (selectable === 'single') {
      setSelection(isSelected(id) ? [] : [id])
    } else if (selectable === 'multi') {
      const current = effectiveSelection
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      setSelection(next)
    }
  }

  function toggleAll(): void {
    if (allSelected) setSelection([])
    else setSelection([...allRowIds])
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

  const gridTemplate = $derived(() => {
    const parts: string[] = []
    if (showSelection) parts.push('40px')
    for (const col of columns) {
      parts.push(`${internalWidths[col.key] ?? resolveInitialWidth(col)}px`)
    }
    return parts.join(' ')
  })

  // Editing
  let editingCellId = $state<string | null>(null)
  let editingDraft = $state('')

  function cellId(rowIdent: string | number, colKey: string): string {
    return `${rowIdent}::${colKey}`
  }

  function beginEdit(row: Record<string, unknown>, column: IrisTableColumn, rowIdent: string | number): void {
    if (!column.editable) return
    editingCellId = cellId(rowIdent, column.key)
    const current = getCellValue(row, column)
    editingDraft = current == null ? '' : String(current)
  }

  function commitEdit(row: Record<string, unknown>, column: IrisTableColumn, rowIndex: number): void {
    if (editingCellId === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft
    const newValue = column.editor === 'number'
      ? draft === '' || isNaN(Number(draft)) ? oldValue : Number(draft)
      : draft
    editingCellId = null
    if (newValue !== oldValue) {
      onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
    }
  }

  function cancelEdit(): void { editingCellId = null }

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
            aria-label="Select all"
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
    <div role="row" data-iris-table-row="error" style={stateRowStyle}>Error loading data</div>
  {:else if loading}
    <div role="row" aria-busy="true" data-iris-table-row="loading" style={stateRowStyle}>Loading…</div>
  {:else if sortedRows().length === 0}
    <div role="row" data-iris-table-row="empty" style={stateRowStyle}>No data</div>
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
                aria-label="Select row"
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
                  oninput={(e) => { editingDraft = (e.target as HTMLInputElement).value }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(row, col, index) }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                  }}
                  onblur={() => commitEdit(row, col, index)}
                  onclick={(e) => e.stopPropagation()}
                  style="width: 100%; border: 1px solid var(--iris-primary); border-radius: var(--iris-radius-sm, 4px); padding: 4px 6px; font: inherit; background: var(--iris-background); color: var(--iris-foreground); outline: none"
                />
              {:else}
                {String(getCellValue(row, col) ?? '')}
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>
