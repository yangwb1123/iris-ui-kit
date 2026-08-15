/**
 * `@iris-ui-kit/core/perf-stats` — a latest-snapshot render-performance
 * controller. Framework-agnostic, no side-effects or timers. A single
 * factory (`createPerfStats`) holds the LATEST `PerfSample` and notifies
 * subscribers when a new sample lands (the `subscribe(cb)` +
 * `getVersion()` pair any store bridge expects — `useSyncExternalStore` /
 * `ref` + subscription / `createSignal` / `toStore`).
 *
 * The IrisTable integration (batch BL, react) samples ONCE per render
 * commit: a render-top `nowMs()` mark + a dependency-less
 * `useLayoutEffect` that pushes `{ durationMs, rows, columns, changes }`
 * after every commit (duration = render + layout phase, excludes paint —
 * documented). The push notifies only the floating perf panel (a separate
 * portal root) — the table never re-renders from its own measurement
 * (vs. setState-in-effect which would busy-loop; AuditPanel precedent).
 * `nowMs()` is `performance.now()` with a `Date.now()` fallback for
 * engines without `performance` (old SSR / exotic jsdom).
 *
 * Off the core path (`@iris-ui-kit/core/perf-stats` — own subpath).
 */

/** One render-commit sample. */
export interface PerfSample {
  /** Render + layout phase duration in ms (excludes paint — documented). */
  durationMs: number
  /** Rows rendered by the sampled commit. */
  rows: number
  /** Leaf columns rendered by the sampled commit. */
  columns: number
  /** Audit-trail depth at the sampled commit (0 when `auditLog` is off). */
  changes: number
}

export interface PerfStats {
  /**
   * Latest sample — a COPY (mutating it is safe). `null` before the first
   * push. Note: for `useSyncExternalStore` use `getVersion()` as the
   * snapshot (the AuditPanel pattern); `latest()` is a fresh copy per call.
   */
  latest(): PerfSample | null

  /** Replace the latest sample. Notifies subscribers. */
  push(sample: PerfSample): PerfSample

  /** Subscribe to sample pushes. Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void

  /** Monotonic change counter — the `getSnapshot` for `useSyncExternalStore`. */
  getVersion(): number
}

export function createPerfStats(): PerfStats {
  let sample: PerfSample | null = null
  let version = 0
  const listeners = new Set<() => void>()

  const emit = (): void => {
    version += 1
    for (const cb of listeners) cb()
  }

  return {
    latest() {
      return sample ? { ...sample } : null
    },
    push(next) {
      sample = { ...next }
      emit()
      return { ...sample }
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    getVersion() {
      return version
    },
  }
}

/**
 * High-resolution clock with a `Date.now()` fallback for engines without
 * `performance` (old SSR runtimes / exotic jsdom) — never throws.
 */
export function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}
