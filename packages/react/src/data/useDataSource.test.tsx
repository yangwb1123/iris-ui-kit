import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createClientDataSource, type DataViewColumn } from '@iris-ui-kit/core'
import { useDataSource } from './useDataSource'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const data: Row[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
  { id: 3, name: 'Bob', age: 35 },
]
const columns: DataViewColumn<Row>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'age', getValue: (r) => r.age },
]

afterEach(cleanup)

describe('useDataSource (react)', () => {
  it('loads on mount and re-sorts reactively', async () => {
    const { result } = renderHook(() =>
      useDataSource({ fetcher: createClientDataSource(data, columns), pageSize: 10 }),
    )
    await waitFor(() => expect(result.current.state.rows).toHaveLength(3))
    act(() => result.current.setSort({ key: 'age', direction: 'asc' }))
    await waitFor(() => expect(result.current.state.rows.map((r) => r.age)).toEqual([25, 30, 35]))
  })

  it('infinite mode appends via loadMore', async () => {
    const { result } = renderHook(() =>
      useDataSource({
        fetcher: createClientDataSource(data, columns),
        pageSize: 2,
        mode: 'infinite',
      }),
    )
    await waitFor(() => expect(result.current.state.rows).toHaveLength(2))
    expect(result.current.state.hasMore).toBe(true)
    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.state.rows).toHaveLength(3)
    expect(result.current.state.hasMore).toBe(false)
  })

  it('filters reactively', async () => {
    const { result } = renderHook(() =>
      useDataSource({ fetcher: createClientDataSource(data, columns), pageSize: 10 }),
    )
    await waitFor(() => expect(result.current.state.rows).toHaveLength(3))
    act(() => result.current.setFilter('name', 'li'))
    await waitFor(() =>
      expect(result.current.state.rows.map((r) => r.name).sort()).toEqual(['Alice', 'Charlie']),
    )
  })
})
