/**
 * `@iris-ui/core` disposable lifecycle — a framework-agnostic teardown
 * primitive. Controllers, stores, and effect-bridges accumulate resources that
 * must be released (debounce timers, `beforeunload`/`resize` listeners, store
 * subscriptions, module singletons). Today only a few controllers expose a
 * `destroy()`, so long-lived hosts (SPAs, HMR, the desktop shell) leak. This
 * module gives every one of them a uniform, idempotent teardown contract plus a
 * scope that owns children and releases them in reverse order — the foundation
 * an adapter can call from its own unmount hook (`useEffect` cleanup,
 * `onScopeDispose`, `onCleanup`, `$effect` teardown).
 *
 * Pure and DOM-agnostic (like the rest of core): it owns teardown callbacks,
 * timers, and child scopes. DOM-coupled cleanups belong to the adapters, which
 * register them as plain teardowns — e.g. `scope.add(() => el.removeEventListener(...))`.
 */

/** A zero-arg cleanup callback. */
export type Teardown = () => void

/** An object whose held resources can be released. `destroy()` is idempotent. */
export interface Disposable {
  /** Release all held resources. Safe (a no-op) to call more than once. */
  destroy(): void
  /** `true` once {@link destroy} has run. */
  readonly disposed: boolean
}

/** Anything a scope can own: a nested {@link Disposable} or a raw teardown fn. */
export type Disposeable = Disposable | Teardown

function isDisposable(value: Disposeable): value is Disposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Disposable).destroy === 'function'
  )
}

/**
 * A scope that owns child teardowns / {@link Disposable}s and releases them in
 * reverse (LIFO) registration order when {@link destroy} is called — the order
 * that safely unwinds resources acquired in sequence. Teardown errors are
 * isolated: one throwing child does not prevent the rest from running, and the
 * first error is re-thrown after all teardowns complete.
 */
export interface DisposableScope extends Disposable {
  /**
   * Register a teardown fn or child `Disposable`; returns it unchanged so it can
   * be assigned inline. If the scope is already destroyed, the child is torn
   * down immediately (so late registrations can't leak).
   */
  add<T extends Disposeable>(child: T): T
  /** Register a `setTimeout` id to `clearTimeout` on destroy. */
  addTimeout(id: ReturnType<typeof setTimeout>): void
  /** Register a `setInterval` id to `clearInterval` on destroy. */
  addInterval(id: ReturnType<typeof setInterval>): void
  /** Create a child scope destroyed together with (and before) this one. */
  scope(): DisposableScope
  /** Count of live teardowns currently registered (for leak assertions). */
  readonly size: number
}

/**
 * Create a {@link Disposable} from one or more teardown callbacks. Calling
 * `destroy()` runs them once, in reverse order, with error isolation.
 */
export function createDisposable(...teardowns: Teardown[]): Disposable {
  const scope = createDisposableScope()
  for (const t of teardowns) scope.add(t)
  return scope
}

/** Create a {@link DisposableScope}. */
export function createDisposableScope(): DisposableScope {
  // Each entry releases one resource. Stored in registration order; run LIFO.
  const entries: Teardown[] = []
  let disposed = false

  const runTeardown = (fn: Teardown, errors: unknown[]): void => {
    try {
      fn()
    } catch (err) {
      errors.push(err)
    }
  }

  const self: DisposableScope = {
    get disposed() {
      return disposed
    },
    get size() {
      return entries.length
    },
    add(child) {
      const teardown: Teardown = isDisposable(child) ? () => child.destroy() : child
      if (disposed) {
        // Already torn down — release immediately rather than retaining a leak.
        teardown()
        return child
      }
      entries.push(teardown)
      return child
    },
    addTimeout(id) {
      self.add(() => clearTimeout(id))
    },
    addInterval(id) {
      self.add(() => clearInterval(id))
    },
    scope() {
      const child = createDisposableScope()
      self.add(child)
      return child
    },
    destroy() {
      if (disposed) return
      disposed = true
      const errors: unknown[] = []
      // LIFO: unwind in reverse acquisition order.
      for (let i = entries.length - 1; i >= 0; i -= 1) runTeardown(entries[i]!, errors)
      entries.length = 0
      if (errors.length > 0) throw errors[0]
    },
  }

  return self
}
