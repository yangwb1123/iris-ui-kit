import { describe, expect, it, vi } from 'vitest'
import { createCircuitBreaker, CircuitOpenError } from './circuit-breaker'

/** Always-rejecting fn, so a `run` counts as a failure by default. */
const boom = () => Promise.reject(new Error('boom'))
/** Always-resolving fn. */
const ok = () => Promise.resolve('ok')

describe('createCircuitBreaker', () => {
  it('starts closed and passes calls through to fn', async () => {
    const breaker = createCircuitBreaker()
    expect(breaker.state).toBe('closed')
    await expect(breaker.run(ok)).resolves.toBe('ok')
    expect(breaker.state).toBe('closed')
  })

  // Point 1: CLOSED — failures increment, a success resets, threshold trips open.
  it('trips closed → open after failureThreshold consecutive failures', async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3 })

    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('closed')
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('closed')

    // Third consecutive failure reaches the threshold and opens the breaker.
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('open')
  })

  it('a success resets the consecutive-failure counter (no trip)', async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3 })
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    // Success clears the streak...
    await expect(breaker.run(ok)).resolves.toBe('ok')
    // ...so two further failures still don't reach the threshold of 3.
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('closed')
  })

  // Point 2: OPEN — rejects immediately with CircuitOpenError, without calling fn.
  it('rejects immediately with CircuitOpenError while open, never calling fn', async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1, resetMs: 1000, now: () => 0 })
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('open')

    const fn = vi.fn(ok)
    await expect(breaker.run(fn)).rejects.toBeInstanceOf(CircuitOpenError)
    expect(fn).not.toHaveBeenCalled()
    expect(breaker.state).toBe('open')
  })

  // Point 2: OPEN → HALF-OPEN once now() - openedAt >= resetMs.
  it('moves open → half-open on the next run once resetMs has elapsed', async () => {
    let clock = 0
    const breaker = createCircuitBreaker({ failureThreshold: 1, resetMs: 1000, now: () => clock })
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('open')

    // Just before the window elapses: still open, still fails fast.
    clock = 999
    await expect(breaker.run(ok)).rejects.toBeInstanceOf(CircuitOpenError)
    expect(breaker.state).toBe('open')

    // At exactly resetMs the next run is admitted as a half-open trial.
    clock = 1000
    const seen: string[] = []
    const fn = vi.fn(() => {
      seen.push(breaker.state)
      return Promise.resolve('trial')
    })
    await expect(breaker.run(fn)).resolves.toBe('trial')
    expect(fn).toHaveBeenCalledTimes(1)
    // fn was invoked while the breaker was in the half-open trial.
    expect(seen).toEqual(['half-open'])
  })

  // Point 3: HALF-OPEN success → CLOSED.
  it('half-open trial success closes the breaker and clears failures', async () => {
    let clock = 0
    const breaker = createCircuitBreaker({ failureThreshold: 1, resetMs: 1000, now: () => clock })
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    clock = 1000
    await expect(breaker.run(ok)).resolves.toBe('ok')
    expect(breaker.state).toBe('closed')
    // Counter cleared: a single failure would need to re-reach the threshold.
    await expect(breaker.run(ok)).resolves.toBe('ok')
    expect(breaker.state).toBe('closed')
  })

  // Point 3: HALF-OPEN failure → OPEN, and the cooldown timer restarts.
  it('half-open trial failure re-opens and restarts the reset window', async () => {
    let clock = 0
    const breaker = createCircuitBreaker({ failureThreshold: 1, resetMs: 1000, now: () => clock })
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('open')

    // Elapse the window, then fail the trial → back to open.
    clock = 1000
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('open')

    // Timer restarted from clock=1000, so at 1500 it still fails fast...
    clock = 1500
    await expect(breaker.run(ok)).rejects.toBeInstanceOf(CircuitOpenError)
    // ...and only reopens for a trial once a fresh resetMs has passed.
    clock = 2000
    await expect(breaker.run(ok)).resolves.toBe('ok')
    expect(breaker.state).toBe('closed')
  })

  // Point 4: subscribe fires on every transition; reset forces closed + notifies.
  it('subscribe fires on every state change and unsubscribe stops it', async () => {
    let clock = 0
    const breaker = createCircuitBreaker({ failureThreshold: 1, resetMs: 1000, now: () => clock })
    const seen: string[] = []
    const unsubscribe = breaker.subscribe((s) => seen.push(s))

    await expect(breaker.run(boom)).rejects.toThrow('boom') // closed → open
    clock = 1000
    await expect(breaker.run(ok)).resolves.toBe('ok') // open → half-open → closed
    expect(seen).toEqual(['open', 'half-open', 'closed'])

    unsubscribe()
    await expect(breaker.run(boom)).rejects.toThrow('boom') // closed → open, not observed
    expect(seen).toEqual(['open', 'half-open', 'closed'])
  })

  it('reset forces the breaker back to closed, clears the count, and notifies', async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1 })
    const seen: string[] = []
    breaker.subscribe((s) => seen.push(s))

    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('open')

    breaker.reset()
    expect(breaker.state).toBe('closed')
    expect(seen).toEqual(['open', 'closed'])

    // Count was cleared: fn runs again immediately (breaker is closed).
    await expect(breaker.run(ok)).resolves.toBe('ok')
    expect(breaker.state).toBe('closed')
  })

  // Point 5: a non-failure error propagates but does NOT count toward the trip.
  it('non-failure errors propagate without counting toward the threshold', async () => {
    const ignorable = new Error('ignore-me')
    const breaker = createCircuitBreaker({
      failureThreshold: 2,
      isFailure: (err) => err !== ignorable,
    })

    const throwIgnorable = () => Promise.reject(ignorable)
    // Many non-failure errors: propagate, but the breaker stays closed.
    await expect(breaker.run(throwIgnorable)).rejects.toBe(ignorable)
    await expect(breaker.run(throwIgnorable)).rejects.toBe(ignorable)
    await expect(breaker.run(throwIgnorable)).rejects.toBe(ignorable)
    expect(breaker.state).toBe('closed')

    // Real failures still count and trip on the threshold.
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('closed')
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    expect(breaker.state).toBe('open')
  })

  it('a non-failure error during a half-open trial keeps it half-open', async () => {
    const ignorable = new Error('ignore-me')
    let clock = 0
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      resetMs: 1000,
      now: () => clock,
      isFailure: (err) => err !== ignorable,
    })
    await expect(breaker.run(boom)).rejects.toThrow('boom')
    clock = 1000
    // Trial rejects with a non-failure error: it neither closes nor re-opens.
    await expect(breaker.run(() => Promise.reject(ignorable))).rejects.toBe(ignorable)
    expect(breaker.state).toBe('half-open')
  })
})
