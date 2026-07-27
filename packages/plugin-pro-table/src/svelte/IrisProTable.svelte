<script lang="ts">
  import { createSortable, createVirtualizer, type SortableRect, type TreeRow } from '@iris-ui-kit/core'
  import {
    applyColumnWindow,
    proTableLabel,
    type ProTableLabels,
    type ProTableState,
    type ProTableStore,
  } from '../core'

  type Row = Record<string, unknown>

  /** Collect drop-target rects (id + client rect) for every `[attr]` under `root`. */
  function collectRects(root: HTMLElement | null, attr: string): SortableRect[] {
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).map((el) => {
      const r = el.getBoundingClientRect()
      return {
        id: el.getAttribute(attr)!,
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      }
    })
  }

  let {
    store,
    class: klass = '',
    labels,
    columnReorder = false,
    virtualized = false,
    rowHeight = 40,
    maxHeight = 400,
    columnVirtualized = false,
  }: {
    store: ProTableStore<Row>
    class?: string
    /**
     * Host-overridable UI strings (aria-labels + pager). Pass localized values
     * (e.g. from the adapter's `useI18n().t`) — plugins can't reach adapter i18n
     * directly. Defaults to English.
     */
    labels?: ProTableLabels
    /**
     * Enable drag-to-reorder column headers. When `true` every column `<th>`
     * becomes draggable and drop onto another header calls `store.reorderColumns`.
     * Default `false` — existing layouts are unchanged.
     */
    columnReorder?: boolean
    /**
     * Opt-in row virtualization. When `true` the body region becomes a scroll
     * container and only the visible window of rows is rendered (via core's
     * `createVirtualizer`), so a 100k-row table renders a handful of `<tr>` rather
     * than every row. Default `false` — behavior is UNCHANGED (all rows render).
     */
    virtualized?: boolean
    /** Estimated row height in px (drives the virtualizer). Default `40`. */
    rowHeight?: number
    /** Scroll viewport height in px when virtualized. Default `400`. */
    maxHeight?: number
    /**
     * Opt-in column virtualization. When `true` columns outside the horizontal
     * viewport are not rendered, reducing DOM for very wide tables. The table
     * container becomes horizontally scrollable. Default `false`.
     */
    columnVirtualized?: boolean
  } = $props()

  // Drag-to-reorder: plain mutable — no $state needed (no re-render on drag events).
  let dragKey: string | null = null

  // NB: do not name this `state` — a leading `$` would make Svelte read `$state`
  // as a store auto-subscription instead of the rune.
  let tableState: ProTableState<Row> = $state(store.getState())
  let draft = $state('')
  let scrollDiv: HTMLDivElement | undefined = $state()

  $effect(() => {
    const unsub = store.subscribe((s) => {
      tableState = s
      if (s.editing) {
        const row = s.rows.find((r) => store.rowKeyOf(r) === s.editing!.rowKey)
        const col = store.visibleColumns().find((c) => c.key === s.editing!.columnKey)
        if (row && col) draft = String(store.cellValue(row, col) ?? '')
      }
    })
    return unsub
  })

  // Touch/pen column reorder via the shared core controller. Native HTML5 DnD
  // (the `draggable` <th>) never fires on touch, so the pointer path drives the
  // reorder there; it is gated on `pointerType !== 'mouse'` so the mouse flow is
  // unchanged. A bare tap (down→up, no move) leaves overId null → no reorder,
  // so header-tap sorting still works. NB: never name a variable `state`.
  const sortable = createSortable()
  let sortableState = $state(sortable.getState())
  $effect(() => {
    const unsub = sortable.subscribe(() => {
      sortableState = sortable.getState()
    })
    return unsub
  })
  // Header rects, measured ONCE when a drag actually starts (not per move).
  // Plain mutable var — no $state needed (rects don't drive rendering).
  let dragRects: SortableRect[] = []

  function onHeaderPointerDown(key: string, e: PointerEvent): void {
    if (!columnReorder || e.pointerType === 'mouse') return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    // Record a pending press — no store write, so a tap (header sort) never re-renders.
    sortable.press(key, e.clientX, e.clientY)
  }
  function onHeaderPointerMove(key: string, e: PointerEvent): void {
    if (sortable.tryStart(e.clientX, e.clientY)) {
      const root = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-pro-table]')
      dragRects = collectRects(root, 'data-iris-col-key')
    }
    if (!sortable.isActive(key)) return
    sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects)
  }
  function onHeaderPointerUp(key: string): void {
    if (!sortable.isActive(key)) {
      sortable.cancel() // clear a pending tap (idle → no re-render); header-tap sort still works
      return
    }
    const { activeId, overId } = sortable.end()
    if (activeId && overId && activeId !== overId) store.reorderColumns(activeId, overId)
  }
  function onHeaderPointerCancel(): void {
    sortable.cancel()
  }

  const columns = $derived(store.visibleColumns())

  // Column virtualization: window the visible columns.
  const colWindow = $derived(columnVirtualized ? store.columnWindow() : null)
  const _applyResult = $derived(applyColumnWindow(columns, colWindow))
  const displayColumns = $derived(_applyResult.visible)
  const colOffset = $derived(_applyResult.offsetBefore)
  const renderColumns = $derived(columnVirtualized && colWindow ? displayColumns : columns)

  // Multi-level (grouped) headers: a column with `children` forms a header group.
  // The BODY always renders the leaf columns (`columns` is already the flattened
  // leaf view from `visibleColumns()`); only the header gains extra rows.
  // When nothing is grouped, `headerMatrix` is 1 row → `grouped` is false.
  const headerMatrix = $derived(store.headerMatrix())
  const grouped = $derived(headerMatrix.length > 1)

  // Map from row key → TreeRow metadata for tree/hierarchical rendering.
  // When tree mode is inactive (treeRows is null), the map is empty.
  const treeRowMap = $derived.by(() => {
    if (!tableState.treeRows) return new Map<string, TreeRow<Row>>()
    return new Map(tableState.treeRows.map((tr) => [tr.key, tr]))
  })

  // --- Row virtualization (opt-in) -----------------------------------------
  // Create the virtualizer ONCE. viewportSize is driven from the `maxHeight`
  // PROP (not a measured clientHeight) so the window is deterministic in jsdom.
  // `getItemKey` reads the live `tableState.rows` so it always reflects the
  // current page's data.
  // svelte-ignore state_referenced_locally — one-time init reads; count/viewport
  // are kept synced below via setCount/setViewportSize.
  const virtualizer = createVirtualizer({
    count: tableState.rows.length,
    estimateSize: rowHeight,
    viewportSize: maxHeight,
    getItemKey: (i) => String(store.rowKeyOf(tableState.rows[i]!)),
  })
  // Bridge the virtualizer store into a $state rune the SAME way as the
  // pro-table/sortable stores, so {#each vState.items} re-renders on setScroll.
  // NB: never name a $state variable `state`.
  let vState = $state(virtualizer.getState())
  $effect(() => {
    const unsub = virtualizer.subscribe((s) => {
      vState = s
    })
    return unsub
  })
  // Keep the virtualizer's count in sync with the current page's row count.
  $effect(() => {
    virtualizer.setCount(tableState.rows.length)
  })
  // Keep the viewport in sync if the maxHeight prop changes.
  $effect(() => {
    virtualizer.setViewportSize(maxHeight)
  })
  // Column virtualization: observe horizontal scroll container width.
  $effect(() => {
    if (!columnVirtualized || !scrollDiv) return
    store.setColumnViewportWidth(scrollDiv.clientWidth)
    const ro = new ResizeObserver(([entry]) => {
      store.setColumnViewportWidth(entry.contentRect.width)
    })
    ro.observe(scrollDiv)
    return () => ro.disconnect()
  })
  // +1 for the leading checkbox column.
  const totalColumnCount = $derived(columns.length + 1)
  // Bottom spacer height: total scrollable size minus what's above + in window.
  const spacerAfter = $derived.by(() => {
    const windowSize = vState.items.reduce((sum, it) => sum + it.size, 0)
    return Math.max(0, vState.totalSize - vState.offsetBefore - windowSize)
  })

  function sortIndicator(key: string): string {
    return tableState.sort?.key === key ? (tableState.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
  }

  // WAI-ARIA grid sort semantics: aria-sort on the header conveys state to
  // screen readers (the visual ▲/▼ is decorative/aria-hidden), and sortable
  // headers are keyboard-operable (Enter/Space) — mirrors the base IrisTable.
  function ariaSort(c: {
    key: string
    sortable?: boolean
  }): 'ascending' | 'descending' | 'none' | undefined {
    return tableState.sort?.key === c.key
      ? tableState.sort.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : c.sortable
        ? 'none'
        : undefined
  }

  function pinnedStyle(c: { pinned?: 'left' | 'right' }): string {
    return c.pinned ? `position:sticky;${c.pinned}:0;z-index:1;` : ''
  }
</script>

<div data-iris-pro-table class={klass}>
  {#snippet scrollContent()}
    {#if columnVirtualized}
      <div
        style="overflow-x:auto"
        onscroll={(e) => store.setHorizontalScroll(e.currentTarget.scrollLeft)}
        bind:this={scrollDiv}
      >
        {@render tableEl()}
      </div>
    {:else}
      {@render tableEl()}
    {/if}
  {/snippet}

  {#if virtualized}
    <div
      data-iris-pro-table-scroll
      style={`overflow:auto;height:${maxHeight}px;`}
      onscroll={(e) => virtualizer.setScroll(e.currentTarget.scrollTop)}
    >
      {@render scrollContent()}
    </div>
  {:else}
    {@render scrollContent()}
  {/if}

  {#snippet tableEl()}
    <table style={colOffset > 0 ? `margin-left:-${colOffset}px` : ''}>
      <thead>
        {#if grouped}
          {#each headerMatrix as rowCells, ri}
            <tr>
              {#if ri === 0}
                <th scope="col" rowspan={headerMatrix.length}>
                  <input
                    type="checkbox"
                    aria-label={proTableLabel(labels, 'selectAll')}
                    checked={store.isAllSelected()}
                    onchange={() => store.toggleAll()}
                  />
                </th>
              {/if}
              {#each rowCells as cell}
                {@const col = cell.column}
                {@const isLeaf = !col.children || col.children.length === 0}
                {#if isLeaf}
                  {@const colWidth = tableState.columnSizes[col.key] ?? col.width}
                  <th
                    scope="col"
                    data-iris-col-key={col.key}
                    aria-sort={ariaSort(col)}
                    tabindex={col.sortable ? 0 : undefined}
                    style={`position:relative;text-align:${col.align ?? 'left'};width:${typeof colWidth === 'number' ? colWidth + 'px' : (colWidth ?? '')};${columnReorder ? 'cursor:grab;touch-action:none;' : ''}${
                      sortableState.activeId &&
                      sortableState.overId === col.key &&
                      sortableState.activeId !== col.key
                        ? 'outline:2px solid var(--iris-color-primary, #2563eb);outline-offset:-2px;'
                        : ''
                    }${pinnedStyle(col)}`}
                    colspan={cell.colSpan}
                    rowspan={cell.rowSpan}
                    data-sortable={col.sortable ? '' : undefined}
                    onclick={col.sortable ? () => store.toggleSort(col.key) : undefined}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        store.toggleSort(col.key)
                      }
                    }}
                    onpointerdown={(e) => onHeaderPointerDown(col.key, e)}
                    onpointermove={(e) => onHeaderPointerMove(col.key, e)}
                    onpointerup={() => onHeaderPointerUp(col.key)}
                    onpointercancel={() => onHeaderPointerCancel()}
                    draggable={columnReorder ? true : undefined}
                    ondragstart={columnReorder
                      ? (e) => {
                          dragKey = col.key
                          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                        }
                      : undefined}
                    ondragover={columnReorder
                      ? (e) => {
                          e.preventDefault()
                          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                        }
                      : undefined}
                    ondrop={columnReorder
                      ? (e) => {
                          e.preventDefault()
                          if (dragKey && dragKey !== col.key) store.reorderColumns(dragKey, col.key)
                          dragKey = null
                        }
                      : undefined}
                  >
                    {col.title}<span aria-hidden="true">{sortIndicator(col.key)}</span>
                    {#if col.resizable ?? typeof col.width === 'number'}
                      <span
                        data-iris-col-resize-handle
                        style="position:absolute;top:0;right:0;bottom:0;width:4px;cursor:col-resize;z-index:2;"
                        onpointerdown={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          const startX = e.clientX
                          const startW = +colWidth
                          const onMove = (ev: PointerEvent) => {
                            ev.preventDefault()
                            store.setColumnWidth(col.key, startW + ev.clientX - startX)
                          }
                          const onUp = () => {
                            document.removeEventListener('pointermove', onMove)
                            document.removeEventListener('pointerup', onUp)
                          }
                          document.addEventListener('pointermove', onMove)
                          document.addEventListener('pointerup', onUp)
                        }}
                      />
                    {/if}
                  </th>
                {:else}
                  <th
                    scope="col"
                    data-iris-col-key={col.key}
                    colspan={cell.colSpan}
                    rowspan={cell.rowSpan}
                    style={`position:relative;text-align:center;${pinnedStyle(col)}`}
                  >
                    {col.title}
                  </th>
                {/if}
              {/each}
            </tr>
          {/each}
        {:else}
          <tr>
            <th scope="col">
              <input
                type="checkbox"
                aria-label={proTableLabel(labels, 'selectAll')}
                checked={store.isAllSelected()}
                onchange={() => store.toggleAll()}
              />
            </th>
            {#each columns as c (c.key)}
              {@const colWidth = tableState.columnSizes[c.key] ?? c.width}
              <th
                scope="col"
                data-iris-col-key={c.key}
                aria-sort={ariaSort(c)}
                tabindex={c.sortable ? 0 : undefined}
                style={`position:relative;text-align:${c.align ?? 'left'};width:${typeof colWidth === 'number' ? colWidth + 'px' : (colWidth ?? '')};${columnReorder ? 'cursor:grab;touch-action:none;' : ''}${
                  sortableState.activeId &&
                  sortableState.overId === c.key &&
                  sortableState.activeId !== c.key
                    ? 'outline:2px solid var(--iris-color-primary, #2563eb);outline-offset:-2px;'
                    : ''
                }${pinnedStyle(c)}`}
                data-sortable={c.sortable ? '' : undefined}
                onclick={c.sortable ? () => store.toggleSort(c.key) : undefined}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    store.toggleSort(c.key)
                  }
                }}
                onpointerdown={(e) => onHeaderPointerDown(c.key, e)}
                onpointermove={(e) => onHeaderPointerMove(c.key, e)}
                onpointerup={() => onHeaderPointerUp(c.key)}
                onpointercancel={() => onHeaderPointerCancel()}
                draggable={columnReorder ? true : undefined}
                ondragstart={columnReorder
                  ? (e) => {
                      dragKey = c.key
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                    }
                  : undefined}
                ondragover={columnReorder
                  ? (e) => {
                      e.preventDefault()
                      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                    }
                  : undefined}
                ondrop={columnReorder
                  ? (e) => {
                      e.preventDefault()
                      if (dragKey && dragKey !== c.key) store.reorderColumns(dragKey, c.key)
                      dragKey = null
                    }
                  : undefined}
              >
                {c.title}<span aria-hidden="true">{sortIndicator(c.key)}</span>
                {#if c.resizable ?? typeof c.width === 'number'}
                  <span
                    data-iris-col-resize-handle
                    style="position:absolute;top:0;right:0;bottom:0;width:4px;cursor:col-resize;z-index:2;"
                    onpointerdown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      const startX = e.clientX
                      const startW = +colWidth
                      const onMove = (ev: PointerEvent) => {
                        ev.preventDefault()
                        store.setColumnWidth(c.key, startW + ev.clientX - startX)
                      }
                      const onUp = () => {
                        document.removeEventListener('pointermove', onMove)
                        document.removeEventListener('pointerup', onUp)
                      }
                      document.addEventListener('pointermove', onMove)
                      document.addEventListener('pointerup', onUp)
                    }}
                  />
                {/if}
              </th>
            {/each}
          </tr>
        {/if}
        {#if columns.some((c) => c.filterable)}
          <tr>
            <th></th>
            {#each columns as c (c.key)}
              <th>
                {#if c.filterable}
                  <input
                    aria-label={proTableLabel(labels, 'filterColumn', { title: c.title })}
                    value={tableState.filters[c.key] ?? ''}
                    oninput={(e) => store.setFilter(c.key, e.currentTarget.value)}
                  />
                {/if}
              </th>
            {/each}
          </tr>
        {/if}
      </thead>
      {#if virtualized}
        <tbody>
          {#if vState.offsetBefore > 0}
            <tr style={`height:${vState.offsetBefore}px`} aria-hidden="true">
              <td colspan={totalColumnCount}></td>
            </tr>
          {/if}
          {#each vState.items as item (item.key)}
            {@const row = tableState.rows[item.index]}
            {#if row !== undefined}
              {@render rowMarkup(row)}
            {/if}
          {/each}
          {#if spacerAfter > 0}
            <tr style={`height:${spacerAfter}px`} aria-hidden="true">
              <td colspan={totalColumnCount}></td>
            </tr>
          {/if}
        </tbody>
      {:else}
        <tbody>
          {#each tableState.rows as row (store.rowKeyOf(row))}
            {@render rowMarkup(row)}
          {/each}
        </tbody>
      {/if}
      {#if Object.keys(tableState.summaryValues).length > 0}
        <tfoot>
          <tr>
            <th scope="row">{labels?.summaryLabel ?? ''}</th>
            {#each columns as c}
              <td style="font-weight:600; text-align:{c.align ?? 'right'}">
                {c.key in tableState.summaryValues ? tableState.summaryValues[c.key] : ''}
              </td>
            {/each}
          </tr>
        </tfoot>
      {/if}
    </table>
  {/snippet}

  {#snippet rowMarkup(row: Row)}
    {@const key = store.rowKeyOf(row)}
    {@const treeRow = treeRowMap.get(key) ?? null}
    <tr data-selected={store.isSelected(key) ? '' : undefined}>
      <td style={treeRow ? `padding-left:${treeRow.depth * 24}px` : ''}>
        {#if treeRow?.hasChildren}
          <span
            role="button"
            tabindex="0"
            aria-expanded={treeRow.expanded}
            aria-label={treeRow.expanded ? 'Collapse' : 'Expand'}
            onclick={() => store.toggleExpand(key)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                store.toggleExpand(key)
              }
            }}>{treeRow.expanded ? '▼' : '▶'}</span
          >
        {:else if treeRow && treeRow.depth > 0}
          <span style="display:inline-block;width:20px;"></span>
        {/if}
        <input
          type="checkbox"
          aria-label={proTableLabel(labels, 'selectRow', { key: String(key) })}
          checked={store.isSelected(key)}
          onchange={() => store.toggleRow(key)}
        />
      </td>
      {#each renderColumns as c (c.key)}
        <td
          style={`text-align:${c.align ?? 'left'};${pinnedStyle(c)}`}
          ondblclick={c.editable ? () => store.startEdit(key, c.key) : undefined}
        >
          {#if tableState.editing?.rowKey === key && tableState.editing?.columnKey === c.key}
            <input
              type={c.editor === 'number' ? 'number' : 'text'}
              value={draft}
              oninput={(e) => (draft = e.currentTarget.value)}
              onblur={() => store.commitEdit(draft)}
              onkeydown={(e) => {
                if (e.key === 'Enter') store.commitEdit(draft)
                if (e.key === 'Escape') store.cancelEdit()
              }}
            />
          {:else}
            {String(store.cellValue(row, c) ?? '')}
          {/if}
        </td>
      {/each}
    </tr>
  {/snippet}

  {#if Object.keys(tableState.filters).some((k) => tableState.filters[k])}
    {@const activeFilters = Object.keys(tableState.filters).filter((k) => tableState.filters[k])}
    {@const colByKey = new Map(tableState.columns.map((c) => [c.key, c]))}
    <div data-iris-filter-chips style="display:flex;flex-wrap:wrap;gap:0.25rem;padding:0.25rem 0;">
      {#each activeFilters as k (k)}
        {@const col = colByKey.get(k)}
        {@const title = col?.title ?? k}
        <span
          style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.125rem 0.5rem;background:var(--iris-chip-bg,var(--iris-surface-alt,#f3f4f6));border-radius:9999px;"
        >
          {title}: "{tableState.filters[k]}"
          <button
            type="button"
            aria-label="Clear filter {title}"
            onclick={() => store.setFilter(k, '')}
            style="background:none;border:none;cursor:pointer;padding:0;">×</button
          >
        </span>
      {/each}
      <button
        type="button"
        onclick={() => store.clearFilters()}
        style="background:none;border:none;cursor:pointer;">Clear all ×</button
      >
    </div>
  {/if}
  <div data-iris-pro-table-footer>
    <button
      type="button"
      disabled={tableState.page <= 1}
      onclick={() => store.setPage(tableState.page - 1)}
    >
      {proTableLabel(labels, 'prev')}
    </button>
    <span data-iris-pro-table-page>{tableState.page} / {store.pageCount()}</span>
    <button
      type="button"
      disabled={tableState.page >= store.pageCount()}
      onclick={() => store.setPage(tableState.page + 1)}
    >
      {proTableLabel(labels, 'next')}
    </button>
  </div>
</div>
