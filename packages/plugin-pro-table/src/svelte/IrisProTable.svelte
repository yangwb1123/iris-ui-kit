<script lang="ts">
  import { proTableLabel, type ProTableLabels, type ProTableState, type ProTableStore } from '../core'

  type Row = Record<string, unknown>

  let {
    store,
    class: klass = '',
    labels,
    columnReorder = false,
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
  } = $props()

  // Drag-to-reorder: plain mutable — no $state needed (no re-render on drag events).
  let dragKey: string | null = null

  // NB: do not name this `state` — a leading `$` would make Svelte read `$state`
  // as a store auto-subscription instead of the rune.
  let tableState: ProTableState<Row> = $state(store.getState())
  let draft = $state('')

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

  const columns = $derived(store.visibleColumns())

  function sortIndicator(key: string): string {
    return tableState.sort?.key === key
      ? tableState.sort.direction === 'asc'
        ? ' ▲'
        : ' ▼'
      : ''
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
  <table>
    <thead>
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
          <th
            scope="col"
            aria-sort={ariaSort(c)}
            tabindex={c.sortable ? 0 : undefined}
            style={`text-align:${c.align ?? 'left'};${columnReorder ? 'cursor:grab;' : ''}${pinnedStyle(c)}`}
            data-sortable={c.sortable ? '' : undefined}
            onclick={c.sortable ? () => store.toggleSort(c.key) : undefined}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                store.toggleSort(c.key)
              }
            }}
            draggable={columnReorder ? true : undefined}
            ondragstart={columnReorder ? (e) => {
              dragKey = c.key
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
            } : undefined}
            ondragover={columnReorder ? (e) => {
              e.preventDefault()
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
            } : undefined}
            ondrop={columnReorder ? (e) => {
              e.preventDefault()
              if (dragKey && dragKey !== c.key) store.reorderColumns(dragKey, c.key)
              dragKey = null
            } : undefined}
          >
            {c.title}<span aria-hidden="true">{sortIndicator(c.key)}</span>
          </th>
        {/each}
      </tr>
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
    <tbody>
      {#each tableState.rows as row (store.rowKeyOf(row))}
        {@const key = store.rowKeyOf(row)}
        <tr data-selected={store.isSelected(key) ? '' : undefined}>
          <td>
            <input
              type="checkbox"
              aria-label={proTableLabel(labels, 'selectRow', { key: String(key) })}
              checked={store.isSelected(key)}
              onchange={() => store.toggleRow(key)}
            />
          </td>
          {#each columns as c (c.key)}
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
      {/each}
    </tbody>
  </table>
  {#if Object.keys(tableState.filters).some((k) => tableState.filters[k])}
    {@const activeFilters = Object.keys(tableState.filters).filter((k) => tableState.filters[k])}
    {@const colByKey = new Map(tableState.columns.map((c) => [c.key, c]))}
    <div data-iris-filter-chips style="display:flex;flex-wrap:wrap;gap:0.25rem;padding:0.25rem 0;">
      {#each activeFilters as k (k)}
        {@const col = colByKey.get(k)}
        {@const title = col?.title ?? k}
        <span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.125rem 0.5rem;background:var(--iris-chip-bg,var(--iris-surface-alt,#f3f4f6));border-radius:9999px;">
          {title}: "{tableState.filters[k]}"
          <button
            type="button"
            aria-label="Clear filter {title}"
            onclick={() => store.setFilter(k, '')}
            style="background:none;border:none;cursor:pointer;padding:0;"
          >×</button>
        </span>
      {/each}
      <button
        type="button"
        onclick={() => store.clearFilters()}
        style="background:none;border:none;cursor:pointer;"
      >Clear all ×</button>
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
