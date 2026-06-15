<script lang="ts">
  // Dedicated cross-framework contract harness for the useDataSource bridge over
  // createDataSource (the unified v2 data engine).
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): this
  // drives the data engine end-to-end — an initial synchronous client load, then
  // setSort / setFilter / clearFilters — and renders one `[data-iris-ds-row]` per
  // live row. Keeping it in its own container — exactly like the React reference's
  // dedicated <DataSourceHarness> — keeps those row elements out of the shared
  // container so they can't interact with other scenarios' selector counts.
  //
  // Thin bridge: this harness only renders + wires. All logic lives in
  // @iris-ui/core; the Svelte `useDataSource` bridge exposes the live engine state
  // through a `$state` rune (`ds.state`), so the `{#each}` below re-runs on every
  // store emission — sort/filter/clear all reflect REACTIVELY with no manual
  // bookkeeping here. Same data (Charlie/30, Alice/25, Bob/35, `name` filterable),
  // columns, and trigger wiring as the React reference harness.
  //
  // Svelte-5 reserved-word note: the bridge's reactive accessor is `ds.state`
  // (read off the returned controller). We deliberately do NOT introduce a local
  // `$state`-backed variable named `state` here — that name clashes with Svelte's
  // reserved rune-adjacent identifier; the bridge already owns the rune internally.
  import { createSyncClientDataSource, type DataViewColumn } from '@iris-ui/core'
  import { useDataSource } from './data/useDataSource.svelte'

  interface DsRow extends Record<string, unknown> {
    id: number
    name: string
    age: number
  }

  const dsData: DsRow[] = [
    { id: 1, name: 'Charlie', age: 30 },
    { id: 2, name: 'Alice', age: 25 },
    { id: 3, name: 'Bob', age: 35 },
  ]
  const dsColumns: DataViewColumn<DsRow>[] = [
    { key: 'name', getValue: (r) => r.name, filterable: true },
    { key: 'age', getValue: (r) => r.age },
  ]

  const ds = useDataSource<DsRow>({
    fetcher: createSyncClientDataSource(dsData, dsColumns),
    pageSize: 10,
  })
</script>

<div>
  <button data-iris-ds-sort onclick={() => ds.setSort({ key: 'age', direction: 'asc' })}>
    sort
  </button>
  <button data-iris-ds-filter onclick={() => ds.setFilter('name', 'li')}>filter</button>
  <button data-iris-ds-clear onclick={() => ds.clearFilters()}>clear</button>
  {#each ds.state.rows as r (r.id)}
    <div data-iris-ds-row>{r.name}</div>
  {/each}
</div>
