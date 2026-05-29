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
    const r = createPaginatedResource(datasetFetcher(25), { pageSize: 10 })
    await r.loadMore()
    expect(r.getState().items).toHaveLength(10)
    await r.loadMore()
    expect(r.getState().items).toHaveLength(20)
    expect(r.getState().page).toBe(2)
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

  it('hasMore uses the full-page heuristic when total is unknown', async () => {
    const r = createPaginatedResource(datasetFetcher(15, { reportTotal: false }), { pageSize: 10 })
    await r.loadMore()
    expect(r.hasMore()).toBe(true) // got a full page (10)
    await r.loadMore()
    expect(r.getState().items).toHaveLength(15)
    expect(r.hasMore()).toBe(false) // last batch (5) < pageSize
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

  it('records the error state on failure', async () => {
    const r = createPaginatedResource(async () => {
      throw new Error('500')
    }, {})
    await r.goToPage(1)
    expect(r.getState().status).toBe('error')
    expect((r.getState().error as Error).message).toBe('500')
  })
})
