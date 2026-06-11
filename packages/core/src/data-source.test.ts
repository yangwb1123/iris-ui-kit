import { describe, it, expect, vi } from 'vitest'
import { createDataSource, createClientDataSource, createSyncClientDataSource } from './data-source'
import type { DataViewColumn } from './data-view'

interface User extends Record<string, unknown> {
  id: number
  name: string
  team: string
  age: number
}

const data: User[] = [
  { id: 1, name: 'Charlie', team: 'a', age: 30 },
  { id: 2, name: 'Alice', team: 'b', age: 25 },
  { id: 3, name: 'Bob', team: 'a', age: 35 },
  { id: 4, name: 'Dave', team: 'b', age: 28 },
  { id: 5, name: 'Eve', team: 'a', age: 25 },
]

const columns: DataViewColumn<User>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'team', getValue: (r) => r.team },
  { key: 'age', getValue: (r) => r.age },
]

function make(overrides: Partial<Parameters<typeof createDataSource<User>>[0]> = {}) {
  return createDataSource<User>({
    fetcher: createClientDataSource(data, columns),
    pageSize: 2,
    immediate: false,
    ...overrides,
  })
}

describe('createDataSource — paged client mode', () => {
  it('loads the first page and reports total/pageCount/hasMore', async () => {
    const ds = make()
    await ds.load()
    expect(ds.getState().rows.map((r) => r.id)).toEqual([1, 2])
    expect(ds.getState().total).toBe(5)
    expect(ds.pageCount()).toBe(3)
    expect(ds.getState().hasMore).toBe(true)
  })

  it('paginates', async () => {
    const ds = make()
    await ds.load()
    ds.setPage(3)
    await Promise.resolve()
    await Promise.resolve()
    expect(ds.getState().rows.map((r) => r.id)).toEqual([5])
    expect(ds.getState().hasMore).toBe(false)
  })

  it('sorts (single column) and resets to page 1', async () => {
    const ds = make({ pageSize: 10 })
    await ds.load()
    ds.setPage(1)
    ds.setSort({ key: 'age', direction: 'asc' })
    await Promise.resolve()
    await Promise.resolve()
    expect(ds.getState().page).toBe(1)
    expect(ds.getState().rows.map((r) => r.age)).toEqual([25, 25, 28, 30, 35])
  })

  it('multi-sorts (team asc, then age desc)', async () => {
    const ds = make({ pageSize: 10 })
    await ds.load()
    ds.setMultiSort([
      { key: 'team', direction: 'asc' },
      { key: 'age', direction: 'desc' },
    ])
    await Promise.resolve()
    await Promise.resolve()
    const rows = ds.getState().rows
    expect(rows.map((r) => `${r.team}${r.age}`)).toEqual(['a35', 'a30', 'a25', 'b28', 'b25'])
  })

  it('filters by substring and by typed rules', async () => {
    const ds = make({ pageSize: 10 })
    await ds.load()
    ds.setFilter('name', 'a')
    await Promise.resolve()
    await Promise.resolve()
    expect(
      ds
        .getState()
        .rows.map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Charlie', 'Dave'])

    ds.clearFilters()
    await Promise.resolve()
    await Promise.resolve()
    ds.setFilterRules([{ key: 'age', operator: 'gte', value: 30 }])
    await Promise.resolve()
    await Promise.resolve()
    expect(
      ds
        .getState()
        .rows.map((r) => r.age)
        .sort((a, b) => a - b),
    ).toEqual([30, 35])
  })
})

describe('createDataSource — synchronous client mode', () => {
  it('populates rows synchronously after construction (no await, no loading flicker)', () => {
    let sawLoading = false
    const ds = createDataSource<User>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 2,
    })
    ds.subscribe((s) => {
      if (s.loading) sawLoading = true
    })
    // No await: rows are ready immediately.
    expect(ds.getState().rows.map((r) => r.id)).toEqual([1, 2])
    expect(ds.getState().total).toBe(5)
    expect(ds.getState().loading).toBe(false)
    expect(sawLoading).toBe(false)
  })

  it('applies sort + filter synchronously', () => {
    const ds = createDataSource<User>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 10,
    })
    ds.setSort({ key: 'age', direction: 'asc' })
    expect(ds.getState().rows.map((r) => r.age)).toEqual([25, 25, 28, 30, 35])
    expect(ds.getState().loading).toBe(false)
    ds.setFilter('name', 'a')
    expect(
      ds
        .getState()
        .rows.map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Charlie', 'Dave'])
  })
})

