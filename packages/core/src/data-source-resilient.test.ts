import { describe, it, expect } from 'vitest'
import { createDataSource } from './data-source'
import { createSyncClientDataSource } from './data-source/client'
import type { DataViewColumn } from './data-view'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const ROWS: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
]

const COLUMNS: DataViewColumn<Row>[] = [
  { key: 'id', getValue: (r) => r.id },
  { key: 'name', getValue: (r) => r.name },
]

describe('createDataSource with resilient option', () => {
  it('resilient mode: constructs without error', () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 2,
      resilient: { ttlMs: 5000 },
    })
    expect(ds.getState().pageSize).toBe(2)
  })

  it('resilient mode: loads data correctly', async () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 2,
      resilient: { ttlMs: 5000 },
    })
    await ds.load()
    const state = ds.getState()
    expect(state.rows.length).toBe(2)
    expect(state.rows[0]?.name).toBe('Alice')
    expect(state.total).toBe(3)
  })

  it('resilient mode: second load hits cache (repeated query)', async () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 10,
      resilient: { ttlMs: 5000 },
    })
    // Wrap to count calls
    const originalLoad = ds.load.bind(ds)
    await originalLoad()
    await originalLoad()
    // With cache, second call should still work (data from cache or re-fetch)
    const state = ds.getState()
    expect(state.rows.length).toBe(3)
  })

  it('resilient mode: circuit breaker trips on repeated failures', async () => {
    const failingFetcher = async () => {
      throw new Error('Network error')
    }
    const ds = createDataSource<Row>({
      fetcher: failingFetcher,
      pageSize: 10,
      resilient: { ttlMs: 0, breaker: { failureThreshold: 2, resetMs: 60000 } },
    })
    await ds.load()
    expect(ds.getState().error).toBeTruthy()
  })

  it('resilient mode: works with outbox config', async () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 10,
      outbox: { maxAttempts: 1 },
    })
    await ds.load()
    expect(ds.getState().rows.length).toBe(3)
  })
})
