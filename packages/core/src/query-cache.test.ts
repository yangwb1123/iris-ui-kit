import { describe, it, expect, vi } from 'vitest'
import { createQueryCache } from './query-cache'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('createQueryCache', () => {
  it('caches within the ttl and refetches once stale', async () => {
    let clock = 1000
    const cache = createQueryCache<number>({ ttlMs: 100, now: () => clock })
    const fetcher = vi.fn(async () => 42)

    expect(await cache.fetch('k', fetcher)).toBe(42)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Within ttl → served from cache, no new fetch.
    clock = 1050
    expect(await cache.fetch('k', fetcher)).toBe(42)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Past ttl → refetch.
    clock = 2000
    expect(await cache.fetch('k', fetcher)).toBe(42)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('de-duplicates concurrent in-flight requests for the same key', async () => {
    const cache = createQueryCache<number>()
    let resolve!: (v: number) => void
    const fetcher = vi.fn(() => new Promise<number>((r) => (resolve = r)))

    const a = cache.fetch('k', fetcher)
    const b = cache.fetch('k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1) // shared in-flight promise

    resolve(7)
    expect(await a).toBe(7)
    expect(await b).toBe(7)
  })

  it('force bypasses a fresh cache', async () => {
    const cache = createQueryCache<number>({ ttlMs: 10_000, now: () => 0 })
    const fetcher = vi.fn(async () => 1)
    await cache.fetch('k', fetcher)
    await cache.fetch('k', fetcher, { force: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('stale-while-revalidate returns cached data immediately and refreshes', async () => {
    let clock = 0
    const cache = createQueryCache<number>({ ttlMs: 100, now: () => clock })
    let value = 1
    const fetcher = vi.fn(async () => value)

    expect(await cache.fetch('k', fetcher)).toBe(1)
    clock = 500 // now stale
    value = 2

    // SWR returns the STALE value synchronously-ish (the resolved cached data)...
    const swr = await cache.fetch('k', fetcher, { staleWhileRevalidate: true })
    expect(swr).toBe(1)
    // ...and a background refresh updates the entry.
    await flush()
    expect(cache.get('k')!.data).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('records error state and rejects, without caching the failure as data', async () => {
    const cache = createQueryCache<number>()
    const fetcher = vi.fn(async () => {
      throw new Error('nope')
    })
    await expect(cache.fetch('k', fetcher)).rejects.toThrow('nope')
    const e = cache.get('k')!
    expect(e.status).toBe('error')
    expect((e.error as Error).message).toBe('nope')
    expect(e.data).toBeUndefined()
  })

  it('notifies subscribers on state transitions', async () => {
    const cache = createQueryCache<number>()
    const seen: string[] = []
    cache.subscribe('k', (e) => seen.push(e.status))
    await cache.fetch('k', async () => 5)
    expect(seen).toContain('loading')
    expect(seen[seen.length - 1]).toBe('success')
  })

  it('unsubscribe stops notifications', async () => {
    const cache = createQueryCache<number>()
    const cb = vi.fn()
    const off = cache.subscribe('k', cb)
    off()
    await cache.fetch('k', async () => 5)
    expect(cb).not.toHaveBeenCalled()
  })

  it('set() seeds a fresh entry that satisfies the cache', async () => {
    const cache = createQueryCache<number>({ ttlMs: 10_000, now: () => 0 })
    cache.set('k', 99)
    const fetcher = vi.fn(async () => 1)
    expect(await cache.fetch('k', fetcher)).toBe(99)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('invalidate() forces the next fetch to refetch but keeps data', async () => {
    const cache = createQueryCache<number>({ ttlMs: 10_000, now: () => 0 })
    await cache.fetch('k', async () => 1)
    cache.invalidate('k')
    expect(cache.get('k')!.data).toBe(1) // data retained
    const fetcher = vi.fn(async () => 2)
    expect(await cache.fetch('k', fetcher)).toBe(2)
  })

  it('remove() orphans an in-flight settle so it never repopulates the cache', async () => {
    const cache = createQueryCache<number>()
    let resolve!: (v: number) => void
    const p = cache.fetch('k', () => new Promise<number>((r) => (resolve = r)))
    cache.remove('k')
    resolve(1)
    await p.catch(() => {})
    await flush()
    expect(cache.get('k')).toBeUndefined()
  })
})
