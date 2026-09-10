import { describe, it, expect, vi } from 'vitest'
import {
  createOutbox,
  OutboxSerializationError,
  type OutboxItem,
  type OutboxStorage,
} from './outbox'

/** A sequential id generator for deterministic tests. */
function ids() {
  let n = 0
  return () => `id${n++}`
}

describe('createOutbox', () => {
  it('enqueues and delivers in FIFO order', async () => {
    const delivered: number[] = []
    const outbox = createOutbox<number>({
      execute: async (p) => {
        delivered.push(p)
      },
      generateId: ids(),
    })
    outbox.enqueue(1)
    outbox.enqueue(2)
    outbox.enqueue(3)
    expect(outbox.pendingCount()).toBe(3)
    const count = await outbox.flush()
    expect(count).toBe(3)
    expect(delivered).toEqual([1, 2, 3])
    expect(outbox.pendingCount()).toBe(0)
  })

  it('stops at the first failing item to preserve order, and retries next flush', async () => {
    const delivered: number[] = []
    let failFirst = true
    const outbox = createOutbox<number>({
      execute: async (p) => {
        if (p === 1 && failFirst) throw new Error('offline')
        delivered.push(p)
      },
      generateId: ids(),
    })
    outbox.enqueue(1)
    outbox.enqueue(2)
    // First flush: item 1 fails → item 2 must NOT be delivered ahead of it.
    expect(await outbox.flush()).toBe(0)
    expect(delivered).toEqual([])
    expect(outbox.pendingCount()).toBe(2)
    expect(outbox.items()[0]!.attempts).toBe(1)
    // Recover and flush again → both delivered in order.
    failFirst = false
    expect(await outbox.flush()).toBe(2)
    expect(delivered).toEqual([1, 2])
  })

  it('marks an item failed after maxAttempts and skips it, continuing the queue', async () => {
    const delivered: number[] = []
    const outbox = createOutbox<number>({
      execute: async (p) => {
        if (p === 1) throw new Error('permanent')
        delivered.push(p)
      },
      maxAttempts: 2,
      generateId: ids(),
    })
    outbox.enqueue(1)
    outbox.enqueue(2)
    await outbox.flush() // attempt 1 on item1 → fail → stop
    const done = await outbox.flush() // attempt 2 on item1 → hits max → failed → skip → deliver item2
    expect(done).toBe(1)
    expect(delivered).toEqual([2])
    const failed = outbox.items().find((i) => i.status === 'failed')!
    expect(failed.payload).toBe(1)
    expect(failed.attempts).toBe(2)
    expect(outbox.pendingCount()).toBe(0)
  })

  it('persists to and restores from injected storage', async () => {
    let saved: OutboxItem<number>[] = []
    const storage: OutboxStorage<number> = {
      load: () => saved,
      save: (items) => {
        saved = items
      },
    }
    const a = createOutbox<number>({ execute: async () => {}, storage, generateId: ids() })
    a.enqueue(10)
    a.enqueue(20)
    expect(saved).toHaveLength(2)

    // A fresh outbox over the same storage restores the queue.
    const delivered: number[] = []
    const b = createOutbox<number>({
      execute: async (p) => {
        delivered.push(p)
      },
      storage,
    })
    expect(b.pendingCount()).toBe(2)
    await b.flush()
    expect(delivered).toEqual([10, 20])
    expect(saved).toHaveLength(0) // storage emptied after delivery
  })

  it('concurrent flush() calls share one in-flight flush', async () => {
    const execute = vi.fn(async () => {})
    const outbox = createOutbox<number>({ execute, generateId: ids() })
    outbox.enqueue(1)
    const [a, b] = await Promise.all([outbox.flush(), outbox.flush()])
    // The queue is drained exactly once, not twice.
    expect(execute).toHaveBeenCalledTimes(1)
    expect(a + b).toBeGreaterThanOrEqual(1)
  })

  it('does not start a nested runner when execute calls flush re-entrantly', async () => {
    let nested!: Promise<unknown>
    const execute = vi.fn(async () => {
      nested = outbox.flushDetailed()
    })
    const outbox = createOutbox<number>({ execute, generateId: ids() })
    outbox.enqueue(1)
    const flushing = outbox.flushDetailed()

    await flushing
    expect(nested).toBe(flushing)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('notifies subscribers in order on re-entrant enqueue and delivery', async () => {
    const observed: number[][] = []
    const outbox = createOutbox<number>({ execute: async () => {}, generateId: ids() })
    let nested = false
    outbox.subscribe(() => {
      if (!nested) {
        nested = true
        outbox.enqueue(2)
      }
    })
    outbox.subscribe((items) => observed.push(items.map((item) => item.payload)))
    outbox.enqueue(1)
    expect(observed.slice(0, 2)).toEqual([[1], [1, 2]])
    await outbox.flush()
    expect(observed[observed.length - 1]).toEqual([])
  })

  it('remove does not mark an in-flight item when durable persistence fails', async () => {
    let saved: OutboxItem<number>[] = []
    let failSave = false
    const storage: OutboxStorage<number> = {
      load: () => saved,
      save: (items) => {
        if (failSave) throw new Error('storage unavailable')
        saved = items
      },
    }
    let started!: () => void
    let release!: () => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const gate = new Promise<void>((resolve) => (release = resolve))
    const outbox = createOutbox<number>({
      execute: async () => {
        started()
        await gate
      },
      storage,
      generateId: ids(),
    })
    const id = outbox.enqueue(1)
    const flushing = outbox.flushDetailed()
    await startedPromise

    failSave = true
    expect(() => outbox.remove(id)).toThrow('storage unavailable')
    expect(outbox.items().map((item) => item.id)).toEqual([id])
    failSave = false
    release()

    await expect(flushing).resolves.toMatchObject({ status: 'delivered', delivered: 1, failed: 0 })
    expect(outbox.items()).toEqual([])
  })

  it('clear does not mark an in-flight item when durable persistence fails', async () => {
    let saved: OutboxItem<number>[] = []
    let failSave = false
    const storage: OutboxStorage<number> = {
      load: () => saved,
      save: (items) => {
        if (failSave) throw new Error('storage unavailable')
        saved = items
      },
    }
    let started!: () => void
    let release!: () => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const gate = new Promise<void>((resolve) => (release = resolve))
    const delivered: number[] = []
    const outbox = createOutbox<number>({
      execute: async (payload) => {
        delivered.push(payload)
        if (payload === 1 && delivered.length === 1) {
          started()
          await gate
        }
      },
      storage,
      generateId: ids(),
    })
    outbox.enqueue(1)
    outbox.enqueue(2)
    const flushing = outbox.flushDetailed()
    await startedPromise

    failSave = true
    expect(() => outbox.clear()).toThrow('storage unavailable')
    expect(outbox.pendingCount()).toBe(2)
    failSave = false
    release()

    await expect(flushing).resolves.toMatchObject({ status: 'delivered', delivered: 2, failed: 0 })
    expect(delivered).toEqual([1, 2])
    expect(outbox.items()).toEqual([])
  })

  it('merges enqueue and remove while execute is awaiting', async () => {
    let started!: () => void
    let release!: () => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const executeGate = new Promise<void>((resolve) => (release = resolve))
    const delivered: number[] = []
    const outbox = createOutbox<number>({
      execute: async (payload) => {
        delivered.push(payload)
        if (payload === 1) {
          started()
          await executeGate
        }
      },
      generateId: ids(),
    })
    const first = outbox.enqueue(1)
    const flushing = outbox.flushDetailed()
    await startedPromise
    outbox.remove(first)
    const second = outbox.enqueue(2)
    const removed = outbox.enqueue(3)
    outbox.remove(removed)
    release()

    const result = await flushing
    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(1)
    expect(delivered).toEqual([1, 2])
    expect(outbox.items()).toEqual([])
    expect(second).toBe('id1')
  })

  it('clear during execute is not undone when the in-flight item settles', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const execute = vi.fn(async () => {
      await gate
    })
    const outbox = createOutbox<number>({ execute, generateId: ids() })
    outbox.enqueue(1)
    const flushing = outbox.flushDetailed()
    await Promise.resolve()
    outbox.enqueue(2)
    outbox.clear()
    release()

    const result = await flushing
    expect(result).toMatchObject({ delivered: 0, failed: 1, status: 'failed' })
    expect(result.outcomes[0]).toMatchObject({
      status: 'failed',
      executorStatus: 'resolved',
      queued: false,
      removed: true,
      error: expect.objectContaining({ code: 'OUTBOX_ITEM_REMOVED' }),
    })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(outbox.items()).toEqual([])
  })

  it('preserves a successful executor outcome when an in-flight item is removed', async () => {
    let started!: () => void
    let release!: () => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const gate = new Promise<void>((resolve) => (release = resolve))
    const outbox = createOutbox<number>({
      execute: async () => {
        started()
        await gate
      },
      generateId: ids(),
    })
    const id = outbox.enqueue(1)
    const flushing = outbox.flushDetailed()
    await startedPromise
    outbox.remove(id)
    release()

    await expect(flushing).resolves.toMatchObject({
      status: 'failed',
      delivered: 0,
      failed: 1,
      outcomes: [
        {
          id,
          status: 'failed',
          executorStatus: 'resolved',
          queued: false,
          removed: true,
          error: expect.objectContaining({ code: 'OUTBOX_ITEM_REMOVED' }),
        },
      ],
    })
    // Explicit removal makes a resolved executor uncertain, so even the
    // compatibility flush() count cannot claim confirmed delivery.
    expect(await outbox.flush()).toBe(0)
    expect(outbox.items()).toEqual([])
  })

  it('continues with a new item when an in-flight failed item is removed', async () => {
    let started!: () => void
    let rejectFirst!: (error: Error) => void
    const startedPromise = new Promise<void>((resolve) => (started = resolve))
    const delivered: number[] = []
    const outbox = createOutbox<number>({
      execute: async (payload) => {
        if (payload === 1) {
          started()
          await new Promise<never>((_, reject) => (rejectFirst = reject))
          return
        }
        delivered.push(payload)
      },
      generateId: ids(),
    })
    const first = outbox.enqueue(1)
    const flushing = outbox.flushDetailed()
    await startedPromise
    outbox.remove(first)
    outbox.enqueue(2)
    rejectFirst(new Error('dropped'))

    const result = await flushing
    expect(result).toMatchObject({ status: 'failed', delivered: 1, failed: 1, deferred: 0 })
    expect(result.outcomes[0]).toMatchObject({
      id: first,
      status: 'failed',
      executorStatus: 'rejected',
      queued: false,
      removed: true,
      error: expect.objectContaining({ message: 'dropped' }),
    })
    expect(delivered).toEqual([2])
    expect(outbox.items()).toEqual([])
  })

  it('reports deferred and exhausted failures without counting either as delivered', async () => {
    const outbox = createOutbox<number>({
      execute: async () => {
        throw new Error('offline')
      },
      maxAttempts: 2,
      generateId: ids(),
    })
    const id = outbox.enqueue(1)
    const first = await outbox.flushDetailed()
    expect(first.status).toBe('deferred')
    expect(first.delivered).toBe(0)
    expect(first.deferred).toBe(1)
    expect(first.failed).toBe(0)
    expect(first.outcomes[0]).toMatchObject({
      id,
      status: 'deferred',
      attempts: 1,
      queued: true,
      error: expect.any(Error),
    })

    const second = await outbox.flushDetailed()
    expect(second.status).toBe('failed')
    expect(second.delivered).toBe(0)
    expect(second.failed).toBe(1)
    expect(second.outcomes[0]).toMatchObject({ id, status: 'failed', attempts: 2 })
    expect(outbox.items()[0]).toMatchObject({ id, status: 'failed', error: 'offline' })
    const existingFailure = await outbox.flushDetailed()
    expect(existingFailure).toMatchObject({ status: 'failed', delivered: 0, failed: 1 })
  })

  it('round-trips JSON descriptors through an injected executor without storing closures', async () => {
    type Runtime = { descriptor: { type: string; value: number }; run: () => Promise<void> }
    type Stored = { type: string; value: number }
    let json = '[]'
    const storage: OutboxStorage<Stored> = {
      load: () => JSON.parse(json) as OutboxItem<Stored>[],
      save: (items) => {
        json = JSON.stringify(items)
      },
    }
    const executed: Stored[] = []
    const codec = {
      encode: (payload: Runtime): Stored => payload.descriptor,
      decode: (descriptor: Stored): Runtime => ({
        descriptor,
        run: async () => {
          executed.push(descriptor)
        },
      }),
    }
    const first = createOutbox<Runtime, Stored>({
      execute: async (payload) => payload.run(),
      storage,
      codec,
      generateId: ids(),
    })
    first.enqueue({ descriptor: { type: 'rename', value: 7 }, run: async () => {} })
    expect(json).not.toContain('run')

    const second = createOutbox<Runtime, Stored>({
      execute: async (payload) => payload.run(),
      storage,
      codec,
    })
    expect(second.items()[0]?.payload.descriptor).toEqual({ type: 'rename', value: 7 })
    await second.flush()
    expect(executed).toEqual([{ type: 'rename', value: 7 }])
    expect(json).toBe('[]')
  })

  it('fails closed for a closure sent to custom storage and isolates snapshots', () => {
    let saved: OutboxItem<{ value: number }>[] = []
    const storage: OutboxStorage<{ value: number }> = {
      load: () => saved,
      save: (items) => {
        saved = items
      },
    }
    const outbox = createOutbox<{ value: number }>({
      execute: async () => {},
      storage,
      generateId: ids(),
    })
    const input = { value: 1 }
    expect(() =>
      outbox.enqueue(input as { value: number } & { run?: () => Promise<void> }),
    ).not.toThrow()
    input.value = 7
    const item = outbox.items()[0]!
    item.payload.value = 9
    saved[0]!.payload.value = 8
    expect(outbox.items()[0]!.payload.value).toBe(1)

    const closureStorage: OutboxStorage<{ run: () => Promise<void> }> = {
      load: () => [],
      save: () => {},
    }
    const closureOutbox = createOutbox<{ run: () => Promise<void> }>({
      execute: async () => {},
      storage: closureStorage,
      generateId: ids(),
    })
    expect(() => closureOutbox.enqueue({ run: async () => {} })).toThrow(OutboxSerializationError)

    const duplicate = createOutbox<number>({ execute: async () => {}, generateId: () => 'same' })
    duplicate.enqueue(1)
    expect(() => duplicate.enqueue(2)).toThrow()
    const malformed: OutboxStorage<number> = {
      load: () => [{ id: 'bad', payload: 1, attempts: Number.NaN, status: 'pending' }],
      save: () => {},
    }
    expect(() => createOutbox({ execute: async () => {}, storage: malformed })).toThrow(
      OutboxSerializationError,
    )
  })

  it('preserves an own __proto__ payload key across the durable boundary', () => {
    let saved: OutboxItem<Record<string, unknown>>[] = []
    const storage: OutboxStorage<Record<string, unknown>> = {
      load: () => saved,
      save: (items) => (saved = items),
    }
    const outbox = createOutbox<Record<string, unknown>>({
      execute: async () => {},
      storage,
      generateId: ids(),
    })
    outbox.enqueue(JSON.parse('{"type":"test","__proto__":{"polluted":true}}'))
    expect(Object.prototype.hasOwnProperty.call(outbox.items()[0]!.payload, '__proto__')).toBe(true)
    expect(Object.prototype.polluted).toBeUndefined()
  })
})
