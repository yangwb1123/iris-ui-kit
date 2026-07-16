import { describe, it, expect, vi } from 'vitest'
import { createOutbox, type OutboxItem, type OutboxStorage } from './outbox'

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

  it('notifies subscribers on enqueue and delivery', async () => {
    const sizes: number[] = []
    const outbox = createOutbox<number>({ execute: async () => {}, generateId: ids() })
    outbox.subscribe((items) => sizes.push(items.length))
    outbox.enqueue(1)
    await outbox.flush()
    expect(sizes[0]).toBe(1) // after enqueue
    expect(sizes[sizes.length - 1]).toBe(0) // after delivery
  })

  it('remove() and clear() drop items', () => {
    const outbox = createOutbox<number>({ execute: async () => {}, generateId: ids() })
    const id = outbox.enqueue(1)
    outbox.enqueue(2)
    outbox.remove(id)
    expect(outbox.pendingCount()).toBe(1)
    outbox.clear()
    expect(outbox.pendingCount()).toBe(0)
  })
})
