import { describe, expect, it, vi } from 'vitest'
import { createPaginatedResource, type PageQuery, type PageResult } from './pagination'

/** Build a fetcher over a fixed dataset, paged offset-style. */
function datasetFetcher(total: number, opts: { reportTotal?: boolean } = {}) {
  const all = Array.from({ length: total }, (_, i) => i)
  return vi.fn(async ({ page, pageSize }: PageQuery): Promise<PageResult<number>> => {
    const start = (page - 1) * pageSize
    const items = all.slice(start, start + pageSize)
    return opts.reportTotal === false ? { items } : { items, total }
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createPaginatedResource', () => {
  it('starts idle and empty', () => {
    const r = createPaginatedResource(datasetFetcher(50), { pageSize: 10 })
    expect(r.getState()).toMatchObject({ status: 'idle', items: [], page: 0, pageSize: 10 })
    expect(r.hasMore()).toBe(true) // nothing loaded yet
  })

  it('goToPage replaces items (paged mode)', async () => {
    const r = createPaginatedResource(datasetFetcher(50), { pageSize: 10 })
    await r.goToPage(1)
    expect(r.getState().items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    await r.goToPage(2)
    expect(r.getState().items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect(r.getState().page).toBe(2)
    expect(r.getState().total).toBe(50)
  })

  it('loadMore appends successive pages (infinite mode)', async () => {
    const r = createPaginatedResource(datasetFetcher(25), { pageSize: 10, mode: 'infinite' })
    await r.loadMore()
    expect(r.getState().items).toHaveLength(10)
    await r.loadMore()
    expect(r.getState().items).toHaveLength(20)
    expect(r.getState().page).toBe(2)
  })

  it('loadMore replaces successive pages in explicit paged mode', async () => {
    const r = createPaginatedResource(datasetFetcher(25), { pageSize: 10, mode: 'paged' })
    await r.loadMore()
    expect(r.getState().items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    await r.loadMore()
    expect(r.getState().items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect(r.getState().page).toBe(2)
  })

  it('does not retain the fetcher-owned array in paged state', async () => {
    const items = [1, 2]
    const fetcher = vi.fn(async (): Promise<PageResult<number>> => ({ items }))
    const r = createPaginatedResource(fetcher, { mode: 'paged' })

    await r.goToPage(1)
    items.push(3)

    expect(r.getState().items).toEqual([1, 2])
  })

  it('keeps the omitted mode append-compatible', async () => {
    const r = createPaginatedResource(datasetFetcher(25), { pageSize: 10 })
    await r.loadMore()
    await r.loadMore()
    expect(r.getState().items).toHaveLength(20)
  })

  it('hasMore reflects total when reported', async () => {
    const r = createPaginatedResource(datasetFetcher(25), { pageSize: 10 })
    await r.loadMore()
    expect(r.hasMore()).toBe(true) // 10 < 25
    await r.loadMore()
    expect(r.hasMore()).toBe(true) // 20 < 25
    await r.loadMore()
    expect(r.getState().items).toHaveLength(25)
    expect(r.hasMore()).toBe(false) // 25 >= 25
  })

  it('hasMore uses the reported total for a short page in paged mode', async () => {
    const fetcher = vi.fn(async ({ page }: PageQuery): Promise<PageResult<number>> => ({
      items: [page],
      total: 20,
    }))
    const r = createPaginatedResource(fetcher, { pageSize: 10, mode: 'paged' })
    await r.loadMore()
    expect(r.hasMore()).toBe(true)
    await r.loadMore()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('hasMore uses the reported total for a short page in infinite mode', async () => {
    const fetcher = vi.fn(async ({ page }: PageQuery): Promise<PageResult<number>> => ({
      items: [page],
      total: 20,
    }))
    const r = createPaginatedResource(fetcher, { pageSize: 10, mode: 'infinite' })
    await r.loadMore()
    expect(r.hasMore()).toBe(true)
    await r.loadMore()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(r.getState().items).toEqual([1, 2])
  })

  it('uses the page offset for totals after explicit navigation in infinite mode', async () => {
    const r = createPaginatedResource(datasetFetcher(25), { pageSize: 10, mode: 'infinite' })

    await r.goToPage(3)

    expect(r.getState().items).toEqual([20, 21, 22, 23, 24])
    expect(r.hasMore()).toBe(false)
  })

  it('hasMore uses the full-page heuristic when total is unknown', async () => {
    const r = createPaginatedResource(datasetFetcher(15, { reportTotal: false }), { pageSize: 10 })
    await r.loadMore()
    expect(r.hasMore()).toBe(true) // got a full page (10)
    await r.loadMore()
    expect(r.getState().items).toHaveLength(15)
    expect(r.hasMore()).toBe(false) // last batch (5) < pageSize
  })

  it('hasMore accounts for the page offset in paged mode', async () => {
    const r = createPaginatedResource(datasetFetcher(25), { pageSize: 10, mode: 'paged' })
    await r.loadMore()
    expect(r.hasMore()).toBe(true)
    await r.loadMore()
    expect(r.hasMore()).toBe(true)
    await r.loadMore()
    expect(r.getState().items).toHaveLength(5)
    expect(r.hasMore()).toBe(false)
  })

  it('treats an empty unknown-total page as exhausted in paged mode', async () => {
    const fetcher = vi.fn(async ({ page }: PageQuery): Promise<PageResult<number>> => ({
      items: page === 1 ? [1, 2] : [],
    }))
    const r = createPaginatedResource(fetcher, { pageSize: 2, mode: 'paged' })
    await r.loadMore()
    expect(r.hasMore()).toBe(true)
    await r.loadMore()
    expect(r.getState().items).toEqual([])
    expect(r.hasMore()).toBe(false)
  })

  it('loadMore is a no-op once exhausted', async () => {
    const fetcher = datasetFetcher(10, { reportTotal: false })
    const r = createPaginatedResource(fetcher, { pageSize: 10 })
    await r.loadMore() // page 1 → 10 items, full page
    await r.loadMore() // page 2 → 0 items → lastBatchSize 0 < pageSize
    const callsAfterDrain = fetcher.mock.calls.length
    await r.loadMore() // exhausted → no fetch
    expect(fetcher.mock.calls.length).toBe(callsAfterDrain)
  })

  it('refresh resets to page 1 and clears accumulated items', async () => {
    const r = createPaginatedResource(datasetFetcher(50), { pageSize: 10 })
    await r.loadMore()
    await r.loadMore()
    expect(r.getState().items).toHaveLength(20)
    await r.refresh()
    expect(r.getState().items).toHaveLength(10)
    expect(r.getState().page).toBe(1)
  })

  it('does not supersede a re-entrant request started by the refresh reset', async () => {
    const fetcher = vi.fn(async ({ page }: PageQuery): Promise<PageResult<number>> => ({
      items: [page],
      total: 10,
    }))
    const r = createPaginatedResource(fetcher, { pageSize: 10 })
    let nestedLoad: Promise<void> | undefined
    r.subscribe((state) => {
      if (state.status === 'idle' && state.page === 0) nestedLoad = r.goToPage(2)
    })

    await r.refresh()
    await nestedLoad

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith({ page: 2, pageSize: 10 }, expect.any(AbortSignal))
    expect(r.getState().page).toBe(2)
  })

  it('setPageSize changes size and reloads from page 1', async () => {
    const r = createPaginatedResource(datasetFetcher(50), { pageSize: 10 })
    await r.goToPage(3)
    await r.setPageSize(25)
    expect(r.getState().pageSize).toBe(25)
    expect(r.getState().page).toBe(1)
    expect(r.getState().items).toHaveLength(25)
  })

  it('drops a stale page response when a newer request wins', async () => {
    const resolvers: Array<(r: PageResult<number>) => void> = []
    const fetcher = vi.fn(
      () => new Promise<PageResult<number>>((resolve) => resolvers.push(resolve)),
    )
    const r = createPaginatedResource(fetcher, { pageSize: 10 })
    const p1 = r.goToPage(1) // token 1
    const p2 = r.goToPage(2) // token 2 (latest)
    resolvers[1]({ items: [20, 21], total: 100 }) // newer resolves first
    resolvers[0]({ items: [0, 1], total: 100 }) // stale resolves second
    await Promise.all([p1, p2])
    expect(r.getState().items).toEqual([20, 21])
    expect(r.getState().page).toBe(2)
  })

  it('normalizes invalid page and pageSize inputs before fetching', async () => {
    const fetcher = vi.fn(async (query: PageQuery): Promise<PageResult<number>> => ({
      items: [query.page, query.pageSize],
    }))
    const r = createPaginatedResource(fetcher, { pageSize: Number.NaN })
    expect(r.getState().pageSize).toBe(20)

    await r.goToPage(Number.POSITIVE_INFINITY)
    expect(fetcher.mock.calls[0]?.[0]).toEqual({ page: 1, pageSize: 20 })

    await r.setPageSize(0)
    expect(r.getState().pageSize).toBe(20)
    expect(fetcher.mock.calls[1]?.[0]).toEqual({ page: 1, pageSize: 20 })

    await r.goToPage(Number.MAX_VALUE)
    expect(fetcher.mock.calls[2]?.[0]).toEqual({ page: 1, pageSize: 20 })
  })

  it('turns malformed fetch results into an error instead of committing them', async () => {
    const malformed = vi.fn(
      async () => ({ items: 'not-an-array' }) as unknown as PageResult<number>,
    )
    const r = createPaginatedResource(malformed)

    await r.goToPage(1)

    expect(r.getState().status).toBe('error')
    expect(r.getState().items).toEqual([])
    expect(r.getState().error).toBeInstanceOf(TypeError)
  })

  it('rejects non-finite totals as malformed fetch results', async () => {
    const fetcher = vi.fn(async (): Promise<PageResult<number>> => ({
      items: [1],
      total: Number.NaN,
    }))
    const r = createPaginatedResource(fetcher)

    await r.goToPage(1)

    expect(r.getState().status).toBe('error')
    expect(r.hasMore()).toBe(true)
  })

  it('forwards an AbortSignal to a two-argument fetcher and keeps one-argument calls intact', async () => {
    const oneArgument = vi.fn(async (query: PageQuery): Promise<PageResult<number>> => ({
      items: [query.page],
    }))
    const oneArgumentResource = createPaginatedResource(oneArgument, { pageSize: 10 })
    await oneArgumentResource.goToPage(1)
    expect(oneArgument.mock.calls[0]?.[0]).toEqual({ page: 1, pageSize: 10 })

    let signal: AbortSignal | undefined
    const twoArguments = vi.fn(
      async (query: PageQuery, nextSignal?: AbortSignal): Promise<PageResult<number>> => {
        signal = nextSignal
        return { items: [query.page] }
      },
    )
    const twoArgumentResource = createPaginatedResource(twoArguments, { pageSize: 10 })
    await twoArgumentResource.goToPage(1)
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
    expect(twoArguments).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, expect.any(AbortSignal))

    let defaultParameterSignal: AbortSignal | undefined
    const defaultParameter = vi.fn(
      async (
        query: PageQuery,
        nextSignal = new AbortController().signal,
      ): Promise<PageResult<number>> => {
        defaultParameterSignal = nextSignal
        return { items: [query.page] }
      },
    )
    const defaultParameterResource = createPaginatedResource(defaultParameter, { pageSize: 10 })
    await defaultParameterResource.goToPage(1)
    expect(defaultParameterSignal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the previous request while token guards stale responses', async () => {
    const first = deferred<PageResult<number>>()
    const second = deferred<PageResult<number>>()
    const signals: AbortSignal[] = []
    let call = 0
    const fetcher = vi.fn((_query: PageQuery, signal?: AbortSignal) => {
      if (signal) signals.push(signal)
      return ++call === 1 ? first.promise : second.promise
    })
    const r = createPaginatedResource(fetcher, { pageSize: 10 })
    const firstLoad = r.goToPage(1)
    const secondLoad = r.goToPage(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)

    first.resolve({ items: [1] })
    second.resolve({ items: [2] })
    await Promise.all([firstLoad, secondLoad])
    expect(r.getState().items).toEqual([2])
    expect(r.getState().page).toBe(2)
  })

  it('does not overwrite a request started re-entrantly by an abort listener', async () => {
    const first = deferred<PageResult<number>>()
    const nested = deferred<PageResult<number>>()
    const holder: { resource?: ReturnType<typeof createPaginatedResource<number>> } = {}
    let call = 0
    let nestedSignal: AbortSignal | undefined
    const fetcher = vi.fn((_query: PageQuery, signal?: AbortSignal) => {
      call += 1
      if (call === 1) {
        signal?.addEventListener('abort', () => {
          void holder.resource?.goToPage(3)
        })
        return first.promise
      }
      nestedSignal = signal
      return nested.promise
    })
    const resource = createPaginatedResource(fetcher, { pageSize: 10 })
    holder.resource = resource

    const firstLoad = resource.goToPage(1)
    const supersededLoad = resource.goToPage(2)
    expect(nestedSignal?.aborted).toBe(false)

    resource.destroy()
    first.resolve({ items: [1] })
    nested.resolve({ items: [3] })
    await Promise.all([firstLoad, supersededLoad])

    expect(nestedSignal?.aborted).toBe(true)
    expect(resource.getState().items).toEqual([])
  })

  it('cancel() returns to a retryable state and aborts the active request', async () => {
    const first = deferred<PageResult<number>>()
    const second = deferred<PageResult<number>>()
    const signals: AbortSignal[] = []
    let call = 0
    const fetcher = vi.fn((_query: PageQuery, signal?: AbortSignal) => {
      if (signal) signals.push(signal)
      return ++call === 1 ? first.promise : second.promise
    })
    const r = createPaginatedResource(fetcher, { pageSize: 10 })
    const cancelled = r.loadMore()
    r.cancel()
    expect(signals[0]?.aborted).toBe(true)
    expect(r.getState().status).toBe('idle')

    const retry = r.loadMore()
    first.resolve({ items: [0] })
    second.resolve({ items: [1] })
    await Promise.all([cancelled, retry])
    expect(r.getState()).toMatchObject({ status: 'success', items: [1], page: 1 })
  })

  it('destroy() is idempotent and ignores late resolve/reject results', async () => {
    const resolved = deferred<PageResult<number>>()
    const resolvedResource = createPaginatedResource(
      (_query: PageQuery, _signal?: AbortSignal) => resolved.promise,
      { pageSize: 10 },
    )
    const resolvedLoad = resolvedResource.goToPage(1)
    resolvedResource.destroy()
    resolvedResource.destroy()
    expect(resolvedResource.disposed).toBe(true)
    resolved.resolve({ items: [1] })
    await resolvedLoad
    expect(resolvedResource.getState().items).toEqual([])
    expect(resolvedResource.getState().status).toBe('loading')

    const rejected = deferred<PageResult<number>>()
    const rejectedResource = createPaginatedResource(
      (_query: PageQuery, _signal?: AbortSignal) => rejected.promise,
      { pageSize: 10 },
    )
    const rejectedLoad = rejectedResource.goToPage(1)
    rejectedResource.destroy()
    rejected.reject(new Error('late'))
    await rejectedLoad
    expect(rejectedResource.getState().error).toBeUndefined()
    expect(rejectedResource.getState().status).toBe('loading')
    await rejectedResource.goToPage(2)
    expect(rejectedResource.getState().page).toBe(0)
  })

  it('works without AbortController in an SSR-like runtime', async () => {
    vi.stubGlobal('AbortController', undefined)
    try {
      const fetcher = vi.fn(async (query: PageQuery): Promise<PageResult<number>> => ({
        items: [query.page],
      }))
      const r = createPaginatedResource(fetcher, { pageSize: 10 })
      await r.goToPage(1)
      expect(fetcher).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('records the error state on failure', async () => {
    const r = createPaginatedResource(async () => {
      throw new Error('500')
    }, {})
    await r.goToPage(1)
    expect(r.getState().status).toBe('error')
    expect((r.getState().error as Error).message).toBe('500')
  })
})
