import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDataSourceMutationRuntime } from './data-source-mutations'
import type { DataSourceQueuedMutation } from './data-source-mutation-types'
import {
  DataSourceMutationDeferredError,
  DataSourceMutationUndeliveredError,
  type DataSourceState,
} from './data-source/types'
import { createOutbox, type AdvancedOutbox } from './outbox'
import { createStore } from './store'

type Row = { id: number; name: string }
const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  vi.restoreAllMocks()
})

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function makeOutbox(maxAttempts = Infinity) {
  let sequence = 0
  return createOutbox<DataSourceQueuedMutation>({
    execute: async (mutation) => {
      await mutation.run()
    },
    generateId: () => `mutation-${++sequence}`,
    maxAttempts,
  })
}

function fixture(outbox?: AdvancedOutbox<DataSourceQueuedMutation>) {
  let canonical: Row[] = [
    { id: 1, name: 'one' },
    { id: 2, name: 'two' },
  ]
  const store = createStore<DataSourceState<Row>>({
    rows: canonical,
    total: 2,
    page: 1,
    pageSize: 10,
    sort: null,
    multiSort: [],
    filters: {},
    filterRules: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    selectedKeys: [],
    pendingRows: [],
    rowErrors: {},
  })
  const invalidate = vi.fn()
  const reload = vi.fn(async () => {
    store.setState((state) => ({ ...state, rows: canonical.map((row) => ({ ...row })) }))
    runtime.reapplyPendingOptimistic()
  })
  const runtime = createDataSourceMutationRuntime({
    store,
    outbox: outbox ?? null,
    reload,
    invalidateAfterMutation: invalidate,
    getCanonicalRows: () => canonical,
    setCanonicalRows: (rows) => {
      canonical = rows
    },
  })
  cleanups.push(() => runtime.destroy())
  return { runtime, store, reload, invalidate }
}

const rename = (name: string) => (rows: Row[]) =>
  rows.map((row) => (row.id === 1 ? { ...row, name } : row))

