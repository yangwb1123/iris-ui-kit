<script lang="ts">
  import { createVirtualizer, type TreeRow } from '@iris-ui-kit/core'
  import {
    applyColumnWindow,
    createProTableColumnReorder,
    proTableLabel,
    proTableAriaSort,
    proTableSortIndicator,
    type ProTableState,
    type ProTableStore,
    type ProTableViewOptions,
  } from '../core'
  import ProTableFooter from './ProTableFooter.svelte'

  type Row = Record<string, unknown>

  interface IrisProTableProps extends ProTableViewOptions {
    store: ProTableStore<Row>
    class?: string
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
  }: IrisProTableProps = $props()

  // Drag-to-reorder: plain mutable — no $state needed (no re-render on drag events).
  let dragKey: string | null = null

  // NB: do not name this `state` — a leading `$` would make Svelte read `$state`
  // as a store auto-subscription instead of the rune.
  // svelte-ignore state_referenced_locally
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

  const pointerReorder = createProTableColumnReorder()
  const sortable = pointerReorder.sortable
  let sortableState = $state(sortable.getState())
  $effect(() => {
    const unsub = sortable.subscribe(() => {
      sortableState = sortable.getState()
    })
    return unsub
  })
  function onHeaderPointerDown(key: string, e: PointerEvent): void {
    pointerReorder.pointerDown(columnReorder, key, e)
  }
  function onHeaderPointerMove(key: string, e: PointerEvent): void {
    pointerReorder.pointerMove(key, e)
  }
  function onHeaderPointerUp(key: string): void {
    const move = pointerReorder.pointerUp(key)
    if (move) store.reorderColumns(move.from, move.to)
  }
  function onHeaderPointerCancel(): void {
    pointerReorder.pointerCancel()
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

  function pinnedStyle(c: { pinned?: 'left' | 'right' }): string {
    if (!c.pinned) return ''
    const inset = c.pinned === 'left' ? 'inset-inline-start' : 'inset-inline-end'
    return `position:sticky;${inset}:0;z-index:1;`
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
    <table style={colOffset > 0 ? `margin-inline-start:-${colOffset}px` : ''}>
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
                    aria-sort={proTableAriaSort(tableState.sort, col)}
                    tabindex={col.sortable ? 0 : undefined}
                    style={`position:relative;text-align:${col.align ?? 'start'};width:${typeof colWidth === 'number' ? colWidth + 'px' : (colWidth ?? '')};${columnReorder ? 'cursor:grab;touch-action:none;' : ''}${
                      sortableState.activeId &&
                      sortableState.overId === col.key &&
                      sortableState.activeId !== col.key
                        ? 'outline:2px solid var(--iris-primary, #6366f1);outline-offset:-2px;'
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
                    {col.title}<span aria-hidden="true"
                      >{proTableSortIndicator(tableState.sort, col.key)}</span
                    >
                    {#if col.resizable ?? typeof col.width === 'number'}
                      <span
                        data-iris-col-resize-handle
                        role="separator"
                        aria-orientation="vertical"
                        style="position:absolute;top:0;inset-inline-end:0;bottom:0;width:4px;cursor:col-resize;z-index:2;"
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
                      ></span>
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
                aria-sort={proTableAriaSort(tableState.sort, c)}
                tabindex={c.sortable ? 0 : undefined}
                style={`position:relative;text-align:${c.align ?? 'start'};width:${typeof colWidth === 'number' ? colWidth + 'px' : (colWidth ?? '')};${columnReorder ? 'cursor:grab;touch-action:none;' : ''}${
                  sortableState.activeId &&
                  sortableState.overId === c.key &&
                  sortableState.activeId !== c.key
                    ? 'outline:2px solid var(--iris-primary, #6366f1);outline-offset:-2px;'
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
                {c.title}<span aria-hidden="true"
                  >{proTableSortIndicator(tableState.sort, c.key)}</span
                >
                {#if c.resizable ?? typeof c.width === 'number'}
                  <span
                    data-iris-col-resize-handle
                    role="separator"
                    aria-orientation="vertical"
                    style="position:absolute;top:0;inset-inline-end:0;bottom:0;width:4px;cursor:col-resize;z-index:2;"
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
                  ></span>
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
              <td style="font-weight:600; text-align:{c.align ?? 'end'}">
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
    <tr
      data-selected={store.isSelected(key) ? '' : undefined}
      style={store.isSelected(key)
        ? 'background:var(--iris-pro-table-selected-bg,var(--iris-surface-selected,#eef2ff))'
        : ''}
    >
      <td style={treeRow ? `padding-inline-start:${treeRow.depth * 24}px` : ''}>
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
          style={`text-align:${c.align ?? 'start'};${pinnedStyle(c)}`}
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

  <ProTableFooter state={tableState} {store} {labels} />
</div>
