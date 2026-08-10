<script lang="ts">
  import {
    proTableLabel,
    type ProTableLabels,
    type ProTableState,
    type ProTableStore,
  } from '../core'

  type Row = Record<string, unknown>

  let {
    state,
    store,
    labels,
  }: {
    state: ProTableState<Row>
    store: ProTableStore<Row>
    labels?: ProTableLabels
  } = $props()
</script>

{#if Object.keys(state.filters).some((key) => state.filters[key])}
  {@const activeFilters = Object.keys(state.filters).filter((key) => state.filters[key])}
  {@const columns = new Map(state.columns.map((column) => [column.key, column]))}
  <div data-iris-filter-chips style="display:flex;flex-wrap:wrap;gap:0.25rem;padding:0.25rem 0;">
    {#each activeFilters as key (key)}
      {@const title = columns.get(key)?.title ?? key}
      <span
        style="display:inline-flex;align-items:center;gap:0.25rem;padding:var(--iris-space-xxs,4px) var(--iris-space-xs,8px);background:var(--iris-pro-table-chip-bg,var(--iris-surface-hover,#f1f5f9));border-radius:9999px;"
      >
        {title}: "{state.filters[key]}"
        <button
          type="button"
          aria-label="Clear filter {title}"
          onclick={() => store.setFilter(key, '')}
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
  <button type="button" disabled={state.page <= 1} onclick={() => store.setPage(state.page - 1)}>
    {proTableLabel(labels, 'prev')}
  </button>
  <span data-iris-pro-table-page>{state.page} / {store.pageCount()}</span>
  <button
    type="button"
    disabled={state.page >= store.pageCount()}
    onclick={() => store.setPage(state.page + 1)}
  >
    {proTableLabel(labels, 'next')}
  </button>
</div>
