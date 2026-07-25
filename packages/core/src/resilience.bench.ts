import { bench, describe } from 'vitest'
import { createQueryCache } from './query-cache'
import { createCircuitBreaker } from './circuit-breaker'
import { createRateLimiter } from './rate-limiter'
import { createResilientFetcher } from './resilient-fetcher'
import { createOutbox } from './outbox'

/**
 * Throughput benches for the data resilience layer. These validate that the
 * resilience primitives add negligible overhead at scale — cache hits are ~0,
 * breaker state checks are O(1), and the rate limiter's token bucket is a
 * constant-time decrement. Run with `pnpm bench`.
 */

describe('createQueryCache @10k', () => {
  const data = new Array(10_000).fill(null).map((_, i) => ({ id: i, value: `v-${i}` }))

  bench('10k unique fetches (no cache hits)', async () => {
    const cache = createQueryCache<{ id: number; value: string }>({ ttlMs: 60_000 })
    let calls = 0
    const fetcher = async (k: string) => {
      calls++
      return data[Number(k)]!
    }
    for (let i = 0; i < 10_000; i++) {
      await cache.fetch(String(i), fetcher)
    }
  })

  bench('10k repeated fetches (all cache hits)', async () => {
    const cache = createQueryCache<{ id: number; value: string }>({ ttlMs: 60_000 })
    // Prime the cache with one entry
    await cache.fetch('0', async () => data[0]!)
    for (let i = 0; i < 10_000; i++) {
      await cache.fetch('0', async () => data[0]!)
    }
  })
})

describe('createCircuitBreaker', () => {
  bench('10k state checks (no-op while closed)', async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 100, resetMs: 10_000 })
    for (let i = 0; i < 10_000; i++) {
      await breaker.run(async () => 'ok')
    }
  })
})

describe('createRateLimiter', () => {
  bench('10k tryRemove (all succeed with large capacity)', () => {
    const limiter = createRateLimiter({ capacity: 100_000, refillTokens: 100, intervalMs: 1000 })
    for (let i = 0; i < 10_000; i++) {
      limiter.tryRemove()
    }
  })
})

describe('createResilientFetcher', () => {
  bench('10k cache hit (resilient path)', async () => {
    const rf = createResilientFetcher<{ ok: boolean }>({ ttlMs: 60_000 })
    await rf.fetch('key', async () => ({ ok: true }))
    for (let i = 0; i < 10_000; i++) {
      await rf.fetch('key', async () => ({ ok: true }))
    }
  })
})

describe('createOutbox', () => {
  bench('10k enqueue (all succeed immediately)', async () => {
    const outbox = createOutbox<{ id: number }>({
      execute: async () => {},
      maxAttempts: 1,
    })
    for (let i = 0; i < 10_000; i++) {
      outbox.enqueue({ id: i })
    }
    await outbox.flush()
  })
})
