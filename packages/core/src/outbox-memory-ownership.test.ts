import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOutbox, type OutboxItem } from './outbox'
import * as runtime from './outbox-runtime'

afterEach(() => vi.restoreAllMocks())

describe('private memory outbox ownership', () => {
  it('clones incoming payloads linearly instead of persisting the private queue repeatedly', async () => {
    // Observe the actual cloner; do not replace it or reduce the bench workload.
    const clone = vi.spyOn(runtime, 'cloneRuntimeValue')
    const delivered: number[] = []
    let nextId = 0
    const queue = createOutbox<{ nested: { id: number } }>({
      generateId: () => String(++nextId),
      execute: async (payload) => {
        delivered.push(payload.nested.id)
      },
    })
    for (let id = 0; id < 100; id++) {
      const input = { nested: { id } }
      queue.enqueue(input)
      input.nested.id = -1
    }
    expect(clone.mock.calls.length).toBeLessThanOrEqual(200)
    expect(await queue.flush()).toBe(100)
    expect(delivered).toEqual(Array.from({ length: 100 }, (_, id) => id))
    expect(queue.items()).toEqual([])
  })

  it('keeps snapshots isolated and observes reentrant changes in FIFO order', async () => {
    const seen: number[][] = []
    const delivered: number[] = []
    let nextId = 0
    const queue = createOutbox<{ id: number; nested: { value: string } }>({
      generateId: () => String(++nextId),
      execute: async (payload) => {
        delivered.push(payload.id)
      },
    })
    queue.subscribe((items) => {
      if (items[0]) items[0].payload.nested.value = 'observer edit'
      if (items.length === 1 && items[0]!.payload.id === 1) {
        queue.enqueue({ id: 2, nested: { value: 'two' } })
      }
    })
    queue.subscribe((items) => {
      seen.push(items.map((item) => item.payload.id))
      expect(items.every((item) => item.payload.nested.value !== 'observer edit')).toBe(true)
    })
    queue.enqueue({ id: 1, nested: { value: 'one' } })
    const snapshot = queue.items()
    snapshot[0]!.payload.nested.value = 'snapshot edit'
    expect(queue.items()[0]!.payload.nested.value).toBe('one')
    expect(seen).toEqual([[1], [1, 2]])
    await expect(queue.flush()).resolves.toBe(2)
    expect(delivered).toEqual([1, 2])
    expect(seen).toEqual([[1], [1, 2], [2], []])
  })

  it('still runs codec validation without an external storage and fails before queue mutation', () => {
    const encode = vi.fn((payload: { id: number }) => {
      if (payload.id === 2) throw new Error('not encodable')
      return { id: payload.id }
    })
    const queue = createOutbox({
      execute: async (_payload: { id: number }) => {},
      codec: { encode, decode: (stored: { id: number }) => stored },
    })
    queue.enqueue({ id: 1 })
    expect(() => queue.enqueue({ id: 2 })).toThrow('Unable to encode an outbox payload')
    expect(encode).toHaveBeenCalledTimes(3)
    expect(queue.items().map((item) => item.payload.id)).toEqual([1])
  })

  it('still persists every durable change with a detached snapshot before notifying', async () => {
    let saved: OutboxItem<{ id: number }>[] = []
    const saves = vi.fn((items: OutboxItem<{ id: number }>[]) => {
      saved = items
      if (items[0]) items[0].payload.id = -1
    })
    const delivered: number[] = []
    const queue = createOutbox({
      execute: async (payload: { id: number }) => {
        delivered.push(payload.id)
      },
      storage: { load: () => [], save: saves },
    })
    queue.enqueue({ id: 1 })
    queue.enqueue({ id: 2 })
    expect(saves).toHaveBeenCalledTimes(2)
    expect(saved[0]?.payload.id).toBe(-1)
    expect(queue.items().map((item) => item.payload.id)).toEqual([1, 2])
    await expect(queue.flush()).resolves.toBe(2)
    expect(delivered).toEqual([1, 2])
    expect(saves).toHaveBeenCalledTimes(4)
  })
})
