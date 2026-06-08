import { describe, expect, it, vi } from 'vitest'
import { createAsyncResource } from './async'

/** A promise plus its resolver/rejecter, for deterministic race tests. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createAsyncResource', () => {
  it('starts idle with no data', () => {
    const r = createAsyncResource(async () => 1)
    expect(r.getState()).toEqual({ status: 'idle', data: undefined, error: undefined })
  })

  it('starts in success when seeded with initialData (incl. undefined)', () => {
    expect(createAsyncResource(async () => 1, { initialData: 5 }).getState()).toEqual({
      status: 'success',
      data: 5,
      error: undefined,
    })
  })

  it('transitions loading → success and resolves to the data', async () => {
    const d = deferred<number>()
    const r = createAsyncResource(() => d.promise)
    const p = r.load()
    expect(r.getState().status).toBe('loading')
    d.resolve(42)
    await expect(p).resolves.toBe(42)
    expect(r.getState()).toEqual({ status: 'success', data: 42, error: undefined })
  })

  it('transitions loading → error and retains prior data (stale-while-error)', async () => {
    const r = createAsyncResource<number>(
      vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('boom')),
    )
    await r.load()
    expect(r.getState().data).toBe(1)
    await r.load()
    expect(r.getState().status).toBe('error')
    expect((r.getState().error as Error).message).toBe('boom')
    expect(r.getState().data).toBe(1) // prior data retained
  })

  it('drops a stale result when a newer load wins the race', async () => {
    const a = deferred<string>()
    const b = deferred<string>()
    const calls = [a, b]
    let i = 0
    const r = createAsyncResource(() => calls[i++].promise)
    const first = r.load() // token 1
    const second = r.load() // token 2 (latest)
    // Resolve the newer call first, then the stale one.
    b.resolve('B')
    a.resolve('A-stale')
    await Promise.all([first, second])
    expect(r.getState().data).toBe('B')
    expect(r.getState().status).toBe('success')
  })

  it('reload re-runs with the previous params', async () => {
    const fetcher = vi.fn(async (id: number) => `item-${id}`)
    const r = createAsyncResource(fetcher)
    await r.load(7)
    await r.reload()
    expect(fetcher).toHaveBeenCalledTimes(2)
    // params are preserved across reload; an AbortSignal is appended as a
    // trailing arg (the fetcher above ignores it).
    expect(fetcher).toHaveBeenLastCalledWith(7, expect.any(AbortSignal))
    expect(r.getState().data).toBe('item-7')
  })

  it('mutate sets data directly (value and updater forms)', () => {
    const r = createAsyncResource(async () => 0, { initialData: 10 })
    r.mutate(20)
    expect(r.getState().data).toBe(20)
    r.mutate((prev) => (prev ?? 0) + 5)
    expect(r.getState().data).toBe(25)
    expect(r.getState().status).toBe('success')
  })

  it('reset restores initial state and invalidates in-flight loads', async () => {
    const d = deferred<number>()
    const r = createAsyncResource(() => d.promise, { initialData: 1 })
    const p = r.load()
    r.reset()
    expect(r.getState()).toEqual({ status: 'success', data: 1, error: undefined })
    // The in-flight load resolves but must not overwrite the reset state.
    d.resolve(99)
    await p
    expect(r.getState().data).toBe(1)
  })

  it('notifies subscribers across the lifecycle', async () => {
    const r = createAsyncResource(async () => 'x')
    const listener = vi.fn()
    r.subscribe(listener)
    await r.load()
    // loading + success = at least two notifications.
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('passes an AbortSignal as a trailing arg; a new load aborts the previous', async () => {
    const seen: AbortSignal[] = []
    const d1 = deferred<number>()
    const d2 = deferred<number>()
    let call = 0
    const r = createAsyncResource((signal?: AbortSignal) => {
      if (signal) seen.push(signal)
      return ++call === 1 ? d1.promise : d2.promise
    })
    const p1 = r.load()
    expect(seen[0]?.aborted).toBe(false)
    r.load() // supersede → aborts the first
    expect(seen[0]?.aborted).toBe(true)
    expect(seen[1]?.aborted).toBe(false)
    d1.resolve(1)
    await p1 // superseded → no state write
    d2.resolve(2)
    await Promise.resolve()
  })

  it('cancel() aborts the in-flight request without changing displayed state', async () => {
    const d = deferred<number>()
    let captured: AbortSignal | undefined
    const r = createAsyncResource(
      (signal?: AbortSignal) => {
        captured = signal
        return d.promise
      },
      { initialData: 7 },
    )
    const p = r.load()
    r.cancel()
    expect(captured?.aborted).toBe(true)
    expect(r.getState().data).toBe(7) // unchanged
    d.resolve(99)
    await p
    expect(r.getState().data).toBe(7) // superseded load never wrote
  })

  it('a fetcher that ignores the signal still works (backward compatible)', async () => {
    const r = createAsyncResource(async (n: number) => n * 2)
    expect(await r.load(21)).toBe(42)
  })
})
