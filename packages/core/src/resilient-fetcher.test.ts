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
})
