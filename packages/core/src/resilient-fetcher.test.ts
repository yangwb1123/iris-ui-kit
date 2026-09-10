import { describe, it, expect, vi } from 'vitest'
import { createResilientFetcher, RateLimitExceededError } from './resilient-fetcher'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('createResilientFetcher', () => {
  it('caches and de-duplicates like the underlying query-cache', async () => {
    let clock = 0
    const rf = createResilientFetcher<number>({ ttlMs: 1000, now: () => clock })
    const fetcher = vi.fn(async () => 42)
    expect(await rf.fetch('k', fetcher)).toBe(42)
    clock = 500
    expect(await rf.fetch('k', fetcher)).toBe(42) // fresh → cached
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does NOT spend a rate-limit token on a cache hit', async () => {
    const clock = 0
    const rf = createResilientFetcher<number>({
      ttlMs: 10_000,
      rateLimit: { capacity: 1, refillTokens: 1, intervalMs: 1000 },
      now: () => clock,
    })
    const fetcher = vi.fn(async () => 1)
    await rf.fetch('k', fetcher) // spends the only token
    // Repeated cached reads must not require more tokens.
    await rf.fetch('k', fetcher)
    await rf.fetch('k', fetcher)
    expect(rf.limiter!.available()).toBe(0) // spent exactly once
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects with RateLimitExceededError when the bucket is empty on a miss', async () => {
    const clock = 0
    const rf = createResilientFetcher<number>({
      rateLimit: { capacity: 1, refillTokens: 1, intervalMs: 1000 },
      now: () => clock,
    })
    await rf.fetch('a', async () => 1) // spends the token
    await expect(rf.fetch('b', async () => 2)).rejects.toBeInstanceOf(RateLimitExceededError)
  })

  it('opens the circuit after repeated failures and then fast-fails', async () => {
    const clock = 0
    const rf = createResilientFetcher<number>({
      breaker: { failureThreshold: 2, resetMs: 1000 },
      now: () => clock,
    })
    const failing = vi.fn(async () => {
      throw new Error('down')
    })
    await expect(rf.fetch('k', failing)).rejects.toThrow('down')
    await expect(rf.fetch('k', failing)).rejects.toThrow('down') // 2nd failure → opens
    expect(rf.breaker!.state).toBe('open')
    const callsBefore = failing.mock.calls.length
    // Now open: a fresh key fast-fails WITHOUT calling the fetcher.
    await expect(rf.fetch('other', failing)).rejects.toThrow()
    expect(failing.mock.calls.length).toBe(callsBefore) // fetcher not invoked while open
  })

  it('recovers via half-open after resetMs', async () => {
    let clock = 0
    let healthy = false
    const rf = createResilientFetcher<number>({
      breaker: { failureThreshold: 1, resetMs: 500 },
      now: () => clock,
    })
    const fetcher = vi.fn(async () => {
      if (!healthy) throw new Error('down')
      return 7
    })
    await expect(rf.fetch('k', fetcher)).rejects.toThrow('down') // opens
    expect(rf.breaker!.state).toBe('open')
    clock = 600 // past resetMs
    healthy = true
    expect(await rf.fetch('k2', fetcher)).toBe(7) // half-open trial succeeds → closed
    expect(rf.breaker!.state).toBe('closed')
  })

  it('allows only one concurrent half-open trial across cache keys', async () => {
    let clock = 0
    const rf = createResilientFetcher<number>({
      breaker: { failureThreshold: 1, resetMs: 100 },
      now: () => clock,
    })
    await expect(
      rf.fetch('failed', async () => {
        throw new Error('down')
      }),
    ).rejects.toThrow('down')

    clock = 100
    let resolveTrial!: (value: number) => void
    const trialFetcher = vi.fn(() => new Promise<number>((resolve) => (resolveTrial = resolve)))
    const trial = rf.fetch('trial', trialFetcher)
    const concurrent = rf.fetch('concurrent', async () => 2)

    await expect(concurrent).rejects.toThrow('Circuit breaker is open')
    expect(trialFetcher).toHaveBeenCalledTimes(1)
    resolveTrial(1)
    await expect(trial).resolves.toBe(1)
    expect(rf.breaker!.state).toBe('closed')
  })

  it('exposes the cache for invalidation', async () => {
    const clock = 0
    const rf = createResilientFetcher<number>({ ttlMs: 10_000, now: () => clock })
    let value = 1
    const fetcher = vi.fn(async () => value)
    expect(await rf.fetch('k', fetcher)).toBe(1)
    value = 2
    rf.cache.invalidate('k')
    expect(await rf.fetch('k', fetcher)).toBe(2)
  })

  it('forwards maxEntries so the cache evicts the least recently used entry', async () => {
    const rf = createResilientFetcher<number>({ ttlMs: 10_000, maxEntries: 2, breaker: false })
    const fetcher = vi.fn(async (key: string) => ({ a: 1, b: 2, c: 3 })[key]!)

    expect(await rf.fetch('a', fetcher)).toBe(1)
    expect(await rf.fetch('b', fetcher)).toBe(2)
    expect(await rf.fetch('a', fetcher)).toBe(1) // cached hit refreshes recency
    expect(await rf.fetch('c', fetcher)).toBe(3)

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(rf.cache.get('b')).toBeUndefined()
    expect(rf.cache.get('a')?.data).toBe(1)
    expect(rf.cache.get('c')?.data).toBe(3)
  })

  it('keeps default and invalid maxEntries values compatible with the unbounded cache default', async () => {
    for (const maxEntries of [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const rf = createResilientFetcher<number>(
        maxEntries === undefined
          ? { ttlMs: 10_000, breaker: false }
          : { ttlMs: 10_000, maxEntries, breaker: false },
      )
      await rf.fetch('a', async () => 1)
      await rf.fetch('b', async () => 2)
      expect(rf.cache.get('a')?.data).toBe(1)
      expect(rf.cache.get('b')?.data).toBe(2)
    }
  })

  it('breaker can be disabled', async () => {
    const rf = createResilientFetcher<number>({ breaker: false })
    expect(rf.breaker).toBeUndefined()
    const failing = async () => {
      throw new Error('down')
    }
    // Without a breaker, every call reaches the fetcher (no fast-fail).
    await expect(rf.fetch('k', failing)).rejects.toThrow('down')
    await expect(rf.fetch('k', failing)).rejects.toThrow('down')
  })

  it('stale-while-revalidate is threaded through', async () => {
    let clock = 0
    const rf = createResilientFetcher<number>({ ttlMs: 100, now: () => clock })
    let value = 1
    const fetcher = vi.fn(async () => value)
    expect(await rf.fetch('k', fetcher)).toBe(1)
    clock = 500
    value = 2
    expect(await rf.fetch('k', fetcher, { staleWhileRevalidate: true })).toBe(1) // stale served
    await flush()
    expect(rf.cache.get('k')!.data).toBe(2) // refreshed in background
  })

  it('supports an opt-in factory SWR default without changing default-off behavior', async () => {
    let clock = 0
    const rf = createResilientFetcher<number>({
      ttlMs: 100,
      staleWhileRevalidate: true,
      breaker: false,
      now: () => clock,
    })
    let value = 1
    const fetcher = vi.fn(async () => value)
    await rf.fetch('k', fetcher)
    clock = 500
    value = 2
    expect(await rf.fetch('k', fetcher)).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await flush()
    expect(rf.cache.get('k')?.data).toBe(2)

    clock = 1000
    value = 3
    expect(await rf.fetch('k', fetcher, { staleWhileRevalidate: false })).toBe(3)
  })
})
