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
})
