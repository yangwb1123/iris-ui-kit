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
  it('clamps an out-of-range page to page 1 when the server reports an empty dataset', async () => {
    const query = datasetQuery(0)
    const source = createRemoteTableSource({
      query,
      initialParams: { page: 3 },
    })

    await vi.waitFor(() => expect(source.getState().params.page).toBe(1))
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls.map(([params]) => params.page)).toEqual([3, 1])
    expect(source.getState()).toMatchObject({
      data: [],
      total: 0,
      loading: false,
      error: null,
      params: { page: 1 },
    })
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
    expect(query.mock.lastCall?.[0]).toMatchObject({ page: 1 })
    expect(source.getState()).toMatchObject({
      data: [0, 1, 2, 3, 4],
      total: 5,
      params: { page: 1 },
    })
  })

  it('latest-wins on concurrent requests (a slow stale response is discarded)', async () => {
    const first = deferred<{ rows: number[]; total: number }>()
    const second = deferred<{ rows: number[]; total: number }>()
    const signals: Array<AbortSignal | undefined> = []
    const query = vi.fn((_params: RemoteTableParams, signal?: AbortSignal) => {
      signals.push(signal)
      return signals.length === 1 ? first.promise : second.promise
    })
    const source = createRemoteTableSource({ query, autoLoad: false })
    const p1 = source.request()
    const p2 = source.request()
    expect(signals[0]).toBeInstanceOf(AbortSignal)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]).toBeInstanceOf(AbortSignal)
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
    expect(query.mock.lastCall?.[0]).toMatchObject({
      page: 1,
      sort: { key: 'age', direction: 'desc' },
    })
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
    let requestSignal: AbortSignal | undefined
    const query = vi.fn((_params: RemoteTableParams, signal?: AbortSignal) => {
      requestSignal = signal
      return slow.promise
    })
    const source = createRemoteTableSource({ query, autoLoad: false })
    const pending = source.request()
    source.destroy()
    expect(requestSignal).toBeInstanceOf(AbortSignal)
    expect(requestSignal?.aborted).toBe(true)
    slow.resolve({ rows: [9], total: 9 })
    await pending
    expect(source.getState().data).toEqual([])
  })

  it('clears resilient in-flight cache entries before request reuse after destroy', async () => {
    const original = deferred<{ rows: number[]; total: number }>()
    const replacement = deferred<{ rows: number[]; total: number }>()
    const query = vi
      .fn<
        (
          params: RemoteTableParams,
          signal?: AbortSignal,
        ) => Promise<{ rows: number[]; total: number }>
      >()
      .mockImplementationOnce(() => original.promise)
      .mockImplementationOnce(() => replacement.promise)
    const source = createRemoteTableSource({
      query,
      autoLoad: false,
      resilient: { ttlMs: 60_000, breaker: false },
    })

    const originalRequest = source.request()
    expect(query).toHaveBeenCalledTimes(1)
    source.destroy()

    const replacementRequest = source.request()
    expect(query).toHaveBeenCalledTimes(2)
    replacement.resolve({ rows: [2], total: 1 })
    await replacementRequest
    expect(source.getState()).toMatchObject({ data: [2], total: 1, error: null })

    original.resolve({ rows: [1], total: 1 })
    await originalRequest
    expect(source.getState()).toMatchObject({ data: [2], total: 1, error: null })

    // The late request A must not poison request B's fresh cache entry.
    await source.refetch()
    expect(query).toHaveBeenCalledTimes(2)
    expect(source.getState()).toMatchObject({ data: [2], total: 1, error: null })
  })
})
