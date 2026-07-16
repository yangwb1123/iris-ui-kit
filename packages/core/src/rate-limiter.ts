/**
 * `@iris-ui/core` rate limiter — a token-bucket limiter for throttling actions.
 * The command registry (`createCommandRegistry.run`) and the LLM planner execute
 * with no rate limiting, so an agent/automation loop can fire commands without
 * bound. This is the missing throttle: a bucket refills at a steady rate up to a
 * capacity, and each action spends a token; when the bucket is empty the action
 * is refused (or, via `remove`, you can inspect the wait time and defer it).
 *
 * Pure and DOM-free with an injectable clock, so it is deterministic in tests
 * and reusable for any "N actions per interval" need (command execution, API
 * calls, autosave, retry storms).
 */

export interface RateLimiterOptions {
  /** Maximum tokens the bucket holds (burst size). */
  capacity: number
  /** Tokens added per `intervalMs`. Combined with `intervalMs` this is the
   *  sustained rate. */
  refillTokens: number
  /** Refill period in ms. */
  intervalMs: number
  /** Starting token count. Default `capacity` (starts full). */
  initialTokens?: number
  /** Injectable clock in ms. Defaults to `Date.now`. */
  now?: () => number
}

export interface RateLimiter {
  /** Spend `count` tokens if available; returns `true` on success (allowed),
   *  `false` if there aren't enough (denied — nothing is spent). */
  tryRemove(count?: number): boolean
  /** Current available tokens (after refill up to now). */
  available(): number
  /** ms until at least `count` tokens are available (0 if already available). */
  timeUntil(count?: number): number
  /** Refill the bucket to capacity immediately. */
  reset(): void
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { capacity, refillTokens, intervalMs } = options
  if (capacity <= 0 || refillTokens <= 0 || intervalMs <= 0) {
    throw new Error('createRateLimiter: capacity, refillTokens and intervalMs must be > 0')
  }
  const now = options.now ?? Date.now
  const ratePerMs = refillTokens / intervalMs

  let tokens = Math.min(capacity, options.initialTokens ?? capacity)
  let last = now()

  const refill = (): void => {
    const t = now()
    const elapsed = t - last
    if (elapsed <= 0) return
    tokens = Math.min(capacity, tokens + elapsed * ratePerMs)
    last = t
  }

  return {
    tryRemove(count = 1) {
      refill()
      if (tokens + 1e-9 >= count) {
        tokens -= count
        return true
      }
      return false
    },
    available() {
      refill()
      return tokens
    },
    timeUntil(count = 1) {
      refill()
      if (tokens + 1e-9 >= count) return 0
      const deficit = count - tokens
      return Math.ceil(deficit / ratePerMs)
    },
    reset() {
      tokens = capacity
      last = now()
    },
  }
}
