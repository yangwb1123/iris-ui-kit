import { describe, it, expect, vi } from 'vitest'
import { createResourceController, createClientFetcher } from './resource'

interface Row {
  id: number
  name: string
}

function fetcherFor(all: Row[]) {
  return vi.fn(async ({ page, pageSize }: { page: number; pageSize: number }) => {
    const start = (page - 1) * pageSize
    return { rows: all.slice(start, start + pageSize), total: all.length }
  })
}

const all: Row[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `r${i + 1}` }))

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('createResourceController', () => {
  it('auto-loads the first page', async () => {
    const fetcher = fetcherFor(all)
    const c = createResourceController<Row>({ fetcher, pageSize: 2 })
    await flush()
    expect(fetcher).toHaveBeenCalled()
    expect(c.getState().rows.map((r) => r.id)).toEqual([1, 2])
    expect(c.getState().total).toBe(5)
    expect(c.getState().loading).toBe(false)
    expect(c.pageCount()).toBe(3)
  })

  it('setPage re-fetches', async () => {
    const c = createResourceController<Row>({ fetcher: fetcherFor(all), pageSize: 2 })
    await flush()
    c.setPage(2)
    await flush()
    expect(c.getState().rows.map((r) => r.id)).toEqual([3, 4])
  })

  it('mutate runs the action then reloads', async () => {
    const fetcher = fetcherFor(all)
    const c = createResourceController<Row>({ fetcher, pageSize: 2 })
    await flush()
    const action = vi.fn().mockResolvedValue(undefined)
    await c.mutate(action)
    await flush()
    expect(action).toHaveBeenCalled()
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('exposes a composed selection model', async () => {
    const c = createResourceController<Row>({ fetcher: fetcherFor(all), pageSize: 2 })
    await flush()
    c.selection.toggle('1')
    expect(c.getState().selectedKeys).toEqual(['1'])
  })

  it('does not expose mutable projection aliases', async () => {
    const c = createResourceController<Row>({
      fetcher: fetcherFor(all),
      pageSize: 2,
      immediate: false,
    })
    await c.load()
    const projected = c.getState()
    projected.rows[0]!.name = 'outside'
    projected.rows.pop()
    projected.sort = { key: 'name', direction: 'asc' }
    projected.sort.direction = 'desc'
    projected.filters.name = 'outside'
    projected.selectedKeys.push('outside')
    // Force a new projection without changing the DataSource's controls.
    c.selection.toggle('2')

    expect(c.getState()).toMatchObject({
      rows: all.slice(0, 2),
      sort: null,
      filters: {},
      selectedKeys: ['2'],
    })
  })

  it('does not auto-load when immediate=false', async () => {
    const fetcher = fetcherFor(all)
    createResourceController<Row>({ fetcher, immediate: false })
    await flush()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('setSort passes sort to the fetcher and resets to page 1', async () => {
    const fetcher = vi.fn(async (_q: { page: number; pageSize: number; sort: unknown }) => ({
      rows: all,
      total: all.length,
    }))
    const c = createResourceController<Row>({ fetcher, pageSize: 2 })
    await flush()
    c.setPage(2)
    await flush()
    c.setSort({ key: 'name', direction: 'desc' })
    await flush()
    const lastQuery = fetcher.mock.calls.at(-1)?.[0]
    expect(lastQuery?.sort).toEqual({ key: 'name', direction: 'desc' })
    expect(lastQuery?.page).toBe(1) // reset
    expect(c.getState().sort).toEqual({ key: 'name', direction: 'desc' })
  })

  it('setFilter / clearFilters pass filters and reset to page 1', async () => {
    const fetcher = vi.fn(async (_q: { page: number; filters: Record<string, string> }) => ({
      rows: all,
      total: all.length,
    }))
    const c = createResourceController<Row>({ fetcher, pageSize: 2 })
    await flush()
    c.setFilter('name', 'r1')
    await flush()
    expect(fetcher.mock.calls.at(-1)?.[0].filters).toEqual({ name: 'r1' })
    expect(c.getState().page).toBe(1)
    c.clearFilters()
    await flush()
    expect(fetcher.mock.calls.at(-1)?.[0].filters).toEqual({})
  })

  it('destroy() drops a late fetch response so it never writes back', async () => {
    let resolveFetch!: (v: { rows: Row[]; total: number }) => void
    const fetcher = vi.fn(
      () => new Promise<{ rows: Row[]; total: number }>((r) => (resolveFetch = r)),
    )
    const c = createResourceController<Row>({ fetcher, pageSize: 2 })
    // fetch is in-flight (pending); tear down before it resolves
    c.destroy()
    resolveFetch({ rows: all.slice(0, 2), total: 5 })
    await flush()
    // the torn-down controller must not have applied the late response
    expect(c.getState().rows).toEqual([])
    expect(c.getState().total).toBe(0)
  })

  it('destroy() is idempotent and the controller can still load afterwards (StrictMode remount)', async () => {
    const fetcher = fetcherFor(all)
    const c = createResourceController<Row>({ fetcher, pageSize: 2, immediate: false })
    c.destroy()
    expect(() => c.destroy()).not.toThrow()
    // A StrictMode remount loads again on the same (ref-cached) controller — the
    // internal subscriptions are intact, so the result still reaches the store.
    await c.load()
    await flush()
    expect(c.getState().rows.map((r) => r.id)).toEqual([1, 2])
  })

  it('resynchronizes selection when loading after destroy', async () => {
    const c = createResourceController<Row>({
      fetcher: fetcherFor(all),
      pageSize: 2,
      immediate: false,
    })
    await c.load()
    c.destroy()
    c.selection.toggle('1')
    expect(c.getState().selectedKeys).toEqual([])

    await c.load()
    expect(c.getState().selectedKeys).toEqual(['1'])
  })

  it('does not lose a reentrant selection change while resubscribing', async () => {
    const c = createResourceController<Row>({
      fetcher: fetcherFor(all),
      pageSize: 2,
      immediate: false,
    })
    await c.load()
    c.destroy()
    c.selection.toggle('1')
    let reentered = false
    const unsubscribe = c.subscribe((state) => {
      if (!reentered && state.selectedKeys.join() === '1') {
        reentered = true
        c.selection.toggle('2')
      }
    })

    await c.load()
    unsubscribe()
    expect(c.getState().selectedKeys).toEqual(['1', '2'])
  })

  it('optimistic mutate updates rows immediately and rolls back on failure', async () => {
    const c = createResourceController<Row>({ fetcher: fetcherFor(all), pageSize: 10 })
    await flush()
    const before = c.getState().rows.length
    // success: optimistic add survives until reload reconciles
    await c.mutate(async () => undefined, {
      optimistic: (rows) => [...rows, { id: 99, name: 'new' }],
      skipReload: true,
    })
    expect(c.getState().rows.some((r) => r.id === 99)).toBe(true)

    // failure: optimistic removal is rolled back
    await expect(
      c.mutate(
        async () => {
          throw new Error('server rejected')
        },
        { optimistic: (rows) => rows.filter((r) => r.id !== 1) },
      ),
    ).rejects.toThrow('server rejected')
    await flush()
    expect(c.getState().rows.find((r) => r.id === 1)).toBeDefined() // rolled back + reloaded
    expect(before).toBe(5)
  })
})

describe('createClientFetcher', () => {
  const columns = [{ key: 'name', getValue: (r: Row) => r.name, filterable: true }]

  it('filters + sorts + paginates an in-memory dataset through the controller', async () => {
    const c = createResourceController<Row>({
      fetcher: createClientFetcher(all, columns),
      pageSize: 2,
    })
    await flush()
    expect(c.getState().total).toBe(5)
    expect(c.getState().rows).toHaveLength(2)

    c.setSort({ key: 'name', direction: 'desc' })
    await flush()
    expect(c.getState().rows[0].name).toBe('r5') // r5 > r4 > … by locale string

    c.setFilter('name', 'r1')
    await flush()
    expect(c.getState().rows.map((r) => r.name)).toEqual(['r1'])
    expect(c.getState().total).toBe(1)
  })

  it('returns the right page slice + total directly', async () => {
    const fetch = createClientFetcher(all, columns)
    const r = await fetch({ page: 2, pageSize: 2, sort: null, filters: {} })
    expect(r.total).toBe(5)
    expect(r.rows.map((x) => x.id)).toEqual([3, 4])
  })

  it('normalizes malformed direct pagination inputs', async () => {
    const fetch = createClientFetcher(all, columns)
    const first = await fetch({
      page: Number.NaN,
      pageSize: Number.POSITIVE_INFINITY,
      sort: null,
      filters: {},
    })
    expect(first.rows.map((x) => x.id)).toEqual([1, 2, 3, 4, 5])

    const fractional = await fetch({ page: 2.9, pageSize: 1.9, sort: null, filters: {} })
    expect(fractional.rows.map((x) => x.id)).toEqual([2])
  })

  it('normalizes malformed totals at the composed resource boundary', async () => {
    const c = createResourceController<Row>({
      fetcher: async () => ({ rows: all, total: Number.NaN }),
      immediate: false,
    })
    await c.load()
    expect(c.getState().total).toBe(0)
    expect(c.pageCount()).toBe(1)
  })
})
