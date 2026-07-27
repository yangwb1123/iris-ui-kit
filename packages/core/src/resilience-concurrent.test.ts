import { describe, it, expect } from 'vitest'
import { createQueryCache } from './query-cache'
import { createOutbox } from './outbox'
import { createDisposableScope } from './disposable'

describe('Resilience concurrent safety', () => {
  it('query cache: concurrent duplicate fetches deduplicate', async () => {
    const cache = createQueryCache<string>({ ttlMs: 5000 })
    let callCount = 0
    const fetcher = async (k: string) => {
      callCount++
      await new Promise((r) => setTimeout(r, 10))
      return `result-${k}`
    }
    const results = await Promise.all([
      cache.fetch('key1', fetcher),
      cache.fetch('key1', fetcher),
      cache.fetch('key1', fetcher),
    ])
    expect(callCount).toBe(1)
    expect(results).toEqual(['result-key1', 'result-key1', 'result-key1'])
  })

  it('query cache: TTL expiry re-fetches', async () => {
    const cache = createQueryCache<string>({ ttlMs: 20 })
    let callCount = 0
    const fetcher = async (k: string) => {
      callCount++
      return `val-${k}`
    }
    await cache.fetch('k', fetcher)
    await new Promise((r) => setTimeout(r, 30))
    await cache.fetch('k', fetcher)
    expect(callCount).toBe(2)
  })

  it('outbox: concurrent flushes resolve once', async () => {
    let delivered = 0
    const outbox = createOutbox<{ id: number }>({
      execute: async () => {
        await new Promise((r) => setTimeout(r, 5))
        delivered++
      },
      maxAttempts: 1,
    })
    outbox.enqueue({ id: 1 })
    outbox.enqueue({ id: 2 })
    const [r1] = await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()])
    // First flush delivers 2 items
    expect(r1).toBe(2)
    // Wait for flush to complete, then verify delivery
    await new Promise((r) => setTimeout(r, 20))
    expect(delivered).toBe(2)
  })

  it('disposable scope: nested scopes destroy in correct order', () => {
    const order: number[] = []
    const outer = createDisposableScope()
    outer.add(() => order.push(1))
    const inner = outer.scope()
    inner.add(() => order.push(2))
    outer.add(() => order.push(3))
    outer.destroy()
    // LIFO: last registered (3) → inner scope (2) → first registered (1)
    expect(order).toEqual([3, 2, 1])
  })

  it('disposable scope: add after destroy runs immediately', () => {
    const scope = createDisposableScope()
    let cleaned = false
    scope.destroy()
    scope.add(() => {
      cleaned = true
    })
    expect(cleaned).toBe(true)
    expect(scope.disposed).toBe(true)
  })
})
