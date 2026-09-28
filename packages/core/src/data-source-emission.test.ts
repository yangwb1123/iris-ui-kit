import { describe, it, expect } from 'vitest'
import { createDataSource, createClientDataSource } from './data-source'
import type { DataViewColumn } from './data-view'

interface User extends Record<string, unknown> {
  id: number
  name: string
  team: string
}

const data: User[] = [
  { id: 1, name: 'Charlie', team: 'a' },
  { id: 2, name: 'Alice', team: 'b' },
  { id: 3, name: 'Bob', team: 'a' },
  { id: 4, name: 'Dave', team: 'b' },
  { id: 5, name: 'Eve', team: 'a' },
]

const columns: DataViewColumn<User>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'team', getValue: (r) => r.team },
]

function make() {
  return createDataSource<User>({
    fetcher: createClientDataSource(data, columns),
    pageSize: 10,
    immediate: false,
  })
}

describe('createDataSource — emission hygiene', () => {
  it('publishes the loaded rows once when no optimistic mutation is pending', async () => {
    // A load used to notify subscribers twice: `applyResult` published the
    // server snapshot and then re-published the same rows to re-apply pending
    // optimistic layers. The second emission cost an extra render in all four
    // adapters and defeated React's referential bail-out.
    const ds = make()
    const snapshots: number[][] = []
    ds.store.subscribe((state) => snapshots.push(state.rows.map((row) => row.id)))
    await ds.load()

    const settled = snapshots.filter((ids) => ids.length === data.length)
    expect(settled).toHaveLength(1)
  })

  it('still emits the loading edge, so a consumer can show a spinner', async () => {
    const ds = make()
    const loading: boolean[] = []
    ds.store.subscribe((state) => loading.push(state.loading))
    await ds.load()

    expect(loading).toContain(true)
    expect(loading.at(-1)).toBe(false)
  })
})

// The counterpart guarantee — a *pending* optimistic layer must still be
// re-applied over a fresh server snapshot — is pinned by data-source-outbox.test.ts
// ("permanent failure rebuilds from server rows reloaded after a deferred
// optimistic mutation"), the only path that keeps a layer pending across a load.
