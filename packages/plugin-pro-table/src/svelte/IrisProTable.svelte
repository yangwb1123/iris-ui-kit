<script lang="ts">
  import type { ProTableState, ProTableStore } from '../core'

  type Row = Record<string, unknown>

  let { store, class: klass = '' }: { store: ProTableStore<Row>; class?: string } = $props()

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

  function pinnedStyle(c: { pinned?: 'left' | 'right' }): string {
    return c.pinned ? `position:sticky;${c.pinned}:0;z-index:1;` : ''
  }
</script>

<div data-iris-pro-table class={klass}>
  <table>
    <thead>
      <tr>
        <th>
          <input
            type="checkbox"
            aria-label="Select all"
            checked={store.isAllSelected()}
            onchange={() => store.toggleAll()}
          />
        </th>
        {#each columns as c (c.key)}
          <th
            style={`text-align:${c.align ?? 'left'};${pinnedStyle(c)}`}
            data-sortable={c.sortable ? '' : undefined}
            onclick={c.sortable ? () => store.toggleSort(c.key) : undefined}
          >
            {c.title}{sortIndicator(c.key)}
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
                  aria-label={`Filter ${c.title}`}
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
              aria-label={`Select row ${key}`}
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
  <div data-iris-pro-table-footer>
    <button
      type="button"
      disabled={tableState.page <= 1}
      onclick={() => store.setPage(tableState.page - 1)}
    >
      Prev
    </button>
    <span data-iris-pro-table-page>{tableState.page} / {store.pageCount()}</span>
    <button
      type="button"
      disabled={tableState.page >= store.pageCount()}
      onclick={() => store.setPage(tableState.page + 1)}
    >
      Next
    </button>
  </div>
</div>
