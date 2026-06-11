import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { createClientDataSource, type DataViewColumn } from '@iris-ui/core'
import type { UseDataSource } from './useDataSource.svelte'
import DataSourceHarness from './DataSourceHarness.svelte'

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

describe('useDataSource (svelte)', () => {
  it('loads on mount and re-sorts reactively', async () => {
    let api: UseDataSource<Row> | undefined
    const { container } = render(DataSourceHarness, {
      props: {
        config: { fetcher: createClientDataSource(data, columns), pageSize: 10 },
        onready: (a: UseDataSource<Row>) => {
          api = a
        },
      },
    })
    await waitFor(() => expect(container.querySelector('[data-count]')?.textContent).toBe('3'))
    api!.setSort({ key: 'age', direction: 'asc' })
    flushSync()
    await waitFor(() =>
      expect(container.querySelector('[data-ages]')?.textContent).toBe('25,30,35'),
    )
  })

  it('infinite mode appends via loadMore + flips hasMore', async () => {
    let api: UseDataSource<Row> | undefined
    const { container } = render(DataSourceHarness, {
      props: {
        config: {
          fetcher: createClientDataSource(data, columns),
          pageSize: 2,
          mode: 'infinite',
        },
        onready: (a: UseDataSource<Row>) => {
          api = a
        },
      },
    })
    await waitFor(() => expect(container.querySelector('[data-count]')?.textContent).toBe('2'))
    expect(container.querySelector('[data-has-more]')?.textContent).toBe('true')
    await api!.loadMore()
    flushSync()
    await waitFor(() => expect(container.querySelector('[data-count]')?.textContent).toBe('3'))
    expect(container.querySelector('[data-has-more]')?.textContent).toBe('false')
  })

  it('filters reactively', async () => {
    let api: UseDataSource<Row> | undefined
    const { container } = render(DataSourceHarness, {
      props: {
        config: { fetcher: createClientDataSource(data, columns), pageSize: 10 },
        onready: (a: UseDataSource<Row>) => {
          api = a
        },
      },
    })
    await waitFor(() => expect(container.querySelector('[data-count]')?.textContent).toBe('3'))
    api!.setFilter('name', 'li')
    flushSync()
    await waitFor(() => {
      const names = container.querySelector('[data-rows]')?.textContent?.split(',').sort()
      expect(names).toEqual(['Alice', 'Charlie'])
    })
  })
})
