<script lang="ts">
  import type { Snippet } from 'svelte'
  type RowSnippet = Snippet<[Record<string, unknown>]>
  import {
    aggregate,
    buildHeaderMatrix,
    compareValues,
    computeVirtualRange,
    createCellRange,
    createSelectionModel,
    createExpansion,
    flattenLeafColumns,
    flattenTree,
    withSortedChildren,
    nextGridCell,
    type GridNavKey,
    type TreeRow,
  } from '@iris-ui-kit/core'
  import { toStore } from '../../useStore'
  import { useI18n } from '../../i18n'
  import { useDrag } from '../drag/useDrag.svelte'
  import IrisVirtualScroll from '../virtual-scroll/IrisVirtualScroll.svelte'
  import type { IrisTableProps } from './props'
  import type { IrisTableColumn, IrisTableSortState, IrisTableColumnWidths } from './types'

  let {
    columns,
    data,
    rowKey = 'id',
    selectable = 'none',
    selection,
    defaultSelection,
    sort,
    defaultSort,
    striped = false,
    bordered = true,
    loading = false,
    error = false,
    emptyState,
    loadingState,
    errorState,
    virtualScroll,
    columnVirtualization = false,
    resizableColumns = false,
    columnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
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
  }: IrisTableProps = $props()

  const { t } = useI18n()

  const DEFAULT_COL_WIDTH = 140
  const DEFAULT_MIN_WIDTH = 60
  const RESIZE_STEP = 16

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
  // svelte-ignore state_referenced_locally — `defaultSort` is an initial seed.
  let internalSort = $state<IrisTableSortState | null>(defaultSort ?? null)
  const effectiveSort = $derived(sort !== undefined ? sort : internalSort)

  // The active sort comparator (or null). Shared by the root-row sort AND the
  // tree-mode child sort so a sortable tree reorders siblings at every depth.
  const sortComparator = $derived<
    () => ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
  >(() => {
    const state = effectiveSort
    if (!state) return null
    const column = leafColumns.find((c) => c.key === state.key)
    if (!column) return null
    const dir = state.direction === 'asc' ? 1 : -1
    const sorter =
      column.sorter ??
      ((a: Record<string, unknown>, b: Record<string, unknown>) =>
        compareValues(getCellValue(a, column), getCellValue(b, column)))
    return (a, b) => sorter(a, b) * dir
  })

  const sortedRows = $derived((): Array<Record<string, unknown>> => {
    const compare = sortComparator()
    if (!compare) return data ?? []
    return [...(data ?? [])].sort(compare)
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

  function handleHeaderKeyDown(event: KeyboardEvent, column: IrisTableColumn): void {
    if (!column.sortable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    handleHeaderClick(column)
  }

  function handleRowKeyDown(
    event: KeyboardEvent,
    row: Record<string, unknown>,
    index: number,
  ): void {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onRowClick(row, index)
  }

  // Selection state — single-sourced in the core selection model (single/multiple
  // toggle, dedup, select-all). The model owns the uncontrolled state; a
  // controlled `selection` prop is mirrored in via `sync` from an effect, and
  // every change is emitted through `onUpdateSelection`.
  const selControlled = $derived(selection !== undefined)
  // svelte-ignore state_referenced_locally — initial seed; controlled changes sync below.
  const selectionModel = createSelectionModel<string | number>({
    mode: selectable === 'single' ? 'single' : 'multiple',
    defaultSelected: selection ?? defaultSelection ?? [],
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
          // With an active sort, sort each level's children by the same
          // comparator so the whole tree reorders hierarchically.
          getChildren: sortComparator()
            ? withSortedChildren((r) => getSubRows!(r), sortComparator()!)
            : (r) => getSubRows!(r),
          isExpanded: (k) => $expandedKeys.includes(k),
        })
      : null,
  )
  const bodyData = $derived(flatTree ? flatTree.map((tr) => tr.row) : sortedRows())

  const allRowIds = $derived(bodyData.map((r, i) => rowId(r, i)))
  const allSelected = $derived(
    allRowIds.length > 0 && allRowIds.every((id) => displaySelection.includes(id)),
  )
  const someSelected = $derived(
    !allSelected && allRowIds.some((id) => displaySelection.includes(id)),
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

  // Column widths — uncontrolled state seeded ONLY from `defaultColumnWidths`
  // (mirroring React's `widthsInternal = defaultColumnWidths ?? {}`); columns
  // without an explicit override resolve through `gridTemplate`'s
  // `?? resolveInitialWidth(col)` fallback, so the emitted map stays sparse
  // (a resize emits just the touched keys, like React). A controlled
  // `columnWidths` prop overrides the internal state via `effectiveWidths`, and
  // every resize emits the resulting map through `onColumnWidthsChange`.
  // svelte-ignore state_referenced_locally
  let internalWidths = $state<IrisTableColumnWidths>({ ...(defaultColumnWidths ?? {}) })

  // Controlled (`columnWidths` prop) wins over the internal state; uncontrolled
  // reads the seeded internal map. The `!== undefined` check means an empty {}
  // prop still controls (matching React/Vue's controlled-detection).
  const widthsControlled = $derived(columnWidths !== undefined)
  const effectiveWidths = $derived<IrisTableColumnWidths>(
    widthsControlled ? columnWidths! : internalWidths,
  )
  function setColumnWidth(key: string, width: number): void {
    const next = { ...effectiveWidths, [key]: width }
    if (!widthsControlled) internalWidths = next
    onColumnWidthsChange?.(next)
  }

  // -------- Interactive column resizing (opt-in via `resizableColumns`) --------
  // Each header gains a draggable separator grip on its trailing edge. Pointer
  // drag (via the in-repo `useDrag` primitive) or focus + Arrow-Left/Right
  // adjusts that column's pixel width, clamped to [minWidth, maxWidth]. The grip
  // element refs live in a reactive map (mirroring IrisResizer); `useDrag` is
  // wired once per leaf column at init and its handle getter is reactive, so the
  // drag attaches when the grip mounts. When `resizableColumns` is off no grip
  // renders and the drag getter stays null — a true no-op.
  function clampWidth(col: IrisTableColumn, w: number): number {
    const minW = col.minWidth ?? DEFAULT_MIN_WIDTH
    const maxW = col.maxWidth ?? Infinity
    return Math.max(minW, Math.min(maxW, Math.round(w)))
  }
  const resizeHandleEls = $state<Record<string, HTMLElement | undefined>>({})
  // Wire a pointer drag per leaf column (over the initial column set, like
  // IrisResizer wires over its fixed handle list). Each drag reads the live
  // start width on pointerdown and writes a clamped width on every move. The
  // initial `leafColumns` snapshot is intentional — useDrag's own $effect
  // attaches lazily once each grip mounts, so static columns are fully wired.
  // svelte-ignore state_referenced_locally
  for (const col of leafColumns) {
    let startWidth = 0
    useDrag({
      handle: () => resizeHandleEls[col.key],
      disabled: () => !resizableColumns,
      onStart: () => {
        startWidth = effectiveWidths[col.key] ?? resolveInitialWidth(col)
      },
      onDrag: ({ dx }) => {
        setColumnWidth(col.key, clampWidth(col, startWidth + dx))
      },
    })
  }
  function registerResizeHandle(node: HTMLElement, key: string): { destroy: () => void } {
    resizeHandleEls[key] = node
    return {
      destroy: () => {
        resizeHandleEls[key] = undefined
      },
    }
  }
  // Focus + Arrow-Left/Right nudge the column width by RESIZE_STEP (keyboard
  // analogue of the pointer drag); clicking the grip must not bubble to sort.
  function onResizeHandleKeydown(e: KeyboardEvent, col: IrisTableColumn): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    e.stopPropagation()
    const cur = effectiveWidths[col.key] ?? resolveInitialWidth(col)
    const delta = e.key === 'ArrowRight' ? RESIZE_STEP : -RESIZE_STEP
    setColumnWidth(col.key, clampWidth(col, cur + delta))
  }

  const showSelection = $derived(selectable !== 'none')

  // Leading non-data columns (detail toggle, selection) that offset the grouped
  // header cells' grid placement.
  const lead = $derived((hasDetail ? 1 : 0) + (showSelection ? 1 : 0))

  // Summary/footer row appears when any column declares a `summary` aggregate op.
  const hasSummary = $derived(leafColumns.some((c) => c.summary))

  // Base per-cell style shared by the summary cells (mirrors the body cell base).
  const summaryCellStyle = (col: IrisTableColumn): string =>
    `display: flex; align-items: center; justify-content: ${col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'}; padding: 8px var(--iris-padding-md, 12px); font-size: var(--iris-font-size-md, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis`

  const gridTemplate = $derived(() => {
    const parts: string[] = []
    if (hasDetail) parts.push('40px')
    if (showSelection) parts.push('40px')
    for (const col of leafColumns) {
      parts.push(`${effectiveWidths[col.key] ?? resolveInitialWidth(col)}px`)
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

  function beginEdit(
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIdent: string | number,
  ): void {
    if (!column.editable) return
    editingCellId = cellId(rowIdent, column.key)
    const current = getCellValue(row, column)
    editingDraft = current == null ? '' : String(current)
    editError = null
  }

  function commitEdit(
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
  ): void {
    if (editingCellId === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft
    const newValue =
      column.editor === 'number'
        ? draft === '' || isNaN(Number(draft))
          ? oldValue
          : Number(draft)
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

  // -------- Column virtualization (opt-in) --------
  // Render only the horizontally-visible columns (+ pinned + a small overscan)
  // for very wide tables. The root becomes a horizontal scroll container; we
  // track its scrollLeft + measured clientWidth and feed them to the core
  // `computeVirtualRange` to get the visible window. Off-screen tracks stay
  // sized (the grid template is unchanged), so alignment/resize keep working.
  let scrollLeft = $state(0)
  let viewportWidth = $state(0)

  // Measure the root's width on mount + on resize (when columnVirtualization is
  // on). Guard ResizeObserver — jsdom and old runtimes lack it; a single mount
  // measurement still seeds the window.
  $effect(() => {
    if (!columnVirtualization || !rootEl) return
    const el = rootEl
    const measure = (): void => {
      viewportWidth = el.clientWidth
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  })

  function handleRootScroll(e: Event): void {
    scrollLeft = (e.currentTarget as HTMLElement).scrollLeft
  }

  // Set of leaf-column indices to render: the visible window (+ overscan),
  // always unioned with pinned columns. `null` ⇒ render every column (off).
  const visibleColSet = $derived<Set<number> | null>(
    (() => {
      if (!columnVirtualization) return null
      const cols = leafColumns
      const w = computeVirtualRange({
        itemCount: cols.length,
        scrollTop: scrollLeft,
        viewportSize: viewportWidth,
        itemSize: (i) => effectiveWidths[cols[i].key] ?? resolveInitialWidth(cols[i]),
        buffer: 2,
      })
      const set = new Set<number>()
      for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
      cols.forEach((col, i) => {
        if (col.pinned) set.add(i)
      })
      return set
    })(),
  )

  // 1-based grid track for a leaf-column index (after the optional detail +
  // selection tracks), so a rendered cell lands in the right place even when
  // earlier cells are skipped.
  function colTrack(i: number): number {
    return (hasDetail ? 1 : 0) + (showSelection ? 2 : 1) + i
  }

  // Virtualize flat mode, and tree mode too — tree rows are uniform height, so
  // the only blocker is variable-height detail panels: virtualize unless BOTH
  // tree mode and detail panels are on. `!(treeMode && hasDetail)` is De
  // Morgan-equivalent to React's `!treeMode || !hasDetail` (same truth table
  // across all four flat/tree × detail combinations). When `virtualScroll` is
  // unset this is false, so the non-virtual body path renders unchanged.
  const useVirtual = $derived(virtualScroll != null && !(treeMode && hasDetail))
</script>

<div
  {...rest}
  bind:this={rootEl}
  role={keyboardNavigation ? (treeMode ? 'treegrid' : 'grid') : 'table'}
  data-iris-table
  data-column-virtualized={columnVirtualization ? 'true' : undefined}
  onkeydown={keyboardNavigation || cellRange ? handleRootKeyDown : undefined}
  onscroll={columnVirtualization ? handleRootScroll : undefined}
  style="background: var(--iris-background); color: var(--iris-foreground); border: {bordered
    ? '1px solid var(--iris-border)'
    : 'none'}; border-radius: var(--iris-radius-md, 6px); overflow: {columnVirtualization
    ? 'auto'
    : 'hidden'};{style ? ' ' + style : ''}"
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
        <div
          role="columnheader"
          style="grid-column: 1; grid-row: 1 / -1; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
        ></div>
      {/if}
      {#if showSelection}
        <div
          role="columnheader"
          style="grid-column: {hasDetail
            ? 2
            : 1}; grid-row: 1 / -1; display: flex; align-items: center; justify-content: center; padding: 8px; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border)"
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
          <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
          {@const isGroup = !!(col.children && col.children.length > 0)}
          {@const sortable = !isGroup && col.sortable}
          <div
            role="columnheader"
            data-iris-table-header={col.key}
            data-iris-table-header-group={isGroup ? '' : undefined}
            aria-colspan={cell.colSpan}
            onclick={sortable ? () => handleHeaderClick(col) : undefined}
            onkeydown={sortable ? (event) => handleHeaderKeyDown(event, col) : undefined}
            tabindex={sortable ? 0 : undefined}
            aria-sort={sortable
              ? effectiveSort?.key === col.key
                ? effectiveSort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
              : undefined}
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
              : 'default'}; user-select: {sortable
              ? 'none'
              : 'auto'}; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border); font-weight: 600; font-size: var(--iris-font-size-sm, 13px); color: var(--iris-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
          >
            {col.title}
            {#if sortable}
              <span
                aria-hidden="true"
                style="display: inline-flex; flex-direction: column; margin-inline-start: 4px; line-height: 0.6; font-size: var(--iris-font-size-xs, 12px); color: {effectiveSort?.key ===
                col.key
                  ? 'var(--iris-primary)'
                  : 'var(--iris-muted)'}"
              >
                <span
                  style="opacity: {effectiveSort?.key === col.key &&
                  effectiveSort.direction === 'asc'
                    ? '1'
                    : '0.45'}">▲</span
                >
                <span
                  style="opacity: {effectiveSort?.key === col.key &&
                  effectiveSort.direction === 'desc'
                    ? '1'
                    : '0.45'}">▼</span
                >
              </span>
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
      {#each columns as col, ci}
        {#if !visibleColSet || visibleColSet.has(ci)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            role="columnheader"
            data-iris-table-header={col.key}
            data-iris-table-pinned={col.pinned}
            onclick={col.sortable ? () => handleHeaderClick(col) : undefined}
            onkeydown={col.sortable ? (event) => handleHeaderKeyDown(event, col) : undefined}
            tabindex={col.sortable ? 0 : undefined}
            aria-sort={effectiveSort?.key === col.key
              ? effectiveSort.direction === 'asc'
                ? 'ascending'
                : 'descending'
              : col.sortable
                ? 'none'
                : undefined}
            style="position: relative; display: flex; align-items: center; justify-content: {col.align ===
            'right'
              ? 'flex-end'
              : col.align === 'center'
                ? 'center'
                : 'flex-start'};{visibleColSet
              ? ` grid-column-start: ${colTrack(ci)};`
              : ''} padding: 8px var(--iris-padding-md, 12px); cursor: {col.sortable
              ? 'pointer'
              : 'default'}; user-select: {col.sortable
              ? 'none'
              : 'auto'}; background: var(--iris-surface); border-bottom: 1px solid var(--iris-border); font-weight: 600; font-size: var(--iris-font-size-sm, 13px); color: var(--iris-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
          >
            {col.title}
            {#if col.sortable}
              <span
                aria-hidden="true"
                style="display: inline-flex; flex-direction: column; margin-inline-start: 4px; line-height: 0.6; font-size: var(--iris-font-size-xs, 12px); color: {effectiveSort?.key ===
                col.key
                  ? 'var(--iris-primary)'
                  : 'var(--iris-muted)'}"
              >
                <span
                  style="opacity: {effectiveSort?.key === col.key &&
                  effectiveSort.direction === 'asc'
                    ? '1'
                    : '0.45'}">▲</span
                >
                <span
                  style="opacity: {effectiveSort?.key === col.key &&
                  effectiveSort.direction === 'desc'
                    ? '1'
                    : '0.45'}">▼</span
                >
              </span>
            {/if}
            {#if resizableColumns}
              <!-- Draggable resize grip at the header's trailing edge. role=
                 "separator" + aria-orientation follow the WAI-ARIA window-
                 splitter pattern; the click-stop keeps a drag from toggling sort.
                 The grip IS the interactive control (focusable, keyboard-resizable),
                 so the noninteractive-* a11y heuristics don't apply here. -->
              <span
                use:registerResizeHandle={col.key}
                role="slider"
                aria-orientation="horizontal"
                aria-label={t('table.resizeColumn', { column: col.title })}
                aria-valuenow={effectiveWidths[col.key] ?? resolveInitialWidth(col)}
                aria-valuemin={col.minWidth ?? DEFAULT_MIN_WIDTH}
                aria-valuemax={col.maxWidth ?? 10_000}
                tabindex="0"
                data-iris-table-resize-handle=""
                data-column-key={col.key}
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => onResizeHandleKeydown(e, col)}
                style="position: absolute; top: 0; right: 0; bottom: 0; width: 6px; border: 0; padding: 0; background: transparent; cursor: col-resize; touch-action: none; user-select: none; z-index: 1"
              ></span>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Body -->
  {#if error}
    <div role="row" data-iris-table-row="error" style={stateRowStyle}>
      {#if errorState}{@render errorState()}{:else}{t('table.error')}{/if}
    </div>
  {:else if loading}
    <div role="row" aria-busy="true" data-iris-table-row="loading" style={stateRowStyle}>
      {#if loadingState}{@render loadingState()}{:else}{t('table.loading')}{/if}
    </div>
  {:else if bodyData.length === 0}
    <div role="row" data-iris-table-row="empty" style={stateRowStyle}>
      {#if emptyState}{@render emptyState()}{:else}{t('table.empty')}{/if}
    </div>
  {:else if useVirtual}
    <!-- Virtualize flat mode, and tree mode too — tree rows are uniform height,
         so the only thing that bars it is variable-height detail panels, hence
         the `!hasDetail` guard. `bodyData` is the flattened visible rows (=
         `sortedRows()` in flat mode); `flatTree?.[index]` supplies each row's
         tree meta (depth + toggle), with `index` the absolute row index from
         the scroller. -->
    <IrisVirtualScroll
      data-iris-table-body=""
      items={bodyData}
      itemHeight={virtualScroll!.itemHeight}
      height={virtualScroll!.height}
      buffer={virtualScroll!.buffer}
      keyOf={(row, index) => rowId(row as Record<string, unknown>, index)}
    >
      {#snippet item({ item: row, index })}
        {@render bodyRow(
          row as Record<string, unknown>,
          index,
          flatTree ? flatTree[index] : null,
          true,
        )}
      {/snippet}
    </IrisVirtualScroll>
  {:else}
    <div role="rowgroup" data-iris-table-body>
      {#each bodyData as row, index}
        {@const id = rowId(row, index)}
        {@render bodyRow(row, index, flatTree ? flatTree[index] : null, false)}
        <!-- Full-width detail panel beneath an expanded, expandable row (spans
             all grid tracks). Only in the non-virtualized path. -->
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
            >
              {renderDetail?.(row, index)}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- One body row. Shared by the non-virtual `{#each}` and the virtual
       scroller's `item` snippet so the markup is identical either way. The
       virtual path passes `fillHeight` so the row fills its absolutely-sized
       window slot; `treeMeta` carries the per-row depth/toggle (flatTree[index]
       at the row's absolute index). -->
  {#snippet bodyRow(
    row: Record<string, unknown>,
    index: number,
    treeMeta: TreeRow<Record<string, unknown>> | null,
    fillHeight: boolean,
  )}
    {@const id = rowId(row, index)}
    {@const selected = isSelected(id)}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      role="row"
      aria-selected={selectable !== 'none' ? selected : undefined}
      data-iris-table-row
      data-state={selected ? 'selected' : undefined}
      aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
      aria-setsize={treeMeta ? treeMeta.setSize : undefined}
      aria-posinset={treeMeta ? treeMeta.posInset : undefined}
      onclick={onRowClick ? () => onRowClick(row, index) : undefined}
      onkeydown={onRowClick ? (event) => handleRowKeyDown(event, row, index) : undefined}
      tabindex={onRowClick ? 0 : undefined}
      style="display: grid; grid-template-columns: {gridTemplate()};{fillHeight
        ? ' height: 100%;'
        : ''} background: {selected
        ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
        : striped && index % 2 === 1
          ? 'var(--iris-surface)'
          : 'transparent'}; transition: background-color 120ms ease; cursor: default"
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
              aria-label={t(
                $expandedKeys.includes(String(id)) ? 'treeSelect.collapse' : 'treeSelect.expand',
              )}
              onclick={(e) => {
                e.stopPropagation()
                expansion.toggle(String(id))
              }}
              style="border: none; background: transparent; cursor: pointer; padding: 0; font: inherit; color: var(--iris-foreground); transform: {$expandedKeys.includes(
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
          {@const isEditing = editingCellId === cellId(id, col.key)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            role="cell"
            data-iris-table-cell={col.key}
            data-iris-table-pinned={col.pinned}
            data-editable={col.editable ? '' : undefined}
            data-editing={isEditing ? '' : undefined}
            data-grid-row={keyboardNavigation ? index : undefined}
            data-grid-col={keyboardNavigation ? ci : undefined}
            data-iris-cell-row={cellRange ? index : undefined}
            data-iris-cell-col={cellRange ? ci : undefined}
            data-iris-cell-selected={cellRange && isInRange(index, ci) ? 'true' : undefined}
            tabindex={keyboardNavigation ? cellTabIndex(index, ci) : undefined}
            onfocus={keyboardNavigation ? () => (focusedCell = { row: index, col: ci }) : undefined}
            onclick={cellRange
              ? (e: MouseEvent) => {
                  if (e.shiftKey) {
                    cellRangeCtrl.extendRange(index, ci)
                  } else {
                    cellRangeCtrl.startRange(index, ci)
                  }
                }
              : undefined}
            onkeydown={cellRange
              ? (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  if (event.shiftKey) cellRangeCtrl.extendRange(index, ci)
                  else cellRangeCtrl.startRange(index, ci)
                }
              : undefined}
            ondblclick={col.editable ? () => beginEdit(row, col, id) : undefined}
            style="display: flex; align-items: center; justify-content: {(col.align ??
              (typeof getCellValue(row, col) === 'number' ? 'right' : 'left')) === 'right'
              ? 'flex-end'
              : col.align === 'center'
                ? 'center'
                : 'flex-start'};{visibleColSet
              ? ` grid-column-start: ${colTrack(ci)};`
              : ''} padding: {isEditing
              ? '4px'
              : '8px var(--iris-padding-md, 12px)'}; border-bottom: 1px solid var(--iris-border); font-size: var(--iris-font-size-md, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: {col.editable
              ? 'cell'
              : 'default'}{cellRange && isInRange(index, ci)
              ? '; background: var(--iris-surface-selected, color-mix(in srgb, var(--iris-primary) 12%, transparent))'
              : ''}"
          >
            {#if treeMeta && ci === 0}
              <span
                data-iris-table-tree-indent=""
                style="display: inline-flex; align-items: center; flex: none; padding-left: {treeMeta.depth *
                  16}px"
              >
                {#if treeMeta.hasChildren}
                  <button
                    type="button"
                    data-iris-table-tree-toggle=""
                    aria-expanded={treeMeta.expanded}
                    aria-label={t(treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand')}
                    onclick={(e) => {
                      e.stopPropagation()
                      expansion.toggle(treeMeta.key)
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
              <input
                type={col.editor === 'number' ? 'number' : 'text'}
                value={editingDraft}
                data-iris-table-editor
                aria-invalid={editError ? 'true' : undefined}
                aria-describedby={editError ? `${cellId(id, col.key)}-error` : undefined}
                oninput={(e) => {
                  editingDraft = (e.target as HTMLInputElement).value
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitEdit(row, col, index)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelEdit()
                  }
                }}
                onblur={() => commitEdit(row, col, index)}
                onclick={(e) => e.stopPropagation()}
                style="width: 100%; border: 1px solid {editError
                  ? 'var(--iris-danger)'
                  : 'var(--iris-primary)'}; border-radius: var(--iris-radius-sm, 4px); padding: var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px); font: inherit; background: var(--iris-background); color: var(--iris-foreground); outline: none"
              />
              {#if editError}
                <div
                  id={`${cellId(id, col.key)}-error`}
                  role="alert"
                  data-iris-table-editor-error
                  style="margin-top: var(--iris-space-xxs, 4px); font-size: var(--iris-font-size-xs, 12px); color: var(--iris-danger)"
                >
                  {editError}
                </div>
              {/if}
            {:else if col.render}
              {@render (col.render(getCellValue(row, col), row) as RowSnippet)(row)}
            {:else}
              {String(getCellValue(row, col) ?? '')}
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/snippet}

  <!-- Summary / footer row: each column with a `summary` op aggregates over the
       full sorted dataset (the core `aggregate` material). -->
  {#if !error && !loading && bodyData.length > 0 && hasSummary}
    <div
      role="row"
      data-iris-table-row="summary"
      style="display: grid; grid-template-columns: {gridTemplate()}; font-weight: 600; border-top: 2px solid var(--iris-border); background: var(--iris-surface)"
    >
      {#if showSelection}
        <div
          role="cell"
          data-iris-table-cell="__selection"
          style={summaryCellStyle({ key: '__selection' } as IrisTableColumn)}
        ></div>
      {/if}
      {#each leafColumns as col, ci}
        {#if !visibleColSet || visibleColSet.has(ci)}
          {@const op = col.summary}
          {@const value = op ? aggregate(bodyData, (r) => getCellValue(r, col), op) : null}
          <div
            role="cell"
            data-iris-table-cell={col.key}
            data-iris-table-summary-cell={op ? '' : undefined}
            style="{summaryCellStyle(col)}{visibleColSet
              ? `; grid-column-start: ${colTrack(ci)}`
              : ''}"
          >
            {#if op != null && value != null}{col.renderSummary
                ? col.renderSummary(value, bodyData)
                : String(value)}{/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
