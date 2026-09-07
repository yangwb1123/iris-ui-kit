import { describe, expect, it, vi } from 'vitest'
import { createDataSource } from './data-source'
import { createOutbox, type OutboxItem, type OutboxStorage } from './outbox'

interface Row {
  id: number
  name: string
}

const initialRows: Row[] = [
  { id: 1, name: 'one' },
  { id: 2, name: 'two' },
]

function make(
  fetcher: () => Promise<{ rows: Row[]; total: number }>,
  outbox: NonNullable<Parameters<typeof createDataSource<Row>>[0]['outbox']>,
) {
  return createDataSource<Row>({ fetcher, immediate: false, pageSize: 10, outbox })
}

const optimisticRename = (name: string) => (rows: Row[]) =>
  rows.map((row) => (row.id === 1 ? { ...row, name } : row))

describe('createDataSource outbox mutation boundary', () => {
  it('returns deferred without reload, keeps optimistic rows pending, and preserves the original error', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, { maxAttempts: 2 })
    await ds.load()
    const error = new Error('offline')

    const outcome = await ds.mutateRowResult(
      '1',
      async () => {
        throw error
      },
      { optimistic: optimisticRename('queued') },
    )

    expect(outcome).toMatchObject({ status: 'deferred', error })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ds.getState().rows[0]?.name).toBe('queued')
    expect(ds.isRowPending('1')).toBe(true)
    expect(ds.rowError('1')).toBe(error)
    expect(ds.outbox?.pendingCount()).toBe(1)
  })

  it('legacy mutate rejects a deferred delivery with a stable boundary error', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows, total: 2 }))
    const ds = make(fetcher, { maxAttempts: 2 })
    const error = new Error('offline')

    await expect(
      ds.mutate(async () => {
        throw error
      }),
    ).rejects.toMatchObject({ code: 'DATA_SOURCE_MUTATION_DEFERRED', cause: error })
    expect(fetcher).not.toHaveBeenCalled()
    expect(ds.outbox?.pendingCount()).toBe(1)
  })

  it('permanent outbox failure rolls back optimistic mutateRow state and never reloads', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, { maxAttempts: 1 })
    await ds.load()
    const error = new Error('permanent')

    const outcome = await ds.mutateRowResult(
      '1',
      async () => {
        throw error
      },
      { optimistic: optimisticRename('wrong') },
    )

    expect(outcome).toMatchObject({ status: 'failed', error })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ds.getState().rows[0]?.name).toBe('one')
    expect(ds.isRowPending('1')).toBe(false)
    expect(ds.rowError('1')).toBe(error)
    expect(ds.outbox?.items()[0]).toMatchObject({ status: 'failed', attempts: 1 })
  })

  it('permanent failure rebuilds from server rows reloaded after a deferred optimistic mutation', async () => {
    let serverRows = initialRows.map((row) => ({ ...row }))
    const fetcher = vi.fn(async () => ({ rows: serverRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, { maxAttempts: 2 })
    await ds.load()
    const error = new Error('permanent')

    const deferred = await ds.mutateRowResult(
      '1',
      async () => {
        throw error
      },
      { optimistic: optimisticRename('wrong') },
    )
    expect(deferred.status).toBe('deferred')
    expect(ds.getState().rows.map((row) => row.name)).toEqual(['wrong', 'two'])

    serverRows = [
      { id: 1, name: 'one' },
      { id: 2, name: 'two*' },
    ]
    await ds.load()
    expect(ds.getState().rows.map((row) => row.name)).toEqual(['wrong', 'two*'])

    const failed = await ds.outbox!.flushDetailed()
    expect(failed.outcomes[0]?.status).toBe('failed')
    expect(ds.getState().rows.map((row) => row.name)).toEqual(['one', 'two*'])
  })

  it('permanent outbox mutate failure rolls back optimistic rows without a reload', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows, total: 2 }))
    const ds = make(fetcher, { maxAttempts: 1 })
    await ds.load()
    const error = new Error('permanent')

    const outcome = await ds.mutateResult(
      async () => {
        throw error
      },
      { optimistic: optimisticRename('wrong') },
    )

    expect(outcome).toMatchObject({ status: 'failed', error })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ds.getState().rows[0]?.name).toBe('one')
    expect(ds.outbox?.items()[0]?.status).toBe('failed')
  })

  it('a later flush delivers a deferred row, clears pending/error, and honors skipReload', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, { maxAttempts: 2 })
    await ds.load()
    let online = false
    const action = vi.fn(async () => {
      if (!online) throw new Error('offline')
    })

    const first = await ds.mutateRowResult('1', action, {
      optimistic: optimisticRename('queued'),
      skipReload: true,
    })
    expect(first.status).toBe('deferred')
    online = true
    await ds.outbox!.flushDetailed()

    expect(action).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ds.isRowPending('1')).toBe(false)
    expect(ds.rowError('1')).toBeUndefined()
    expect(ds.getState().rows[0]?.name).toBe('queued')
    expect(ds.outbox?.pendingCount()).toBe(0)
  })

  it('successful outbox mutate reloads once, while skipReload only avoids that reload', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows, total: 2 }))
    const ds = make(fetcher, true)
    await ds.load()
    const success = await ds.mutateResult(async () => {})
    expect(success.status).toBe('delivered')
    expect(fetcher).toHaveBeenCalledTimes(2)

    const skipped = await ds.mutateResult(async () => {}, { skipReload: true })
    expect(skipped.status).toBe('delivered')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(ds.outbox?.pendingCount()).toBe(0)
  })

  it('rehydrates a durable descriptor through the injected executor', async () => {
    let serialized = '[]'
    const storage = {
      load: () => JSON.parse(serialized) as unknown[],
      save: (items: unknown[]) => {
        serialized = JSON.stringify(items)
      },
    }
    const fetcher = vi.fn(async () => ({ rows: initialRows, total: 2 }))
    const first = make(fetcher, { storage, maxAttempts: 2 })
    const deferred = await first.mutateResult(
      async () => {
        throw new Error('offline')
      },
      { descriptor: { type: 'rename', id: 1 } },
    )
    expect(deferred.status).toBe('deferred')
    expect(serialized).not.toContain('run')

    const executed: unknown[] = []
    const second = make(fetcher, {
      storage,
      executor: async (descriptor) => {
        executed.push(descriptor)
      },
    })
    await second.outbox!.flushDetailed()
    expect(executed).toEqual([{ type: 'rename', id: 1 }])
    expect(serialized).toBe('[]')
  })

  it('resynchronizes a fresh controller after a successful durable replay', async () => {
    let serialized = '[]'
    const storage = {
      load: () => JSON.parse(serialized) as never[],
      save: (items: unknown[]) => {
        serialized = JSON.stringify(items)
      },
    }
    let serverRows = [{ id: 1, name: 'old' }]
    const fetcher = vi.fn(async () => ({ rows: serverRows.map((row) => ({ ...row })), total: 1 }))
    const first = make(fetcher, { storage, maxAttempts: 2 })
    await first.load()
    await first.mutateResult(
      async () => {
        throw new Error('offline')
      },
      { descriptor: { type: 'rename', id: 1 } },
    )

    const second = createDataSource<Row>({
      fetcher,
      immediate: false,
      pageSize: 10,
      resilient: { ttlMs: 60_000, breaker: false },
      outbox: {
        storage,
        executor: async () => {
          serverRows = [{ id: 1, name: 'new' }]
        },
      },
    })
    await second.load()
    expect(second.getState().rows[0]?.name).toBe('old')

    const result = await second.outbox!.flushDetailed()

    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0]).toMatchObject({ status: 'delivered', executorStatus: 'resolved' })
    expect(fetcher).toHaveBeenCalledTimes(3)
    await vi.waitFor(() => expect(second.getState().rows[0]?.name).toBe('new'))
  })

  it('does not resynchronize a fresh controller for deferred or failed durable replays', async () => {
    let serialized = JSON.stringify([
      {
        id: 'deferred',
        payload: { type: 'rename', id: 1 },
        attempts: 0,
        status: 'pending',
      },
    ])
    const storage = {
      load: () => JSON.parse(serialized) as never[],
      save: (items: unknown[]) => {
        serialized = JSON.stringify(items)
      },
    }
    const fetcher = vi.fn(async () => ({ rows: initialRows, total: 2 }))
    const second = createDataSource<Row>({
      fetcher,
      immediate: false,
      outbox: {
        storage,
        maxAttempts: 2,
        executor: async () => {
          throw new Error('offline')
        },
      },
    })

    await second.load()
    const deferred = await second.outbox!.flushDetailed()
    expect(deferred.outcomes[0]?.status).toBe('deferred')
    expect(fetcher).toHaveBeenCalledTimes(1)

    const failed = await second.outbox!.flushDetailed()
    expect(failed.outcomes[0]?.status).toBe('failed')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects a closure before durable storage and rolls back without running or reloading', async () => {
    let saved: unknown[] = []
    const storage = {
      load: () => saved as never,
      save: (items: unknown[]) => {
        saved = items
      },
    }
    const fetcher = vi.fn(async () => ({ rows: initialRows, total: 2 }))
    const action = vi.fn(async () => {})
    const ds = make(fetcher, { storage })
    await ds.load()

    const outcome = await ds.mutateResult(action, { optimistic: optimisticRename('unsafe') })
    expect(outcome.status).toBe('failed')
    expect((outcome.error as { code?: string }).code).toBe('OUTBOX_SERIALIZATION_ERROR')
    expect(action).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ds.getState().rows[0]?.name).toBe('one')
    expect(saved).toEqual([])
  })

  it('explicit outbox.remove rolls back deferred optimistic state and clears pending bookkeeping', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, { maxAttempts: 2 })
    await ds.load()

    const outcome = await ds.mutateRowResult(
      '1',
      async () => {
        throw new Error('offline')
      },
      { optimistic: optimisticRename('removed') },
    )
    expect(outcome.status).toBe('deferred')
    expect(ds.isRowPending('1')).toBe(true)
    const id = outcome.id!

    ds.outbox!.remove(id)

    expect(ds.outbox!.items()).toEqual([])
    expect(ds.getState().rows).toEqual(initialRows)
    expect(ds.isRowPending('1')).toBe(false)
    expect(ds.rowError('1')).toBeUndefined()
  })

  it('outbox.clear rolls back every deferred optimistic mutation without stale rows', async () => {
    const fetcher = vi.fn(async () => ({ rows: initialRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, { maxAttempts: 2 })
    await ds.load()

    const outcome = await ds.mutateRowResult(
      '1',
      async () => {
        throw new Error('offline')
      },
      { optimistic: optimisticRename('cleared') },
    )
    expect(outcome.status).toBe('deferred')
    expect(ds.isRowPending('1')).toBe(true)

    ds.outbox!.clear()

    expect(ds.outbox!.items()).toEqual([])
    expect(ds.getState().rows).toEqual(initialRows)
    expect(ds.isRowPending('1')).toBe(false)
    expect(ds.rowError('1')).toBeUndefined()
  })

  it('in-flight outbox.remove reports uncertain delivery and resynchronizes optimistic rows', async () => {
    let started!: () => void
    let release!: () => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const gate = new Promise<void>((resolve) => (release = resolve))
    let serverRows = initialRows.map((row) => ({ ...row }))
    const fetcher = vi.fn(async () => ({ rows: serverRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, true)
    await ds.load()

    const pending = ds.mutateRowResult(
      '1',
      async () => {
        started()
        await gate
        serverRows = [{ id: 1, name: 'server' }, initialRows[1]!]
      },
      { optimistic: optimisticRename('optimistic') },
    )
    await startedPromise
    const id = ds.outbox!.items()[0]!.id
    ds.outbox!.remove(id)
    expect(ds.getState().rows[0]?.name).toBe('one')
    release()

    await expect(pending).resolves.toMatchObject({
      status: 'failed',
      id,
      queued: false,
      error: expect.objectContaining({ code: 'OUTBOX_ITEM_REMOVED' }),
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(ds.getState().rows[0]?.name).toBe('server')
    expect(ds.isRowPending('1')).toBe(false)
  })

  it('in-flight outbox.clear reports uncertain delivery and resynchronizes optimistic rows', async () => {
    let started!: () => void
    let release!: () => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const gate = new Promise<void>((resolve) => (release = resolve))
    let serverRows = initialRows.map((row) => ({ ...row }))
    const fetcher = vi.fn(async () => ({ rows: serverRows.map((row) => ({ ...row })), total: 2 }))
    const ds = make(fetcher, true)
    await ds.load()

    const pending = ds.mutateRowResult(
      '1',
      async () => {
        started()
        await gate
        serverRows = [{ id: 1, name: 'server-after-clear' }, initialRows[1]!]
      },
      { optimistic: optimisticRename('optimistic') },
    )
    await startedPromise
    ds.outbox!.clear()
    expect(ds.getState().rows[0]?.name).toBe('one')
    release()

    await expect(pending).resolves.toMatchObject({
      status: 'failed',
      queued: false,
      error: expect.objectContaining({ code: 'OUTBOX_ITEM_REMOVED' }),
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(ds.getState().rows[0]?.name).toBe('server-after-clear')
    expect(ds.isRowPending('1')).toBe(false)
  })

  it('destroy prevents a late outbox result from reloading or leaving a row pending', async () => {
    let started!: () => void
    let release!: () => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const gate = new Promise<void>((resolve) => (release = resolve))
    const fetcher = vi.fn(async () => ({ rows: initialRows, total: 2 }))
    const ds = make(fetcher, true)
    await ds.load()
    const pending = ds.mutateRow(
      '1',
      async () => {
        started()
        await gate
      },
      { optimistic: optimisticRename('late') },
    )
    await startedPromise
    expect(ds.isRowPending('1')).toBe(true)

    ds.destroy()
    release()
    await expect(pending).rejects.toMatchObject({ code: 'DATA_SOURCE_MUTATION_UNDELIVERED' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(ds.getState().rows[0]?.name).toBe('one')
    expect(ds.isRowPending('1')).toBe(false)
    expect(ds.rowError('1')).toBeUndefined()
    expect(ds.outbox?.pendingCount()).toBe(0)
  })
})

describe('createOutbox storage failure accounting', () => {
  it('does not classify a successful execution as a retry when saving delivery fails', async () => {
    let saved: OutboxItem<number>[] = []
    let fail = false
    const storage: OutboxStorage<number> = {
      load: () => saved,
      save: (items) => {
        if (fail) {
          fail = false
          throw new Error('storage unavailable')
        }
        saved = items
      },
    }
    const execute = vi.fn(async () => {})
    const outbox = createOutbox({ execute, storage, generateId: () => 'id' })
    outbox.enqueue(1)
    fail = true
    await expect(outbox.flushDetailed()).rejects.toThrow('storage unavailable')
    expect(execute).toHaveBeenCalledTimes(1)
    expect(outbox.items()).toMatchObject([{ payload: 1, attempts: 0, status: 'pending' }])
    expect(await outbox.flush()).toBe(1)
  })
})
