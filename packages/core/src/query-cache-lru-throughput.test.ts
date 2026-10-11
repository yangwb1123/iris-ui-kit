import { describe, expect, it, vi } from 'vitest'
import { createQueryCache } from './query-cache'

describe('query-cache no-op newest-entry reorder', () => {
  it('does not delete/reinsert an already-newest entry on each unique settlement', async () => {
    const cache = createQueryCache<number>({ ttlMs: 60_000 })
    const signals: AbortSignal[] = []
    const spy = vi.spyOn(Map.prototype, 'delete')
    let reorders: number
    try {
      for (let i = 0; i < 10; i++) {
        await cache.fetch(`query-lru-fixture-${i}`, async (_, signal) => {
          signals.push(signal!)
          return i
        })
      }
      reorders = spy.mock.calls.filter(
        ([key]) => typeof key === 'string' && key.startsWith('query-lru-fixture-'),
      ).length
    } finally {
      spy.mockRestore()
    }
    expect(reorders).toBe(0)
    expect(new Set(signals).size).toBe(10)
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal)
    cache.clear()
    for (const signal of signals) expect(signal.aborted).toBe(false)
  })

  it('preserves actual LRU order and reentrant clear/remove insertion', async () => {
    const cache = createQueryCache<number>({ ttlMs: 60_000, maxEntries: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')!.data).toBe(1)
    cache.remove('a')
    cache.set('d', 4)
    cache.set('e', 5)
    expect(cache.get('c')).toBeUndefined()
    expect(cache.get('d')!.data).toBe(4)
    cache.clear()
    let signal: AbortSignal | undefined
    const pending = cache.fetch('pending', (_, current) => {
      signal = current
      current!.addEventListener('abort', () => cache.set('reentered', 7))
      return new Promise<number>(() => {})
    })
    void pending
    cache.clear()
    expect(signal!.aborted).toBe(true)
    cache.set('later', 8)
    cache.set('newest', 9)
    expect(cache.get('reentered')).toBeUndefined()
    expect(cache.get('later')!.data).toBe(8)
    expect(cache.get('newest')!.data).toBe(9)
  })
})
