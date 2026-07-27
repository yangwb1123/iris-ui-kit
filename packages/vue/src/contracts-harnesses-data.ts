import { defineComponent, h } from 'vue'
import {
  createSyncClientDataSource,
  createClientDataSource,
  type DataViewColumn,
} from '@iris-ui-kit/core'
import { useDataSource } from './data/useDataSource'

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

export const DataSourceHarness = defineComponent({
  name: 'DataSourceHarness',
  setup() {
    const ds = useDataSource<DsRow>({
      fetcher: createSyncClientDataSource(dsData, dsColumns),
      pageSize: 10,
    })
    return () =>
      h('div', null, [
        h(
          'button',
          { 'data-iris-ds-sort': '', onClick: () => ds.setSort({ key: 'age', direction: 'asc' }) },
          'sort',
        ),
        h(
          'button',
          { 'data-iris-ds-filter': '', onClick: () => ds.setFilter('name', 'li') },
          'filter',
        ),
        h('button', { 'data-iris-ds-clear': '', onClick: () => ds.clearFilters() }, 'clear'),
        ...ds.state.value.rows.map((r) => h('div', { key: r.id, 'data-iris-ds-row': '' }, r.name)),
      ])
  },
})

/** Async-contract dataset: 5 rows, infinite mode, pageSize 2 (page 1 = Ann/Ben). */
const dsAsyncData: DsRow[] = [
  { id: 1, name: 'Ann', age: 20 },
  { id: 2, name: 'Ben', age: 21 },
  { id: 3, name: 'Cara', age: 22 },
  { id: 4, name: 'Dan', age: 23 },
  { id: 5, name: 'Eve', age: 24 },
]

/**
 * Injectable-latency fetcher for the async contract: wraps the async client data
 * source but resolves ON A MICROTASK (never synchronously), so every op round-
 * trips through the engine's Promise path. `getFetches()` proves a re-fetch
 * fired. Identical ×4 harness.
 */
function makeLatencyFetcher() {
  const base = createClientDataSource<DsRow>(dsAsyncData, dsColumns)
  let fetches = 0
  const fetcher = async (q: Parameters<typeof base>[0]) => {
    await Promise.resolve()
    const result = await base(q)
    fetches += 1
    return result
  }
  return { fetcher, getFetches: () => fetches }
}

export const DataSourceAsyncHarness = defineComponent({
  name: 'DataSourceAsyncHarness',
  setup() {
    const { fetcher, getFetches } = makeLatencyFetcher()
    const ds = useDataSource<DsRow>({ fetcher, mode: 'infinite', pageSize: 2 })
    const rename = (suffix: string, fail: boolean) =>
      void ds
        .mutate(() => (fail ? Promise.reject(new Error('boom')) : Promise.resolve()), {
          optimistic: (rows) =>
            rows.map((r, i) => (i === 0 ? { ...r, name: `${r.name}${suffix}` } : r)),
          skipReload: !fail,
        })
        .catch(() => {})
    return () =>
      h('div', null, [
        h('button', { 'data-iris-ds-loadmore': '', onClick: () => void ds.loadMore() }, 'loadMore'),
        h('button', { 'data-iris-ds-reload': '', onClick: () => void ds.reload() }, 'reload'),
        h('button', { 'data-iris-ds-rename': '', onClick: () => rename('*', false) }, 'rename'),
        h(
          'button',
          { 'data-iris-ds-rename-fail': '', onClick: () => rename('!', true) },
          'renameFail',
        ),
        h('div', {
          'data-iris-ds-meta': '',
          'data-hasmore': String(ds.state.value.hasMore),
          'data-loading': String(ds.state.value.loading),
          'data-fetches': String(getFetches()),
        }),
        ...ds.state.value.rows.map((r) => h('div', { key: r.id, 'data-iris-ds-row': '' }, r.name)),
      ])
  },
})
