import { describe, it, expect } from 'vitest'
import { createRateLimiter } from './rate-limiter'

describe('createRateLimiter', () => {
  it('allows up to capacity then denies (burst)', () => {
    const clock = 0
    const rl = createRateLimiter({
      capacity: 3,
      refillTokens: 1,
      intervalMs: 100,
      now: () => clock,
    })
    expect(rl.tryRemove()).toBe(true)
    expect(rl.tryRemove()).toBe(true)
    expect(rl.tryRemove()).toBe(true)
    expect(rl.tryRemove()).toBe(false) // bucket empty
  })

  it('refills at the configured rate over time', () => {
    let clock = 0
    const rl = createRateLimiter({
      capacity: 2,
      refillTokens: 1,
      intervalMs: 100,
      now: () => clock,
    })
    rl.tryRemove()
    rl.tryRemove()
    expect(rl.tryRemove()).toBe(false)
    clock = 100 // one interval → one token
    expect(rl.tryRemove()).toBe(true)
    expect(rl.tryRemove()).toBe(false)
  })

  it('caps refill at capacity (no unbounded accumulation)', () => {
    let clock = 0
    const rl = createRateLimiter({
      capacity: 5,
      refillTokens: 5,
      intervalMs: 100,
      now: () => clock,
    })
    rl.tryRemove(5) // empty it
    clock = 10_000 // way more than enough to overfill
    expect(rl.available()).toBe(5) // capped, not 500
  })

  it('a denied request spends nothing', () => {
    const clock = 0
    const rl = createRateLimiter({
      capacity: 2,
      refillTokens: 1,
      intervalMs: 100,
      now: () => clock,
    })
    expect(rl.tryRemove(5)).toBe(false) // wants 5, has 2
    expect(rl.available()).toBe(2) // untouched
    expect(rl.tryRemove(2)).toBe(true) // still spendable
  })

  it('timeUntil reports the wait for the next token', () => {
    let clock = 0
    const rl = createRateLimiter({
      capacity: 1,
      refillTokens: 1,
      intervalMs: 200,
      now: () => clock,
    })
    expect(rl.timeUntil()).toBe(0) // starts full
    rl.tryRemove()
    expect(rl.timeUntil()).toBe(200) // one full interval for one token
    clock = 100
    expect(rl.timeUntil()).toBe(100) // half refilled
  })

  it('supports multi-token spends', () => {
    const clock = 0
    const rl = createRateLimiter({
      capacity: 10,
      refillTokens: 1,
      intervalMs: 100,
      now: () => clock,
    })
    expect(rl.tryRemove(4)).toBe(true)
    expect(rl.tryRemove(6)).toBe(true)
    expect(rl.tryRemove(1)).toBe(false)
  })

  it('reset refills to capacity', () => {
    const clock = 0
    const rl = createRateLimiter({
      capacity: 3,
      refillTokens: 1,
      intervalMs: 100,
      now: () => clock,
    })
    rl.tryRemove(3)
    expect(rl.available()).toBe(0)
    rl.reset()
    expect(rl.available()).toBe(3)
  })

  it('honors initialTokens', () => {
    const clock = 0
    const rl = createRateLimiter({
      capacity: 5,
      refillTokens: 1,
      intervalMs: 100,
      initialTokens: 1,
      now: () => clock,
    })
    expect(rl.tryRemove()).toBe(true)
    expect(rl.tryRemove()).toBe(false) // only started with 1
  })

  it('rejects invalid options', () => {
    expect(() => createRateLimiter({ capacity: 0, refillTokens: 1, intervalMs: 100 })).toThrow()
    expect(() => createRateLimiter({ capacity: 1, refillTokens: 0, intervalMs: 100 })).toThrow()
    expect(() => createRateLimiter({ capacity: 1, refillTokens: 1, intervalMs: 0 })).toThrow()
  })
})
