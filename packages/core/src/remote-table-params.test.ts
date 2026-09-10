import { describe, expect, it, vi } from 'vitest'
import { createRemoteTableSource, type RemoteTableParams } from './remote-table'

/** Build a query spy over a fixed dataset, paged offset-style. */
function datasetQuery(total: number) {
  const all = Array.from({ length: total }, (_, i) => i)
  return vi.fn(async ({ page, pageSize }: RemoteTableParams) => {
    const start = (page - 1) * pageSize
    return { rows: all.slice(start, start + pageSize), total }
  })
}

describe('createRemoteTableSource', () => {
  it('auto-loads the first page on creation (autoLoad default true)', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: {},
    })
    await vi.waitFor(() =>
      expect(source.getState()).toMatchObject({
        data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        total: 25,
        loading: false,
        error: null,
        params: { page: 1, pageSize: 10, sort: null, filters: {} },
      }),
    )
  })

  it('honors initialParams (page/pageSize/sort/filters) on the first request', async () => {
    const query = datasetQuery(100)
    createRemoteTableSource({
      query,
      initialParams: { page: 3, pageSize: 5, sort: { key: 'name', direction: 'desc' } },
    })
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 3,
      pageSize: 5,
      sort: { key: 'name', direction: 'desc' },
      filters: {},
    })
  })

  it('normalizes invalid initial paging independently to safe defaults', () => {
    const invalidValues = [0, -1, NaN, Infinity, -Infinity]

    for (const value of invalidValues) {
      const invalidPage = createRemoteTableSource({
        query: datasetQuery(25),
        autoLoad: false,
        initialParams: { page: value, pageSize: 7 },
      })
      expect(invalidPage.getState().params).toMatchObject({ page: 1, pageSize: 7 })

      const invalidPageSize = createRemoteTableSource({
        query: datasetQuery(25),
        autoLoad: false,
        initialParams: { page: 3, pageSize: value },
      })
      expect(invalidPageSize.getState().params).toMatchObject({ page: 3, pageSize: 10 })
    }
  })

  it('truncates positive fractional initial and updated paging', () => {
    const query = datasetQuery(100)
    const source = createRemoteTableSource({
      query,
      autoLoad: false,
      initialParams: { page: 2.9, pageSize: 7.9 },
    })
    expect(source.getState().params).toMatchObject({ page: 2, pageSize: 7 })

    expect(source.setParams({ page: 4.9, pageSize: 12.9 })).toBe(true)
    expect(source.getState().params).toMatchObject({ page: 4, pageSize: 12 })
    expect(query.mock.calls[0]?.[0]).toMatchObject({ page: 4, pageSize: 12 })
  })

  it('normalizes invalid partial paging updates without breaking the invariant', () => {
    const source = createRemoteTableSource({
      query: datasetQuery(25),
      autoLoad: false,
      initialParams: { page: 2, pageSize: 7 },
    })

    for (const value of [0, -1, NaN, Infinity, -Infinity]) {
      expect(source.setParams({ page: value })).toBe(false)
      expect(source.setParams({ pageSize: value })).toBe(false)
    }
    expect(source.getState().params).toMatchObject({ page: 2, pageSize: 7 })
  })

  it('autoLoad=false does not query until the first setParams', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query, autoLoad: false })
    expect(query).not.toHaveBeenCalled()
    source.setParams({ page: 2 })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 2,
      pageSize: 10,
      sort: null,
      filters: {},
    })
  })

  it('setParams triggers a reload with the merged params', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    await vi.waitFor(() => expect(source.getState().loading).toBe(false))
    query.mockClear()
    source.setParams({ page: 2 })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 2,
      pageSize: 10,
      sort: null,
      filters: {},
    })
    await vi.waitFor(() =>
      expect(source.getState().data).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
    )
  })

  it('forwards AbortSignal separately while keeping one-argument queries compatible', async () => {
    const signalQuery = vi.fn(
      async (
        params: RemoteTableParams,
        signal?: AbortSignal,
      ): Promise<{ rows: number[]; total: number }> => {
        expect(Object.keys(params)).toEqual(['page', 'pageSize', 'sort', 'filters'])
        expect(signal).toBeInstanceOf(AbortSignal)
        return { rows: [params.page], total: 1 }
      },
    )
    const source = createRemoteTableSource({ query: signalQuery })
    await vi.waitFor(() => expect(source.getState().data).toEqual([1]))
    expect(signalQuery.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)

    const oneArgumentQuery = vi.fn(async (params: RemoteTableParams) => ({
      rows: [params.page],
      total: 1,
    }))
    const compatible = createRemoteTableSource({ query: oneArgumentQuery })
    await vi.waitFor(() => expect(compatible.getState().data).toEqual([1]))
  })

  it('passes resilient options through while preserving the query shape and initial request count', async () => {
    let now = 0
    const query = vi.fn(
      async (
        params: RemoteTableParams,
        signal?: AbortSignal,
      ): Promise<{ rows: number[]; total: number }> => {
        expect(Object.keys(params)).toEqual(['page', 'pageSize', 'sort', 'filters'])
        expect(signal).toBeInstanceOf(AbortSignal)
        return { rows: [params.page], total: 1 }
      },
    )
    const source = createRemoteTableSource({
      query,
      resilient: { ttlMs: 100, breaker: false, now: () => now },
    })

    await vi.waitFor(() => expect(source.getState().data).toEqual([1]))
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: {},
    })

    await source.refetch()
    expect(query).toHaveBeenCalledTimes(1)
    now = 100
    await source.refetch()
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('sort/filter changes RESET the page to 1 (vxe behavior)', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    source.setParams({ page: 3 })
    expect(source.getState().params.page).toBe(3)

    source.setParams({ sort: { key: 'name', direction: 'asc' } })
    expect(source.getState().params).toMatchObject({
      page: 1,
      sort: { key: 'name', direction: 'asc' },
    })
    expect(query.mock.lastCall?.[0]).toMatchObject({
      page: 1,
      sort: { key: 'name', direction: 'asc' },
    })

    source.setParams({ page: 2 })
    source.setParams({ filters: { role: 'admin' } })
    expect(source.getState().params).toMatchObject({ page: 1, filters: { role: 'admin' } })
    expect(query.mock.lastCall?.[0]).toMatchObject({
      page: 1,
      filters: { role: 'admin' },
    })
  })

  it('setParams with unchanged params is a no-op (no duplicate request)', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    query.mockClear()
    // Returns false (no request) when nothing changed — callers that must
    // re-query regardless (e.g. form reset) fall back to refetch().
    expect(source.setParams({ page: 1 })).toBe(false)
    expect(source.setParams({ sort: null })).toBe(false)
    expect(source.setParams({ filters: {} })).toBe(false)
    expect(query).not.toHaveBeenCalled()
  })

  it('setParams returns true when a request fires (params changed)', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query, autoLoad: false })
    expect(source.setParams({ page: 2 })).toBe(true)
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    // Same value again → no-op.
    query.mockClear()
    expect(source.setParams({ page: 2 })).toBe(false)
    expect(query).not.toHaveBeenCalled()
  })

  it('multiSort: setParams({ sorts }) re-queries with `sorts` and nulls `sort`', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    await vi.waitFor(() => expect(source.getState().loading).toBe(false))
    query.mockClear()
    source.setParams({ sorts: [{ key: 'team', direction: 'asc' }] })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [{ key: 'team', direction: 'asc' }],
      filters: {},
    })
    expect(source.getState().params).toMatchObject({
      page: 1,
      sort: null,
      sorts: [{ key: 'team', direction: 'asc' }],
    })
  })

  it('switches cleanly between multi-sort and single-sort channels', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query, autoLoad: false })

    source.setParams({ sorts: [{ key: 'team', direction: 'asc' }] })
    expect(source.getState().params).toMatchObject({
      sort: null,
      sorts: [{ key: 'team', direction: 'asc' }],
    })

    query.mockClear()
    source.setParams({ sort: { key: 'name', direction: 'desc' } })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'desc' },
      filters: {},
    })
    expect(source.getState().params.sorts).toBeUndefined()

    query.mockClear()
    source.setParams({ sorts: [{ key: 'id', direction: 'desc' }] })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [{ key: 'id', direction: 'desc' }],
      filters: {},
    })
    expect(source.getState().params).toMatchObject({
      sort: null,
      sorts: [{ key: 'id', direction: 'desc' }],
    })
  })

  it('multiSort: sorts changes reset the page to 1; same-value sorts dedupe', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    source.setParams({ page: 3, sorts: [{ key: 'team', direction: 'asc' }] })
    expect(source.getState().params.page).toBe(1)
    expect(source.getState().params.sorts).toEqual([{ key: 'team', direction: 'asc' }])
    query.mockClear()
    // Fresh object identity, same value → no re-query.
    expect(source.setParams({ sorts: [{ key: 'team', direction: 'asc' }] })).toBe(false)
    expect(query).not.toHaveBeenCalled()
    // Order matters: swapping the list is a real change.
    source.setParams({
      sorts: [
        { key: 'age', direction: 'desc' },
        { key: 'team', direction: 'asc' },
      ],
    })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [
        { key: 'age', direction: 'desc' },
        { key: 'team', direction: 'asc' },
      ],
      filters: {},
    })
  })

  it('multiSort: clearing sorts back to [] re-queries with no sorts and sort null', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    source.setParams({ sorts: [{ key: 'team', direction: 'asc' }] })
    query.mockClear()
    source.setParams({ sorts: [] })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: {},
    })
  })

  it('same-value sort/filter with fresh object identity does not reset the page or re-query', async () => {
    // A controlled `sort`/`filters` prop recreated inline each render has a
    // fresh identity but an equal VALUE — it must be a no-op (no page reset
    // to 1, no duplicate request) instead of keying on presence.
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query, autoLoad: false })
    source.setParams({ sort: { key: 'name', direction: 'asc' } })
    source.setParams({ filters: { role: 'admin' } })
    source.setParams({ page: 3 })
    expect(source.getState().params.page).toBe(3)
    query.mockClear()
    source.setParams({ sort: { key: 'name', direction: 'asc' } })
    source.setParams({ sort: { key: 'name', direction: 'asc' } })
    source.setParams({ filters: { role: 'admin' } })
    source.setParams({ filters: { role: 'admin' } })
    expect(query).not.toHaveBeenCalled()
    expect(source.getState().params).toMatchObject({ page: 3 })
  })

  it('clones controlled params before storing them', () => {
    const initialSort: NonNullable<RemoteTableParams['sort']> = {
      key: 'name',
      direction: 'asc',
    }
    const initialFilters = { role: 'admin' }
    const initial = createRemoteTableSource({
      query: datasetQuery(25),
      autoLoad: false,
      initialParams: { sort: initialSort, filters: initialFilters },
    })

    initialSort.direction = 'desc'
    initialFilters.role = 'owner'
    expect(initial.getState().params).toMatchObject({
      sort: { key: 'name', direction: 'asc' },
      filters: { role: 'admin' },
    })

    const nextSorts: NonNullable<RemoteTableParams['sorts']> = [{ key: 'team', direction: 'asc' }]
    const nextFilters = { role: 'admin' }
    const updated = createRemoteTableSource({ query: datasetQuery(25), autoLoad: false })
    updated.setParams({ sorts: nextSorts, filters: nextFilters })

    nextSorts[0]!.direction = 'desc'
    nextFilters.role = 'owner'
    expect(updated.getState().params).toMatchObject({
      sort: null,
      sorts: [{ key: 'team', direction: 'asc' }],
      filters: { role: 'admin' },
    })
  })

  it('clones params before handing them to query', async () => {
    const multiSnapshots: RemoteTableParams[] = []
    const query = vi.fn(async (params: RemoteTableParams) => {
      multiSnapshots.push({
        ...params,
        sort: params.sort ? { ...params.sort } : null,
        sorts: params.sorts?.map((sort) => ({ ...sort })),
        filters: { ...params.filters },
      })
      params.filters.role = 'owner'
      params.sorts?.push({ key: 'id', direction: 'desc' })
      if (params.sort) params.sort.direction = 'desc'
      return { rows: [1], total: 1 }
    })

    const multiSource = createRemoteTableSource({
      query,
      autoLoad: false,
      initialParams: {
        sorts: [{ key: 'team', direction: 'asc' }],
        filters: { role: 'admin' },
      },
    })
    await multiSource.request()
    expect(multiSource.getState().params).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [{ key: 'team', direction: 'asc' }],
      filters: { role: 'admin' },
    })
    await multiSource.refetch()
    expect(multiSnapshots[1]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      sorts: [{ key: 'team', direction: 'asc' }],
      filters: { role: 'admin' },
    })

    const singleSnapshots: RemoteTableParams[] = []
    const singleQuery = vi.fn(async (params: RemoteTableParams) => {
      singleSnapshots.push({
        ...params,
        sort: params.sort ? { ...params.sort } : null,
        sorts: params.sorts?.map((sort) => ({ ...sort })),
        filters: { ...params.filters },
      })
      params.filters.role = 'owner'
      if (params.sort) params.sort.direction = 'desc'
      return { rows: [1], total: 1 }
    })
    const singleSource = createRemoteTableSource({
      query: singleQuery,
      autoLoad: false,
      initialParams: {
        sort: { key: 'name', direction: 'asc' },
        filters: { role: 'admin' },
      },
    })
    await singleSource.request()
    expect(singleSource.getState().params).toEqual({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: { role: 'admin' },
    })
    await singleSource.refetch()
    expect(singleSnapshots[1]).toEqual({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: { role: 'admin' },
    })
  })

  it('strips empty-string filter entries (empty string = inactive) before querying', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query, autoLoad: false })
    source.setParams({ filters: { name: '', role: 'admin' } })
    expect(query.mock.lastCall?.[0]).toMatchObject({ filters: { role: 'admin' } })
    // Clearing the last active filter is a real change → forwarded as {}.
    source.setParams({ filters: { role: '' } })
    expect(query.mock.lastCall?.[0]).toMatchObject({ filters: {} })
    // Now that the state is empty, a fresh { name: '' } object dedupes (≡ {}).
    query.mockClear()
    source.setParams({ filters: { name: '' } })
    expect(query).not.toHaveBeenCalled()
  })

  it('explicitly-undefined initialParams fields fall back to defaults (no NaN/TypeError)', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({
      query,
      autoLoad: false,
      initialParams: {
        page: undefined,
        pageSize: undefined,
        sort: undefined,
        filters: undefined,
      },
    })
    expect(source.getState().params).toEqual({ page: 1, pageSize: 10, sort: null, filters: {} })
    // A no-op request over the undefined-typed seed must not throw either.
    source.setParams({ page: 1 })
    expect(query).not.toHaveBeenCalled()
  })
})
