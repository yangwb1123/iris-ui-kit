import { describe, expect, it, vi } from 'vitest'
import { createDataSource, createSyncClientDataSource } from './data-source'
import * as mutations from './data-source-mutations'

const input = () => [{ id: 1, value: { count: 1 } }]

describe('data-source unused mutation runtime', () => {
  it('does not allocate the mutation engine for reads; allocates once before first mutation', async () => {
    const rows = input()
    const spy = vi.spyOn(mutations, 'createDataSourceMutationRuntime')
    try {
      const source = createDataSource({ fetcher: createSyncClientDataSource(rows, []) })
      await source.load()
      source.setPage(1)
      expect(spy).not.toHaveBeenCalled()
      source.destroy()
      expect(spy).not.toHaveBeenCalled()
      await source.mutate(async () => {})
      expect(spy).toHaveBeenCalledTimes(1)
      await source.mutateRow('1', async () => {}, { skipReload: true })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(source.getState().rows).toEqual(rows)
      expect(source.getState().rows[0]!.value).not.toBe(rows[0]!.value)
      source.destroy()
    } finally {
      spy.mockRestore()
    }
  })

  it('keeps configured outbox subscriptions eager', () => {
    const spy = vi.spyOn(mutations, 'createDataSourceMutationRuntime')
    try {
      const source = createDataSource({
        fetcher: createSyncClientDataSource(input(), []),
        outbox: true,
      })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(source.outbox).toBeDefined()
      source.destroy()
    } finally {
      spy.mockRestore()
    }
  })

  it('preserves first-use optimistic rollback and in-flight destroy outcomes', async () => {
    const rows = input()
    const source = createDataSource({ fetcher: createSyncClientDataSource(rows, []) })
    const error = new Error('first mutation rejected')
    const outcome = await source.mutateRowResult(
      '1',
      async () => {
        throw error
      },
      {
        optimistic: (current) => current.map((row) => ({ ...row, value: { count: 9 } })),
      },
    )
    expect(outcome.status).toBe('failed')
    expect(outcome.error).toBe(error)
    expect(source.getState().rows).toEqual(rows)
    expect(source.getState().pendingRows).toEqual([])
    let finish!: () => void
    const pending = source.mutateRowResult(
      '1',
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      {
        optimistic: (current) => current.map((row) => ({ ...row, value: { count: 8 } })),
      },
    )
    expect(source.getState().rows[0]!.value.count).toBe(8)
    source.destroy()
    finish()
    expect((await pending).status).toBe('failed')
    // Completion is invalidated, not guaranteed rolled back; reload reconciles.
    expect(source.getState().rows[0]!.value.count).toBe(8)
    await source.load()
    expect(source.getState().rows).toEqual(rows)
    expect((await source.mutateResult(async () => {}, { skipReload: true })).status).toBe(
      'delivered',
    )
    source.destroy()
  })
})
