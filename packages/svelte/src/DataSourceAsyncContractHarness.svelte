<script lang="ts">
  // Dedicated cross-framework ASYNC contract harness for the useDataSource bridge
  // over createDataSource (the unified v2 data engine) in `infinite` mode.
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte, nor the
  // sync DataSourceContractHarness): this drives the engine's ASYNC path — an
  // injectable-latency fetcher that resolves on a microtask (never synchronously),
  // so every op (initial load, loadMore append, optimistic mutate commit/rollback,
  // reload re-fetch) round-trips through the Promise path exactly as a real
  // network source would. Keeping it in its own container keeps these row + meta
  // elements out of the shared container so they can't collide with other
  // scenarios' selector counts. Mirrors the React reference's async harness.
  //
  // Thin bridge: this harness only renders + wires. All logic lives in
  // @iris-ui/core. The Svelte `useDataSource` bridge exposes the live engine state
  // through a `$state` rune (`ds.state`), so the `{#each}` + the `data-iris-ds-meta`
  // attributes below re-run on every store emission. A local `$state` fetch counter
  // (bumped by the latency fetcher) reflects re-fetches into `data-fetches` so the
  // attribute-only contract runner can observe that a fetch actually fired.
  //
  // Svelte-5 reserved-word note: the bridge's reactive accessor is `ds.state`; we
  // deliberately do NOT introduce a local `$state`-backed variable named `state`.
  import { createClientDataSource, type DataViewColumn } from '@iris-ui/core'
  import { useDataSource } from './data/useDataSource.svelte'

  interface DsRow extends Record<string, unknown> {
    id: number
    name: string
    age: number
  }

  const dsAsyncData: DsRow[] = [
    { id: 1, name: 'Ann', age: 20 },
    { id: 2, name: 'Ben', age: 21 },
    { id: 3, name: 'Cara', age: 22 },
    { id: 4, name: 'Dan', age: 23 },
    { id: 5, name: 'Eve', age: 24 },
  ]
  const dsColumns: DataViewColumn<DsRow>[] = [
    { key: 'name', getValue: (r) => r.name, filterable: true },
    { key: 'age', getValue: (r) => r.age },
  ]

  let fetches = $state(0)
  const base = createClientDataSource<DsRow>(dsAsyncData, dsColumns)
  const fetcher = async (q: Parameters<typeof base>[0]) => {
    await Promise.resolve()
    const result = await base(q)
    fetches += 1
    return result
  }

  const ds = useDataSource<DsRow>({ fetcher, mode: 'infinite', pageSize: 2 })

  const rename = (suffix: string, fail: boolean) =>
    void ds
      .mutate(() => (fail ? Promise.reject(new Error('boom')) : Promise.resolve()), {
        optimistic: (rows) =>
          rows.map((r, i) => (i === 0 ? { ...r, name: `${r.name}${suffix}` } : r)),
        skipReload: !fail,
      })
      .catch(() => {})
</script>

<div>
  <button data-iris-ds-loadmore onclick={() => void ds.loadMore()}>loadMore</button>
  <button data-iris-ds-reload onclick={() => void ds.reload()}>reload</button>
  <button data-iris-ds-rename onclick={() => rename('*', false)}>rename</button>
  <button data-iris-ds-rename-fail onclick={() => rename('!', true)}>renameFail</button>
  <div
    data-iris-ds-meta
    data-hasmore={String(ds.state.hasMore)}
    data-loading={String(ds.state.loading)}
    data-fetches={String(fetches)}
  ></div>
  {#each ds.state.rows as r (r.id)}
    <div data-iris-ds-row>{r.name}</div>
  {/each}
</div>
