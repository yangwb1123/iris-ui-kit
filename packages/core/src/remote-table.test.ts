import { describe, expect, it, vi } from 'vitest'
import {
  createRemoteTableSource,
  type RemoteTableParams,
  type RemoteTableSourceState,
} from './remote-table'

/** Build a query spy over a fixed dataset, paged offset-style. */
function datasetQuery(total: number) {
  const all = Array.from({ length: total }, (_, i) => i)
  return vi.fn(async ({ page, pageSize }: RemoteTableParams) => {
    const start = (page - 1) * pageSize
    return { rows: all.slice(start, start + pageSize), total }
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('createRemoteTableSource', () => {
  it('auto-loads the first page on creation (autoLoad default true)', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith({
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
    expect(query).toHaveBeenCalledWith({
      page: 3,
      pageSize: 5,
      sort: { key: 'name', direction: 'desc' },
      filters: {},
    })
  })

  it('autoLoad=false does not query until the first setParams', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query, autoLoad: false })
    expect(query).not.toHaveBeenCalled()
    source.setParams({ page: 2 })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith({
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
    expect(query).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      sort: null,
      filters: {},
    })
    await vi.waitFor(() =>
      expect(source.getState().data).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
    )
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
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: { key: 'name', direction: 'asc' } }),
    )

    source.setParams({ page: 2 })
    source.setParams({ filters: { role: 'admin' } })
    expect(source.getState().params).toMatchObject({ page: 1, filters: { role: 'admin' } })
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, filters: { role: 'admin' } }),
    )
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
    expect(query).toHaveBeenCalledWith({
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
    expect(query).toHaveBeenCalledWith({
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
    expect(query).toHaveBeenCalledWith({
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

  it('strips empty-string filter entries (empty string = inactive) before querying', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query, autoLoad: false })
    source.setParams({ filters: { name: '', role: 'admin' } })
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { role: 'admin' } }))
    // Clearing the last active filter is a real change → forwarded as {}.
    source.setParams({ filters: { role: '' } })
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: {} }))
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

  it('clamps back to the last valid page when the total shrinks below the current page', async () => {
    let total = 25
    const query = vi.fn(async ({ page, pageSize }: RemoteTableParams) => {
      const start = (page - 1) * pageSize
      const all = Array.from({ length: total }, (_, i) => i)
      return { rows: all.slice(start, start + pageSize), total }
    })
    const source = createRemoteTableSource({ query })
    source.setParams({ page: 3 })
    await vi.waitFor(() => expect(source.getState().data).toEqual([20, 21, 22, 23, 24]))
    // Server-side shrink: the dataset now has 5 rows (total drives the pager).
    total = 5
    query.mockClear()
    await source.refetch()
    // The stale page-3 query returns zero rows; the controller recovers by
    // jumping back to page 1 and re-querying.
    expect(query).toHaveBeenCalledTimes(2)
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(source.getState()).toMatchObject({
      data: [0, 1, 2, 3, 4],
      total: 5,
      params: { page: 1 },
    })
  })

  it('latest-wins on concurrent requests (a slow stale response is discarded)', async () => {
    const first = deferred<{ rows: number[]; total: number }>()
    const second = deferred<{ rows: number[]; total: number }>()
    const query = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const source = createRemoteTableSource({ query, autoLoad: false })
    const p1 = source.request()
    const p2 = source.request()
    // The SECOND request resolves first with fresh data…
    second.resolve({ rows: [2], total: 2 })
    await p2
    expect(source.getState()).toMatchObject({ data: [2], total: 2, loading: false })
    // …then the stale FIRST response settles and must NOT clobber it.
    first.resolve({ rows: [1], total: 1 })
    await p1
    expect(source.getState()).toMatchObject({ data: [2], total: 2, error: null })
  })

  it('request(partial) applies params (with page reset) and fetches', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    query.mockClear()
    await source.request({ page: 2, sort: { key: 'age', direction: 'desc' } })
    // sort present → page resets to 1
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: { key: 'age', direction: 'desc' } }),
    )
    expect(source.getState().params.page).toBe(1)
  })

  it('surfaces rejection as an Error state and clears it on refetch', async () => {
    const query = vi
      .fn<() => Promise<{ rows: number[]; total: number }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ rows: [7], total: 1 })
    const source = createRemoteTableSource({ query })
    await vi.waitFor(() => {
      const s = source.getState()
      expect(s.loading).toBe(false)
      expect(s.error).toBeInstanceOf(Error)
      expect(s.error?.message).toBe('boom')
    })
    await source.refetch()
    expect(source.getState()).toMatchObject({ data: [7], total: 1, error: null })
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('refetch re-runs the query with the current params', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    source.setParams({ page: 2 })
    query.mockClear()
    await source.refetch()
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      sort: null,
      filters: {},
    })
    await vi.waitFor(() =>
      expect(source.getState().data).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
    )
  })

  it('notifies subscribers on state changes and unsubscribes cleanly', async () => {
    const query = datasetQuery(25)
    const source = createRemoteTableSource({ query })
    await vi.waitFor(() => expect(source.getState().loading).toBe(false))
    const seen: Array<RemoteTableSourceState<number>> = []
    const unsub = source.subscribe((s) => seen.push(s))
    source.setParams({ page: 2 })
    await vi.waitFor(() =>
      expect(source.getState().data).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
    )
    expect(seen.length).toBeGreaterThanOrEqual(2) // loading + data transitions
    unsub()
    const count = seen.length
    await source.refetch()
    expect(seen.length).toBe(count)
  })

  it('destroy aborts in-flight work so a late response never writes back', async () => {
    const slow = deferred<{ rows: number[]; total: number }>()
    const query = vi.fn().mockImplementationOnce(() => slow.promise)
    const source = createRemoteTableSource({ query, autoLoad: false })
    const pending = source.request()
    source.destroy()
    slow.resolve({ rows: [9], total: 9 })
    await pending
    expect(source.getState().data).toEqual([])
  })
})
