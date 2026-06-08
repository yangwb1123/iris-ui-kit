import { describe, it, expect, vi } from 'vitest'
import { createResourceController } from './resource'

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
})
