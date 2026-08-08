import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import {
  createClientDataSource,
  type DataSourceQuery,
  type DataViewColumn,
} from '@iris-ui-kit/core'
import { useDataSource, type UseDataSource } from './useDataSource'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const data: Row[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
  { id: 3, name: 'Bob', age: 35 },
]
const columns: DataViewColumn<Row>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'age', getValue: (r) => r.age },
]

/**
 * Mount a probe that exposes the bridge return. Settles the async client load
 * unless `opts.settle === false` (for tests that need to control resolution).
 */
async function mountDataSource(
  config: Parameters<typeof useDataSource<Row>>[0],
  opts?: { settle?: boolean },
) {
  let ds!: UseDataSource<Row>
  const Probe = defineComponent({
    setup() {
      ds = useDataSource<Row>(config)
      return () => h('div', String(ds.state.value.rows.length))
    },
  })
  const wrapper = mount(Probe)
  if (opts?.settle !== false) {
    // createClientDataSource's fetcher is async — settle the onMounted load.
    await flushPromises()
    await nextTick()
  }
  return { wrapper, get: () => ds }
}

/**
 * Counted latency fetcher: wraps the async client source but resolves on a
 * microtask (never synchronously), so every op round-trips through the engine's
 * Promise path. `getFetches()` proves a re-fetch fired.
 */
function makeCountedFetcher() {
  const base = createClientDataSource(data, columns)
  let fetches = 0
  const fetcher = async (q: Parameters<typeof base>[0]) => {
    await Promise.resolve()
    const result = await base(q)
    fetches += 1
    return result
  }
  return { fetcher, getFetches: () => fetches }
}

describe('useDataSource (vue)', () => {
  it('loads on mount and re-sorts reactively', async () => {
    const { get } = await mountDataSource({
      fetcher: createClientDataSource(data, columns),
      pageSize: 10,
    })
    expect(get().state.value.rows).toHaveLength(3)

    get().setSort({ key: 'age', direction: 'asc' })
    await flushPromises()
    await nextTick()
    expect(get().state.value.rows.map((r) => r.age)).toEqual([25, 30, 35])
  })

  it('infinite mode appends via loadMore + flips hasMore', async () => {
    const { get } = await mountDataSource({
      fetcher: createClientDataSource(data, columns),
      pageSize: 2,
      mode: 'infinite',
    })
    expect(get().state.value.rows).toHaveLength(2)
    expect(get().state.value.hasMore).toBe(true)

    await get().loadMore()
    await flushPromises()
    await nextTick()
    expect(get().state.value.rows).toHaveLength(3)
    expect(get().state.value.hasMore).toBe(false)
  })

  it('filters reactively', async () => {
    const { get } = await mountDataSource({
      fetcher: createClientDataSource(data, columns),
      pageSize: 10,
    })
    expect(get().state.value.rows).toHaveLength(3)

    get().setFilter('name', 'li')
    await flushPromises()
    await nextTick()
    expect(
      get()
        .state.value.rows.map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Charlie'])
  })

  it('mutate rolls back optimistically and reloads on rejection', async () => {
    const { fetcher, getFetches } = makeCountedFetcher()
    const { get } = await mountDataSource({ fetcher, pageSize: 10 })
    expect(getFetches()).toBe(1)

    const p = get().mutate(() => Promise.reject(new Error('boom')), {
      optimistic: (rows) => rows.filter((r) => r.id !== 2),
    })
    // Optimistic value is visible synchronously (store notifies inline).
    expect(get().state.value.rows.map((r) => r.id)).toEqual([1, 3])

    await expect(p).rejects.toThrow('boom')
    await flushPromises()
    await nextTick()
    // Snapshot restored + a reload fired (the loading cycle proof).
    expect(get().state.value.rows.map((r) => r.id)).toEqual([1, 2, 3])
    expect(getFetches()).toBe(2)
    expect(get().state.value.loading).toBe(false)
  })

  it('mutateRow tracks pendingRows and records rowErrors on rejection', async () => {
    const { fetcher, getFetches } = makeCountedFetcher()
    const { get } = await mountDataSource({ fetcher, pageSize: 10 })
    expect(getFetches()).toBe(1)

    let rejectAction!: (error: Error) => void
    const p = get().mutateRow(
      '3',
      () =>
        new Promise((_, reject) => {
          rejectAction = reject
        }),
      { optimistic: (rows) => rows.filter((r) => r.id !== 3) },
    )
    // Pending marker + optimistic row are set synchronously before the await.
    expect(get().state.value.pendingRows).toEqual(['3'])
    expect(get().state.value.rows.map((r) => r.id)).toEqual([1, 2])

    rejectAction(new Error('nope'))
    await expect(p).rejects.toThrow('nope')
    await flushPromises()
    await nextTick()
    // Rejection clears the pending marker, records the per-row error, rolls back.
    expect(get().state.value.pendingRows).toEqual([])
    expect((get().state.value.rowErrors['3'] as Error).message).toBe('nope')
    expect(get().state.value.rows.map((r) => r.id)).toEqual([1, 2, 3])
    // Core rethrows before the reload check — no refetch on a failed mutateRow.
    expect(getFetches()).toBe(1)

    // Success path: pending clears, error cleared, optimistic value persists.
    await get().mutateRow('2', () => Promise.resolve(), {
      optimistic: (rows) => rows.map((r) => (r.id === 2 ? { ...r, name: 'Alice!' } : r)),
      skipReload: true,
    })
    expect(get().state.value.pendingRows).toEqual([])
    expect(get().state.value.rowErrors['2']).toBeUndefined()
    expect(get().state.value.rows.find((r) => r.id === 2)?.name).toBe('Alice!')
    expect(getFetches()).toBe(1)
  })

  it('unmounting before a slow fetch resolves leaves state untouched', async () => {
    let resolveFetch!: (result: { rows: Row[]; total: number }) => void
    const fetcher = vi.fn(
      (_query: DataSourceQuery) =>
        new Promise<{ rows: Row[]; total: number }>((resolve) => {
          resolveFetch = resolve
        }),
    )
    const { wrapper, get } = await mountDataSource({ fetcher, pageSize: 10 }, { settle: false })
    // Let onMounted → load() start; the deferred fetch stays in flight.
    await flushPromises()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(get().state.value.rows).toEqual([])
    expect(get().state.value.loading).toBe(true)

    wrapper.unmount() // onScopeDispose → controller.destroy(): epoch bump + abort

    const stateBefore = get().state.value
    expect(stateBefore.loading).toBe(true)

    resolveFetch({ rows: data, total: data.length })
    await flushPromises()
    await nextTick()

    // The late response never writes back through the bridge's reactive ref…
    expect(get().state.value).toBe(stateBefore)
    // …nor into the store (the epoch guard dropped it — the destroy wiring is
    // proven at the store level, not merely the ref-detachment of useStore).
    expect(get().store.getState().rows).toEqual([])
    expect(get().store.getState().loading).toBe(true)
  })

  it('immediate: false defers the first load to an explicit call', async () => {
    const { fetcher, getFetches } = makeCountedFetcher()
    const { get } = await mountDataSource({ fetcher, pageSize: 10, immediate: false })
    // No mount-time fetch (the onMounted gate skips the load).
    expect(getFetches()).toBe(0)
    expect(get().state.value.loading).toBe(false)
    expect(get().state.value.rows).toEqual([])

    await get().load()
    await flushPromises()
    await nextTick()
    expect(getFetches()).toBe(1)
    expect(get().state.value.rows).toHaveLength(3)
  })
})
