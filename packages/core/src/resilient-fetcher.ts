import { createQueryCache, type QueryCache, type QueryFetchOptions } from './query-cache'
import { createCircuitBreaker, type CircuitBreaker } from './circuit-breaker'
import { createRateLimiter, type RateLimiter } from './rate-limiter'

/**
 * `@iris-ui-kit/core` resilient fetcher — composes the query-cache, circuit-breaker,
 * and rate-limiter primitives into one hardened async fetcher. The individual
 * primitives are the building blocks; this is the one-call way to wrap a raw
 * fetcher with de-duplication + TTL/SWR caching, a failure circuit breaker, and
 * a token-bucket rate limit. Cache hits cost nothing — the breaker and limiter
 * only gate ACTUAL network fetches (cache misses), so repeated reads of fresh
 * data never spend a token or trip the breaker.
 *
 * Pure and DOM-free (like its constituent primitives); the injectable clock is
 * threaded through to all three so the whole stack is deterministic in tests.
 */

/** Thrown by a resilient fetch when the rate limit is exhausted. */
export class RateLimitExceededError extends Error {
  /** ms until a token is expected to be available. */
  readonly retryAfterMs: number
  constructor(retryAfterMs: number) {
    super(`rate limit exceeded; retry in ${retryAfterMs}ms`)
    this.name = 'RateLimitExceededError'
    this.retryAfterMs = retryAfterMs
  }
}

export interface ResilientFetcherOptions {
  /** Cache freshness window (ms). Default `0`. */
  ttlMs?: number
  /** Enable a token-bucket rate limit on actual fetches. */
  rateLimit?: { capacity: number; refillTokens: number; intervalMs: number }
  /** Circuit-breaker tuning. Enabled by default; pass `false` to disable. */
  breaker?: { failureThreshold?: number; resetMs?: number } | false
  /** Injectable clock (ms), threaded to cache/breaker/limiter. */
  now?: () => number
}

export interface ResilientFetcher<T> {
  /** Fetch `key`, honoring cache/SWR, the rate limit, and the circuit breaker. */
  fetch(key: string, fetcher: (key: string) => Promise<T>, options?: QueryFetchOptions): Promise<T>
  /** The underlying cache (get/set/invalidate/subscribe). */
  readonly cache: QueryCache<T>
  /** The circuit breaker (state/subscribe/reset), or `undefined` if disabled. */
  readonly breaker: CircuitBreaker | undefined
  /** The rate limiter (available/reset), or `undefined` if none configured. */
  readonly limiter: RateLimiter | undefined
}

export function createResilientFetcher<T>(
  options: ResilientFetcherOptions = {},
): ResilientFetcher<T> {
  const now = options.now
  const cache = createQueryCache<T>({ ttlMs: options.ttlMs, now })
  const breaker =
    options.breaker === false
      ? undefined
      : createCircuitBreaker({
          failureThreshold: options.breaker?.failureThreshold,
          resetMs: options.breaker?.resetMs,
          now,
        })
  const limiter = options.rateLimit ? createRateLimiter({ ...options.rateLimit, now }) : undefined

  return {
    cache,
    breaker,
    limiter,
    fetch(key, fetcher, fetchOptions) {
      // Gate + protect only on an ACTUAL fetch: run inside the cache's fetcher so
      // a cache hit (fresh, or the SWR-served stale value) spends no token and
      // never touches the breaker.
      return cache.fetch(
        key,
        async (k) => {
          if (limiter && !limiter.tryRemove()) {
            throw new RateLimitExceededError(limiter.timeUntil())
          }
          const run = () => fetcher(k)
          return breaker ? breaker.run(run) : run()
        },
        fetchOptions,
      )
    },
  }
}