describe('createDataSource — infinite mode', () => {
  it('appends pages via loadMore until exhausted', async () => {
    const ds = make({ mode: 'infinite', pageSize: 2 })
    await ds.load()
    expect(ds.getState().rows.map((r) => r.id)).toEqual([1, 2])
    expect(ds.getState().hasMore).toBe(true)

    await ds.loadMore()
    expect(ds.getState().rows.map((r) => r.id)).toEqual([1, 2, 3, 4])
    expect(ds.getState().page).toBe(2)
    expect(ds.getState().hasMore).toBe(true)

    await ds.loadMore()
    expect(ds.getState().rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5])
    expect(ds.getState().hasMore).toBe(false)

    // exhausted → no-op
    await ds.loadMore()
    expect(ds.getState().rows).toHaveLength(5)
  })
})

describe('createDataSource — selection', () => {
  it('mirrors the selection model into selectedKeys', async () => {
    const ds = make()
    await ds.load()
    ds.selection.toggle('1')
    expect(ds.getState().selectedKeys).toEqual(['1'])
    ds.selection.toggle('1')
    expect(ds.getState().selectedKeys).toEqual([])
  })
})

describe('createDataSource — mutate', () => {
  it('optimistically updates and rolls back on rejection', async () => {
    const ds = make({ pageSize: 10 })
    await ds.load()
    const before = ds.getState().rows.map((r) => r.id)

    await expect(
      ds.mutate(() => Promise.reject(new Error('boom')), {
        optimistic: (rows) => rows.filter((r) => r.id !== 1),
      }),
    ).rejects.toThrow('boom')
    // rolled back (reload restores the full dataset)
    expect(
      ds
        .getState()
        .rows.map((r) => r.id)
        .sort(),
    ).toEqual(before.sort())
  })
})

describe('createDataSource — per-row mutate', () => {
  it('marks the row pending during the action then clears it', async () => {
    const ds = make({ pageSize: 10 })
    await ds.load()
    let pendingDuring = false
    const p = ds.mutateRow('3', async () => {
      pendingDuring = ds.isRowPending('3')
    })
    await p
    expect(pendingDuring).toBe(true)
    expect(ds.isRowPending('3')).toBe(false)
    expect(ds.rowError('3')).toBeUndefined()
  })

  it('records a per-row error and rolls back the optimistic update on rejection', async () => {
    const ds = make({ pageSize: 10 })
    await ds.load()
    const before = ds.getState().rows.map((r) => r.id)
    await expect(
      ds.mutateRow('2', () => Promise.reject(new Error('nope')), {
        optimistic: (rows) => rows.filter((r) => r.id !== 2),
      }),
    ).rejects.toThrow('nope')
    expect(ds.isRowPending('2')).toBe(false)
    expect((ds.rowError('2') as Error).message).toBe('nope')
    expect(ds.getState().rows.map((r) => r.id)).toEqual(before)
  })
})

describe('createDataSource — race + destroy guards', () => {
  it('a stale response never clobbers a newer load', async () => {
    let resolveFirst: (v: { rows: User[]; total: number }) => void = () => {}
    const fetcher = vi
      .fn<(q: unknown) => Promise<{ rows: User[]; total: number }>>()
      .mockImplementationOnce(
        () => new Promise((res) => (resolveFirst = res)), // slow first page
      )
      .mockImplementation(async () => ({ rows: [data[4]], total: 1 })) // fast newer page
    const ds = createDataSource<User>({ fetcher, immediate: false })
    const first = ds.load()
    ds.setFilter('name', 'x') // supersedes the first load
    await Promise.resolve()
    await Promise.resolve()
    // resolve the stale first page LAST — it must be ignored
    resolveFirst({ rows: [data[0]], total: 99 })
    await first
    await Promise.resolve()
    expect(ds.getState().rows.map((r) => r.id)).toEqual([5])
    expect(ds.getState().total).toBe(1)
  })

  it('destroy() aborts in flight so a late response is dropped', async () => {
    let resolveLoad: (v: { rows: User[]; total: number }) => void = () => {}
    const fetcher = vi.fn(
      () => new Promise<{ rows: User[]; total: number }>((res) => (resolveLoad = res)),
    )
    const ds = createDataSource<User>({ fetcher, immediate: false })
    const p = ds.load()
    ds.destroy()
    resolveLoad({ rows: [data[0]], total: 1 })
    await p
    expect(ds.getState().rows).toEqual([])
  })
})
