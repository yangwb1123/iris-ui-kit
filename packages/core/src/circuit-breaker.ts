/**
 * Framework-agnostic circuit breaker for async operations. Wraps a fetch/call
 * with the classic `closed → open → half-open` resilience state machine so a
 * flaky or down dependency fails fast (rejecting immediately while open)
 * instead of every caller piling more doomed requests onto it, then probes for
 * recovery with a single trial after a cooldown. Pairs with `createAsyncResource`
 * / retry helpers as the next layer of data hardening. DOM-free and clock-
 * injectable so its timing is fully deterministic under test.
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

/** Rejection produced by `run` while the breaker is open (fn is not invoked). */
export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message)
    this.name = 'CircuitOpenError'
    // Restore the prototype chain when down-compiled below ES2015 so that
    // `instanceof CircuitOpenError` keeps working.
    Object.setPrototypeOf(this, CircuitOpenError.prototype)
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip closed → open. Default 5. */
  failureThreshold?: number
  /** ms the breaker stays open before allowing a half-open trial. Default 30_000. */
  resetMs?: number
  /** Clock in ms; injectable for tests. Defaults to Date.now. */
  now?: () => number
  /** Which errors count as failures. Default: all. */
  isFailure?: (err: unknown) => boolean
}

export interface CircuitBreaker {
  readonly state: CircuitState
  /** Run fn through the breaker. Rejects with CircuitOpenError immediately while
   *  open (before the reset window elapses). */
  run<T>(fn: () => Promise<T>): Promise<T>
  /** Observe state transitions; returns unsubscribe. */
  subscribe(listener: (state: CircuitState) => void): () => void
  /** Force back to closed and clear the failure count. */
  reset(): void
}

export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 5
  const resetMs = options.resetMs ?? 30_000
  const now = options.now ?? Date.now
  const isFailure = options.isFailure ?? (() => true)

  let state: CircuitState = 'closed'
  // Consecutive failures while closed; irrelevant in open/half-open.
  let failures = 0
  // Timestamp (per `now`) of the transition into `open`; the reset window is
  // measured from here.
  let openedAt = 0
  const listeners = new Set<(state: CircuitState) => void>()

  const emit = (): void => {
    for (const listener of listeners) listener(state)
  }

  const set = (next: CircuitState): void => {
    if (state === next) return
    state = next
    emit()
  }

  const trip = (): void => {
    openedAt = now()
    set('open')
  }

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (state === 'open') {
      if (now() - openedAt < resetMs) {
        // Still cooling down: fail fast without touching the dependency.
        throw new CircuitOpenError()
      }
      // Cooldown elapsed — spend the next call as a single half-open trial.
      set('half-open')
    }

    try {
      const result = await fn()
      // Success clears the failure streak; a half-open trial closes the breaker.
      failures = 0
      if (state === 'half-open') set('closed')
      return result
    } catch (err) {
      if (isFailure(err)) {
        if (state === 'half-open') {
          // A failed trial re-opens and restarts the cooldown.
          trip()
        } else {
          failures += 1
          if (failures >= failureThreshold) trip()
        }
      }
      // Non-failure errors propagate untouched and never count toward the trip.
      throw err
    }
  }

  return {
    get state() {
      return state
    },
    run,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    reset() {
      failures = 0
      openedAt = 0
      state = 'closed'
      // reset() always announces the closed state, even if already closed.
      emit()
    },
  }
}
