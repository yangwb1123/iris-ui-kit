import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridFilteringFeature,
  createGridPaginationFeature,
  createGridRowsFeature,
  createGridSortingFeature,
  type GridFeature,
  type GridPaginationState,
} from '@iris-ui-kit/core/grid'
import {
  createGridQueryFeature,
  GRID_QUERY_CHANGE_EVENT,
  type GridQueryChange,
  type GridQueryFeatureOptions,
  type GridQueryResult,
  type GridQueryState,
} from './grid-query'

type Row = { id: number; name: string }

function standardFeatures(
  query: GridFeature<Row>,
  rows: readonly Row[] = [{ id: 0, name: 'old' }],
): GridFeature<Row>[] {
  return [
    createGridRowsFeature<Row>({ defaultRows: rows }),
    createGridPaginationFeature<Row>({ defaultPage: 2, defaultPageSize: 25 }),
    createGridSortingFeature<Row>({ defaultSort: { key: 'name', direction: 'asc' } }),
    createGridFilteringFeature<Row>({
      defaultFilters: { name: 'ada' },
      defaultFilterValues: { role: ['admin'] },
    }),
    query,
  ]
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  return { promise: new Promise<T>((done) => (resolve = done)), resolve }
}

describe('plugin-pro-table query GridFeature', () => {
  it('snapshots standard features and silently writes rows plus pagination', async () => {
    const fetcher = vi.fn(async () => ({ rows: [{ id: 1, name: 'Ada' }], total: 42 }))
    const onChange = vi.fn()
    const grid = createGridCore<Row>({
      features: standardFeatures(createGridQueryFeature<Row>({ fetcher, onChange })),
    })
    const rowChanges = vi.fn()
    const events: GridQueryChange[] = []
    grid.on('rows:change', rowChanges)
    grid.on<GridQueryChange>(GRID_QUERY_CHANGE_EVENT, (change) => events.push(change))

    const result = await grid.invoke<Promise<GridQueryResult<Row> | undefined>>('loadGridData')

    expect(result).toEqual({ rows: [{ id: 1, name: 'Ada' }], total: 42 })
    expect(fetcher.mock.calls[0]![0]).toEqual({
      page: 2,
      pageSize: 25,
      sort: { key: 'name', direction: 'asc' },
      multiSort: [],
      filters: { name: 'ada' },
      filterValues: { role: ['admin'] },
    })
    expect(grid.invoke('getRows')).toEqual([{ id: 1, name: 'Ada' }])
    expect(grid.invoke<GridPaginationState>('getPagination')).toEqual({
      page: 2,
      pageSize: 25,
      total: 42,
    })
    expect(grid.invoke<GridQueryState>('getQueryState').status).toBe('success')
    expect(events.map((event) => event.type)).toEqual(['start', 'success'])
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(rowChanges).not.toHaveBeenCalled()
  })

  it('normalizes overrides and ignores a superseded response even if it settles later', async () => {
    const requests: Array<{
      signal: AbortSignal | undefined
      result: ReturnType<typeof deferred<GridQueryResult<Row>>>
    }> = []
    const fetcher: GridQueryFeatureOptions<Row>['fetcher'] = (_query, signal) => {
      const result = deferred<GridQueryResult<Row>>()
      requests.push({ signal, result })
      return result.promise
    }
    const events: GridQueryChange[] = []
    const grid = createGridCore<Row>({
      features: standardFeatures(createGridQueryFeature<Row>({ fetcher })),
    })
    grid.on<GridQueryChange>(GRID_QUERY_CHANGE_EVENT, (change) => events.push(change))

    const first = grid.invoke<Promise<GridQueryResult<Row> | undefined>>('loadGridData', {
      page: 1,
    })
    const second = grid.invoke<Promise<GridQueryResult<Row> | undefined>>('loadGridData', {
      page: 3.9,
      pageSize: -1,
      sort: null,
      filters: {},
    })
    expect(requests[0]!.signal?.aborted).toBe(true)

    requests[1]!.result.resolve({ rows: [{ id: 2, name: 'new' }], total: 7.8 })
    await expect(second).resolves.toEqual({ rows: [{ id: 2, name: 'new' }], total: 7 })
    requests[0]!.result.resolve({ rows: [{ id: 1, name: 'stale' }], total: 99 })
    await expect(first).resolves.toBeUndefined()

    expect(grid.invoke('getRows')).toEqual([{ id: 2, name: 'new' }])
    expect(grid.invoke<GridPaginationState>('getPagination')).toEqual({
      page: 3,
      pageSize: 25,
      total: 7,
    })
    expect(events.map((event) => event.type)).toEqual(['start', 'start', 'success'])
  })

  it('captures failures without replacing the last successful rows', async () => {
    const failure = new Error('offline')
    const grid = createGridCore<Row>({
      features: standardFeatures(
        createGridQueryFeature<Row>({
          fetcher: () => {
            throw failure
          },
        }),
      ),
    })
    const events: GridQueryChange[] = []
    grid.on<GridQueryChange>(GRID_QUERY_CHANGE_EVENT, (change) => events.push(change))

    await expect(
      grid.invoke<Promise<GridQueryResult<Row> | undefined>>('reloadGridData'),
    ).resolves.toBeUndefined()
    expect(grid.invoke('getRows')).toEqual([{ id: 0, name: 'old' }])
    expect(grid.invoke<GridQueryState>('getQueryState')).toMatchObject({
      status: 'error',
      error: failure,
    })
    expect(events.map((event) => event.type)).toEqual(['start', 'error'])
  })

  it('cancels an active request and aborts again on feature disposal', async () => {
    const pending = deferred<GridQueryResult<Row>>()
    let signal: AbortSignal | undefined
    const grid = createGridCore<Row>({
      features: standardFeatures(
        createGridQueryFeature<Row>({
          fetcher: (_query, nextSignal) => {
            signal = nextSignal
            return pending.promise
          },
        }),
      ),
    })
    const events: GridQueryChange[] = []
    grid.on<GridQueryChange>(GRID_QUERY_CHANGE_EVENT, (change) => events.push(change))
    const request = grid.invoke<Promise<GridQueryResult<Row> | undefined>>('loadGridData')

    expect(grid.invoke<boolean>('cancelGridQuery')).toBe(true)
    expect(signal?.aborted).toBe(true)
    expect(grid.invoke<GridQueryState>('getQueryState').status).toBe('idle')
    expect(grid.invoke<boolean>('cancelGridQuery')).toBe(false)
    pending.resolve({ rows: [{ id: 2, name: 'late' }], total: 1 })
    await expect(request).resolves.toBeUndefined()
    expect(events.map((event) => event.type)).toEqual(['start', 'cancel'])

    const pendingOnDestroy = deferred<GridQueryResult<Row>>()
    let destroySignal: AbortSignal | undefined
    const disposable = createGridCore<Row>({
      features: standardFeatures(
        createGridQueryFeature<Row>({
          fetcher: (_query, nextSignal) => {
            destroySignal = nextSignal
            return pendingOnDestroy.promise
          },
        }),
      ),
    })
    const destroyedRequest =
      disposable.invoke<Promise<GridQueryResult<Row> | undefined>>('loadGridData')
    disposable.destroy()
    expect(destroySignal?.aborted).toBe(true)
    pendingOnDestroy.resolve({ rows: [{ id: 3, name: 'disposed' }], total: 1 })
    await expect(destroyedRequest).resolves.toBeUndefined()
  })

  it('loads once on ready when immediate and enforces its standard dependencies', async () => {
    const fetcher = vi.fn(async () => ({ rows: [{ id: 1, name: 'ready' }], total: 1 }))
    const grid = createGridCore<Row>({
      features: standardFeatures(createGridQueryFeature<Row>({ fetcher, immediate: true })),
    })

    grid.ready()
    await vi.waitFor(() => expect(grid.invoke('getRows')).toEqual([{ id: 1, name: 'ready' }]))
    grid.ready()
    expect(fetcher).toHaveBeenCalledTimes(1)

    expect(() =>
      createGridCore<Row>({
        features: [createGridQueryFeature<Row>({ fetcher })],
      }),
    ).toThrow('requires missing feature "rows"')
  })
})
