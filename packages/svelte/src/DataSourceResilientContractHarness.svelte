<script lang="ts">
  // Dedicated cross-framework RESILIENT contract harness for the useDataSource
  // bridge over createDataSource with `resilient` enabled.
  //
  // Paged engine (pageSize 10) + `resilient: { ttlMs: 60_000 }` over three rows —
  // Charlie(30) / Alice(25) / Bob(35). The fetcher reads a MUTABLE backing store
  // and returns per-row COPIES (never aliasing it), so the rename mutation
  // becomes visible ONLY through a real re-fetch; `data-fetches` (fetcher
  // invocations — cache misses only) proves reload-within-TTL is a cache hit,
  // multiSort changes produce distinct cache keys, and a successful mutate
  // auto-invalidates. Mirrors the React reference's resilient harness.
  //
  // Thin bridge: this harness only renders + wires. All logic lives in
  // @iris-ui-kit/core. The Svelte `useDataSource` bridge exposes the live engine
  // state through a `$state` rune (`ds.state`), so the `{#each}` + the
  // `data-iris-ds-meta` attributes re-run on every store emission.
  import {
    filterSort,
    paginate,
    type DataViewColumn,
    type DataSourceQuery,
  } from '@iris-ui-kit/core'
  import { useDataSource } from './data/useDataSource.svelte'

  interface DsRow extends Record<string, unknown> {
    id: number
    name: string
    age: number
  }

  const dsResilientData: DsRow[] = [
    { id: 1, name: 'Charlie', age: 30 },
    { id: 2, name: 'Alice', age: 25 },
    { id: 3, name: 'Bob', age: 35 },
  ]
  const dsColumns: DataViewColumn<DsRow>[] = [
    { key: 'name', getValue: (r) => r.name, filterable: true },
    { key: 'age', getValue: (r) => r.age },
  ]

  // Per-instance mutable backing store (the "server" side of the harness).
  const backing: DsRow[] = dsResilientData.map((r) => ({ ...r }))
  let fetches = $state(0)
  const fetcher = (q: DataSourceQuery) => {
    const processed = filterSort(backing, dsColumns, {
      filters: q.filters,
      sort: q.sort,
      multiSort: q.multiSort,
      filterRules: q.filterRules,
    })
    fetches += 1
    return {
      rows: paginate(processed, q.page, q.pageSize).map((r) => ({ ...r })),
      total: processed.length,
    }
  }
  const renameFirst = () => {
    backing[0] = { ...backing[0]!, name: `${backing[0]!.name}!` }
  }

  const ds = useDataSource<DsRow>({ fetcher, pageSize: 10, resilient: { ttlMs: 60000 } })
</script>

<div>
  <button data-iris-ds-reload onclick={() => void ds.reload()}>reload</button>
  <button
    data-iris-ds-multisort-a
    onclick={() => ds.setMultiSort([{ key: 'age', direction: 'asc' }])}
  >
    sortAge
  </button>
  <button
    data-iris-ds-multisort-b
    onclick={() => ds.setMultiSort([{ key: 'name', direction: 'desc' }])}
  >
    sortName
  </button>
  <button data-iris-ds-mutate onclick={() => void ds.mutate(async () => renameFirst())}>
    mutate
  </button>
  <div data-iris-ds-meta data-fetches={String(fetches)}></div>
  {#each ds.state.rows as r (r.id)}
    <div data-iris-ds-row>{r.name}</div>
  {/each}
</div>
