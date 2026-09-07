import { describe, expect, it, vi } from 'vitest'
import { createDataSource } from './data-source'
import { createSyncClientDataSource } from './data-source/client'
import type { DataSourceQuery } from './data-source'
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

describe('createDataSource — ownership hardening', () => {
  it('isolates caller-owned sort, multiSort, and filterRules inputs from later mutation', () => {
    const dsSort = createDataSource<User>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 10,
    })
    const sort: NonNullable<DataSourceQuery['sort']> = { key: 'age', direction: 'asc' }
    dsSort.setSort(sort)
    sort.direction = 'desc'
    expect(dsSort.getState().sort).toEqual({ key: 'age', direction: 'asc' })

    const dsMultiSort = createDataSource<User>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 10,
    })
    const multiSort: DataSourceQuery['multiSort'] = [{ key: 'team', direction: 'asc' }]
    dsMultiSort.setMultiSort(multiSort)
    multiSort[0]!.direction = 'desc'
    multiSort.push({ key: 'name', direction: 'desc' })
    expect(dsMultiSort.getState().multiSort).toEqual([{ key: 'team', direction: 'asc' }])

    const dsFilterRules = createDataSource<User>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 10,
    })
    const ruleValue = { nested: 'kept' }
    const filterRules: DataSourceQuery['filterRules'] = [
      { key: 'name', operator: 'eq', value: ruleValue },
    ]
    dsFilterRules.setFilterRules(filterRules)
    filterRules[0]!.key = 'age'
    filterRules.push({ key: 'age', operator: 'gte', value: 30 })
    expect(dsFilterRules.getState().filterRules).toEqual([
      { key: 'name', operator: 'eq', value: ruleValue },
    ])
  })

  it('isolates fetcher query mutations from controller state', async () => {
    const ds = createDataSource<User>({
      fetcher: vi.fn((query: DataSourceQuery) => {
        query.sort!.direction = 'desc'
        query.multiSort.push({ key: 'name', direction: 'desc' })
        query.filters.name = 'mutated'
        query.filterRules[0] = { key: 'team', operator: 'eq', value: 'b' }
        return { rows: data.slice(0, 1).map((row) => ({ ...row })), total: 1 }
      }),
      pageSize: 10,
      immediate: false,
    })

    ds.store.setState((state) => ({
      ...state,
      sort: { key: 'age', direction: 'asc' },
      multiSort: [{ key: 'team', direction: 'asc' }],
      filters: { name: 'ali' },
      filterRules: [{ key: 'name', operator: 'eq', value: { nested: 'kept' } }],
    }))
    await ds.load()

    expect(ds.getState()).toMatchObject({
      sort: { key: 'age', direction: 'asc' },
      multiSort: [{ key: 'team', direction: 'asc' }],
      filters: { name: 'ali' },
      filterRules: [{ key: 'name', operator: 'eq', value: { nested: 'kept' } }],
    })
  })

  it('owns fetched row snapshots instead of aliasing fetcher-owned rows', async () => {
    const serverRows = data.map((row) => ({ ...row }))
    const ds = createDataSource<User>({
      fetcher: vi.fn(async () => ({ rows: serverRows, total: serverRows.length })),
      pageSize: 10,
      immediate: false,
    })

    await ds.load()
    serverRows[0]!.name = 'outside'

    expect(ds.getState().rows[0]?.name).toBe('Charlie')
  })

  it('rolls back an in-place optimistic row mutation on rejection', async () => {
    const ds = createDataSource<User>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 10,
      immediate: false,
    })
    await ds.load()

    await expect(
      ds.mutateRow(
        '1',
        async () => {
          throw new Error('boom')
        },
        {
          optimistic: (rows) => {
            rows[0]!.name = 'broken'
            return rows
          },
        },
      ),
    ).rejects.toThrow('boom')

    expect(ds.getState().rows[0]?.name).toBe('Charlie')
  })
})
