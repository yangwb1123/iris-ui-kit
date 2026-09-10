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

  it('set() orphans an in-flight settle so it cannot overwrite seeded data', async () => {
    const cache = createQueryCache<number>({ ttlMs: 10_000, now: () => 0 })
    let resolve!: (v: number) => void
    const p = cache.fetch('k', () => new Promise<number>((r) => (resolve = r)))
    cache.set('k', 99)
    resolve(1)
    expect(await p).toBe(1)
    await flush()
    expect(cache.get('k')!.data).toBe(99)
    expect(
      await cache.fetch(
        'k',
        vi.fn(async () => 2),
      ),
    ).toBe(99)
  })

  it('invalidate() orphans an in-flight settle and allows a fresh request', async () => {
    const cache = createQueryCache<number>()
    let resolveOld!: (v: number) => void
    const old = cache.fetch('k', () => new Promise<number>((r) => (resolveOld = r)))
    cache.invalidate('k')
    let resolveFresh!: (v: number) => void
    const fresh = cache.fetch('k', () => new Promise<number>((r) => (resolveFresh = r)))
    expect(old).not.toBe(fresh)
    resolveOld(1)
    expect(await old).toBe(1)
    resolveFresh(2)
    expect(await fresh).toBe(2)
    expect(cache.get('k')!.data).toBe(2)
  })

  it('invalidateAll() orphans every in-flight settle', async () => {
    const cache = createQueryCache<number>()
    let resolveA!: (v: number) => void
    let resolveB!: (v: number) => void
    const a = cache.fetch('a', () => new Promise<number>((r) => (resolveA = r)))
    const b = cache.fetch('b', () => new Promise<number>((r) => (resolveB = r)))
    cache.invalidateAll()
    resolveA(1)
    resolveB(2)
    await expect(a).resolves.toBe(1)
    await expect(b).resolves.toBe(2)
    await flush()
    expect(cache.get('a')!.data).toBeUndefined()
    expect(cache.get('b')!.data).toBeUndefined()
  })

  it('installs the generation before a reentrant set, so the late result cannot overwrite it', async () => {
    const cache = createQueryCache<number>({ ttlMs: 10_000, now: () => 0 })
    let resolveOriginal!: (value: number) => void
    const original = cache.fetch('k', () => {
      cache.set('k', 99)
      return new Promise<number>((resolve) => (resolveOriginal = resolve))
    })

    resolveOriginal(1)
    expect(await original).toBe(1)
    await flush()
    expect(cache.get('k')).toMatchObject({ data: 99, status: 'success', isFetching: false })
  })

  it('allows a reentrant invalidate/fetch to replace the current generation', async () => {
    const cache = createQueryCache<number>({ ttlMs: 0, now: () => 0 })
    let resolveOriginal!: (value: number) => void
    let replacement!: Promise<number>
    const original = cache.fetch('k', () => {
      cache.invalidate('k')
      replacement = cache.fetch('k', async () => 2)
      return new Promise<number>((resolve) => (resolveOriginal = resolve))
    })

    expect(replacement).not.toBe(original)
    expect(await replacement).toBe(2)
    resolveOriginal(1)
    expect(await original).toBe(1)
    expect(cache.get('k')).toMatchObject({ data: 2, status: 'success', isFetching: false })
  })

  it('shares the installed promise when a fetcher calls fetch re-entrantly', async () => {
    const cache = createQueryCache<number>()
    let nested!: Promise<number>
    const fetcher = vi.fn(async () => 7)
    const original = cache.fetch('k', () => {
      nested = cache.fetch('k', fetcher)
      return Promise.resolve(7)
    })

    expect(nested).toBe(original)
    expect(await original).toBe(7)
    expect(fetcher).not.toHaveBeenCalled()
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

  it('evicts the least recently used entry and updates recency on use and mutation', () => {
    const cache = createQueryCache<number>({ maxEntries: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')!.data).toBe(1) // a becomes most recently used

    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')!.data).toBe(1)
    expect(cache.get('c')!.data).toBe(3)

    cache.invalidate('a') // invalidation is a mutation and refreshes recency
    cache.set('d', 4)
    expect(cache.get('c')).toBeUndefined()
    expect(cache.get('a')!.data).toBe(1)
    expect(cache.get('d')!.data).toBe(4)
  })

  it('orphans an evicted in-flight generation from a recreated key', async () => {
    const cache = createQueryCache<number>({ maxEntries: 1 })
    let resolveOld!: (value: number) => void
    const old = cache.fetch('a', () => new Promise<number>((resolve) => (resolveOld = resolve)))

    cache.set('b', 2) // evicts a while its request is still pending
    expect(cache.get('a')).toBeUndefined()

    let resolveFresh!: (value: number) => void
    const fresh = cache.fetch('a', () => new Promise<number>((resolve) => (resolveFresh = resolve)))
    resolveOld(1)
    expect(await old).toBe(1)
    await flush()
    expect(cache.get('a')!.data).toBeUndefined()

    resolveFresh(3)
    expect(await fresh).toBe(3)
    expect(cache.get('a')!.data).toBe(3)
  })

  it('keeps default and non-finite capacities unbounded, while normalizing finite values', () => {
    for (const maxEntries of [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const cache = createQueryCache<number>(maxEntries === undefined ? {} : { maxEntries })
      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.get('a')!.data).toBe(1)
      expect(cache.get('b')!.data).toBe(2)
    }

    const fractional = createQueryCache<number>({ maxEntries: 1.9 })
    fractional.set('a', 1)
    fractional.set('b', 2)
    expect(fractional.get('a')).toBeUndefined()
    expect(fractional.get('b')!.data).toBe(2)

    const disabled = createQueryCache<number>({ maxEntries: 0 })
    disabled.set('a', 1)
    expect(disabled.get('a')).toBeUndefined()
  })

  it('keeps zero-capacity caches de-duplicating in-flight requests while retaining nothing', async () => {
    const cache = createQueryCache<number>({ maxEntries: 0 })
    let resolve!: (value: number) => void
    const fetcher = vi.fn(() => new Promise<number>((r) => (resolve = r)))

    const first = cache.fetch('k', fetcher)
    const second = cache.fetch('k', fetcher)
    expect(first).toBe(second)
    expect(fetcher).toHaveBeenCalledTimes(1)

    resolve(7)
    await expect(first).resolves.toBe(7)
    expect(cache.get('k')).toBeUndefined()
  })

  it('does not retain set data when it replaces a zero-capacity in-flight entry', async () => {
    const cache = createQueryCache<number>({ maxEntries: 0 })
    let resolve!: (value: number) => void
    const pending = cache.fetch('k', () => new Promise<number>((r) => (resolve = r)))

    cache.set('k', 99)
    expect(cache.get('k')).toBeUndefined()

    resolve(1)
    await expect(pending).resolves.toBe(1)
    expect(cache.get('k')).toBeUndefined()
  })

  it('does not retain an orphaned zero-capacity entry after invalidate', async () => {
    const cache = createQueryCache<number>({ maxEntries: 0 })
    let resolve!: (value: number) => void
    const pending = cache.fetch('k', () => new Promise<number>((r) => (resolve = r)))

    cache.invalidate('k')
    expect(cache.get('k')).toBeUndefined()

    resolve(1)
    await expect(pending).resolves.toBe(1)
    expect(cache.get('k')).toBeUndefined()
  })
})