describe('mutation ownership and delivery boundaries', () => {
  it('defers a queued sibling until its predecessor can deliver', async () => {
    const outbox = makeOutbox()
    const { runtime, store, reload } = fixture(outbox)
    const gate = deferred()
    const error = new Error('offline')
    let online = false
    const first = runtime.mutateRow('1', async () => {
      await gate.promise
      if (!online) throw error
    })
    const laterAction = vi.fn(async () => {})
    const later = runtime.mutateRow('1', laterAction)
    expect(store.getState().pendingRows).toEqual(['1'])
    gate.resolve()
    const [firstResult, laterResult] = await Promise.all([first, later])
    expect(firstResult).toMatchObject({ status: 'deferred', attempts: 1, error, queued: true })
    expect(laterResult).toMatchObject({ status: 'deferred', attempts: 0, queued: true })
    expect(laterResult.error).toBeInstanceOf(DataSourceMutationDeferredError)
    expect((laterResult.error as Error & { cause: unknown }).cause).toBe(
      'Mutation is queued behind an earlier mutation',
    )
    expect(store.getState().rowErrors['1']).toBe(laterResult.error)
    expect(laterAction).not.toHaveBeenCalled()
    const pendingAtReload: string[][] = []
    reload.mockImplementation(async () => {
      pendingAtReload.push([...store.getState().pendingRows])
    })
    online = true
    const delivered = await outbox.flushDetailed()
    expect(delivered.outcomes.map((outcome) => outcome.status)).toEqual(['delivered', 'delivered'])
    expect(pendingAtReload).toEqual([['1'], []])
    expect(store.getState().rowErrors['1']).toBeUndefined()
    expect(laterAction).toHaveBeenCalledOnce()
  })

  it.each(['remove', 'fail'] as const)('preserves sibling state after %s', async (mode) => {
    const outbox = makeOutbox(3)
    const { runtime, store, reload, invalidate } = fixture(outbox)
    const error = new Error('offline')
    const first = await runtime.mutateRow('1', () => Promise.reject(error), {
      optimistic: rename('first'),
      skipReload: true,
    })
    const laterAction = vi.fn(async () => {})
    const later = await runtime.mutateRow('1', laterAction, {
      optimistic: rename('second'),
      skipReload: true,
    })
    expect(later.status).toBe('deferred')
    const transitions: Array<{ name: string; pending: string[]; error: unknown }> = []
    const unsubscribe = store.subscribe((state) =>
      transitions.push({
        name: state.rows[0].name,
        pending: state.pendingRows,
        error: state.rowErrors['1'],
      }),
    )
    if (mode === 'remove') {
      outbox.remove(first.id!)
      expect(store.getState().pendingRows).toEqual(['1'])
      expect(store.getState().rows[0].name).toBe('second')
    }
    await outbox.flushDetailed()
    expect(transitions).toContainEqual({ name: 'second', pending: ['1'], error: later.error })
    expect(store.getState().rows.map((row) => row.name)).toEqual(['second', 'two'])
    expect(store.getState().pendingRows).toEqual([])
    expect(store.getState().rowErrors['1']).toBeUndefined()
    expect(laterAction).toHaveBeenCalledOnce()
    expect(invalidate).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
    unsubscribe()
  })

  it.each([
    { row: false, optimistic: true, resolves: true },
    { row: false, optimistic: false, resolves: false },
    { row: true, optimistic: false, resolves: false },
    { row: true, optimistic: false, resolves: true },
  ])('settles removed work ($row/$optimistic/$resolves)', async (scenario) => {
    const outbox = makeOutbox()
    const { runtime, store, reload, invalidate } = fixture(outbox)
    const gate = deferred()
    const started = deferred()
    const error = new Error('executor rejected')
    const action = async () => {
      started.resolve()
      await gate.promise
    }
    const options = {
      skipReload: true,
      optimistic: scenario.optimistic ? rename('temporary') : undefined,
    }
    const pending = scenario.row
      ? runtime.mutateRow('1', action, options)
      : runtime.mutate(action, options)
    await started.promise
    const foreignAction = vi.fn(async () => {})
    outbox.enqueue({ description: 'untracked', run: foreignAction })
    outbox.clear()
    expect(store.getState().rows.map((row) => row.name)).toEqual(['one', 'two'])
    expect(store.getState().pendingRows).toEqual([])
    if (scenario.resolves) gate.resolve()
    else gate.reject(error)
    const outcome = await pending
    expect(outcome).toMatchObject({ status: 'failed', queued: false })
    if (scenario.resolves) expect(outcome.error).toMatchObject({ code: 'OUTBOX_ITEM_REMOVED' })
    else expect(outcome.error).toBe(error)
    expect(store.getState().rowErrors['1']).toBeUndefined()
    expect(invalidate).toHaveBeenCalledTimes(scenario.resolves ? 1 : 0)
    expect(reload).not.toHaveBeenCalled()
    expect(foreignAction).not.toHaveBeenCalled()
  })

  it.each([
    { row: false, resolves: true },
    { row: false, resolves: false },
    { row: true, resolves: true },
    { row: true, resolves: false },
  ])('ignores late direct results after destroy ($row/$resolves)', async ({ row, resolves }) => {
    const { runtime, store, reload, invalidate } = fixture()
    const gate = deferred()
    const error = new Error('late failure')
    const pending = row
      ? runtime.mutateRow('1', () => gate.promise)
      : runtime.mutate(() => gate.promise)
    runtime.destroy()
    const snapshot = store.getState()
    if (resolves) gate.resolve()
    else gate.reject(error)
    const outcome = await pending
    expect(outcome).toMatchObject({ status: 'failed', queued: false })
    if (resolves)
      expect(outcome.error).toMatchObject({
        code: 'DATA_SOURCE_MUTATION_UNDELIVERED',
        message: 'Data-source mutation was interrupted by destroy()',
      })
    else expect(outcome.error).toBe(error)
    expect(store.getState()).toBe(snapshot)
    expect(reload).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('reports destroy during a queued delivery reload', async () => {
    const outbox = makeOutbox()
    const { runtime, store, reload } = fixture(outbox)
    const started = deferred()
    const gate = deferred()
    reload.mockImplementation(async () => {
      started.resolve()
      await gate.promise
    })
    const pending = runtime.mutateRow('1', async () => {})
    await started.promise
    runtime.destroy()
    gate.resolve()
    await expect(pending).resolves.toMatchObject({
      status: 'failed',
      queued: false,
      error: expect.any(DataSourceMutationUndeliveredError),
    })
    expect(store.getState().pendingRows).toEqual([])
    expect(store.getState().rows[0].name).toBe('one')
    expect(reload).toHaveBeenCalledOnce()
  })

  it.each([new Error('offline'), undefined])(
    'fails a retry removed reentrantly (%s)',
    async (error) => {
      const outbox = makeOutbox()
      const { runtime, store, reload, invalidate } = fixture(outbox)
      const unsubscribe = outbox.subscribe((items) => {
        const retried = items.find((item) => item.attempts === 1)
        if (retried) outbox.remove(retried.id)
      })
      const outcome = await runtime.mutateRow('1', () => Promise.reject(error), {
        optimistic: rename('wrong'),
      })
      expect(outcome).toMatchObject({ status: 'failed', attempts: 1, queued: false })
      if (error) expect(outcome.error).toBe(error)
      else expect(outcome.error).toBeInstanceOf(DataSourceMutationUndeliveredError)
      expect(store.getState().pendingRows).toEqual([])
      expect(store.getState().rows[0].name).toBe('one')
      expect(outbox.items()).toEqual([])
      expect(reload).not.toHaveBeenCalled()
      expect(invalidate).not.toHaveBeenCalled()
      unsubscribe()
    },
  )

  it.each(['offline', undefined])('recovers an omitted outcome (%s)', async (message) => {
    const outbox = makeOutbox(1)
    const originalFlush = outbox.flushDetailed
    const originalItems = outbox.items
    vi.spyOn(outbox, 'flushDetailed').mockImplementation(async () => ({
      ...(await originalFlush()),
      outcomes: [],
    }))
    if (message === undefined)
      vi.spyOn(outbox, 'items').mockImplementation(() =>
        originalItems().map((item) => ({ ...item, error: undefined })),
      )
    const { runtime, store, reload } = fixture(outbox)
    const error = message === undefined ? undefined : new Error(message)
    const action = vi.fn(() => Promise.reject(error))
    const outcome = await runtime.mutateRow('1', action, { optimistic: rename('wrong') })
    expect(outcome).toMatchObject({ status: 'failed', attempts: 1, queued: true })
    expect(outcome.error).toBeInstanceOf(Error)
    expect((outcome.error as Error).message).toBe(message ?? 'Outbox mutation failed')
    expect(store.getState().rows[0].name).toBe('one')
    expect(store.getState().pendingRows).toEqual([])
    if (error) expect(store.getState().rowErrors['1']).toBe(error)
    else expect(store.getState().rowErrors['1']).toBeInstanceOf(DataSourceMutationUndeliveredError)
    expect(action).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
  })

  it('handles reasonless retries and duplicate flush notifications', async () => {
    const outbox = makeOutbox()
    const subscribe = outbox.subscribeFlush
    vi.spyOn(outbox, 'subscribeFlush').mockImplementation((listener) =>
      subscribe((result) => {
        listener(result)
        listener(result)
      }),
    )
    const { runtime, store, reload } = fixture(outbox)
    const outcome = await runtime.mutateRow('1', () => Promise.reject(undefined))
    expect(outcome).toMatchObject({
      status: 'deferred',
      attempts: 1,
      queued: true,
      error: undefined,
    })
    const deferredError = store.getState().rowErrors['1']
    expect(deferredError).toBeInstanceOf(DataSourceMutationDeferredError)
    expect(store.getState().pendingRows).toEqual(['1'])
    expect(reload).not.toHaveBeenCalled()
    runtime.destroy()
    expect(store.getState().pendingRows).toEqual([])
    expect(store.getState().rowErrors['1']).toBeUndefined()
    expect(store.getState().rows.map((row) => row.name)).toEqual(['one', 'two'])
  })

  it('preserves deferred errors and defaults unconfirmed failures', () => {
    const { runtime } = fixture()
    const deferredError = new DataSourceMutationDeferredError(new Error('offline'))
    let caught: unknown
    try {
      runtime.throwIfUndelivered({ status: 'deferred', queued: true, error: deferredError })
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(deferredError)
    expect(() => runtime.throwIfUndelivered({ status: 'failed', queued: false })).toThrow(
      DataSourceMutationUndeliveredError,
    )
    expect(() => runtime.throwIfUndelivered({ status: 'deferred', queued: true })).toThrow(
      expect.objectContaining({ code: 'DATA_SOURCE_MUTATION_DEFERRED', cause: undefined }),
    )
  })
})
