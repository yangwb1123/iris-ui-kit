/**
 * A read-only subscribable store — the public view of a {@link Store} that
 * external consumers should use when they only need to observe state, not
 * mutate it. Exposes {@link ReadonlyStore.getState} and
 * {@link ReadonlyStore.subscribe} but no write methods.
 *
 * Controllers that internally own a full {@link Store} (with `setState`,
 * `batch`) can expose their store as `ReadonlyStore<T>` to prevent external
 * code from bypassing controlled mutation paths.
 */
export interface ReadonlyStore<T> {
  getState(): T
  subscribe(listener: (state: T) => void): () => void
}

/**
 * A subscribable store. The universal bridge between framework-agnostic
 * state and framework reactivity. Adapters wrap this with `ref`,
 * `useSyncExternalStore`, or `createSignal`.
 */
export interface Store<T> extends ReadonlyStore<T> {
  getState(): T
  setState(updater: T | ((prev: T) => T)): void
  subscribe(listener: (state: T) => void): () => void
  /**
   * Subscribe to a DERIVED slice. `listener` fires only when `selector(state)`
   * changes per `equals` (default `Object.is`) — not on every state change — so
   * a consumer re-renders only when the slice it cares about actually moves
   * (selective subscription). Returns an unsubscribe. `selector` runs on every
   * `setState`; keep it cheap and pure. The current slice is captured at
   * subscribe time, so the first call only fires once it changes.
   */
  subscribeWith<U>(
    selector: (state: T) => U,
    listener: (value: U) => void,
    equals?: (a: U, b: U) => boolean,
  ): () => void
  /**
   * Coalesce every `setState` inside `fn` into a SINGLE notification flush.
   * State is updated synchronously (so `getState()` inside `fn` is current), but
   * listeners are notified once — with the final state — when the outermost
   * `batch` returns. Nested `batch` calls join the outermost flush. If no state
   * actually changed, no notification fires. Returns `fn`'s result.
   *
   * This is the emit-coalescing primitive composite controllers use to turn an
   * N-slice update (e.g. `setSort` → reload → page/rows/loading) into one render
   * pass instead of N.
   */
  batch<R>(fn: () => R): R
}

type StoreListener<T> = (state: T) => void

function notifyStoreListeners<T>(listeners: Set<StoreListener<T>>, state: T): void {
  // Snapshot before notifying so subscribe/unsubscribe DURING a notify is
  // well-defined: listeners present at emit-start are notified (ones added
  // mid-emit are not), and a listener removed mid-emit is skipped.
  for (const listener of [...listeners]) {
    if (listeners.has(listener)) listener(state)
  }
}

function subscribeStoreListener<T>(
  listeners: Set<StoreListener<T>>,
  listener: StoreListener<T>,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function subscribeStoreSlice<T, U>(
  getState: () => T,
  subscribe: (listener: StoreListener<T>) => () => void,
  selector: (state: T) => U,
  listener: (value: U) => void,
  equals: (a: U, b: U) => boolean,
): () => void {
  let last = selector(getState())
  return subscribe((state) => {
    const next = selector(state)
    if (!equals(last, next)) {
      last = next
      listener(next)
    }
  })
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<StoreListener<T>>()
  let batchDepth = 0
  let pendingFlush = false
  const getState = (): T => state
  const notify = (): void => notifyStoreListeners(listeners, state)
  const subscribe = (listener: StoreListener<T>): (() => void) =>
    subscribeStoreListener(listeners, listener)

  return {
    getState,
    setState(updater) {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater
      if (Object.is(next, state)) return
      state = next
      if (batchDepth > 0) {
        // Defer the flush to the outermost batch boundary so N writes coalesce.
        pendingFlush = true
        return
      }
      notify()
    },
    batch<R>(fn: () => R): R {
      batchDepth++
      try {
        return fn()
      } finally {
        batchDepth--
        if (batchDepth === 0 && pendingFlush) {
          pendingFlush = false
          notify()
        }
      }
    },
    subscribe,
    subscribeWith<U>(
      selector: (state: T) => U,
      listener: (value: U) => void,
      equals: (a: U, b: U) => boolean = Object.is,
    ): () => void {
      return subscribeStoreSlice(getState, subscribe, selector, listener, equals)
    },
  }
}

/**
 * Compose one or more source stores into a read-only DERIVED store whose value
 * is `combiner(...sourceStates)`, recomputed whenever any source changes and
 * re-emitted only when the result changes per `equals` (default `Object.is`).
 *
 * Subscription to the sources is lazy and reference-counted: the derived store
 * subscribes to its sources only while it has at least one listener, and
 * unsubscribes when the last listener leaves — so a derived store that is never
 * observed (or whose observers have all unmounted) holds no source
 * subscriptions. `getState()` always returns a fresh value (recomputed on
 * demand while unsubscribed, cached while subscribed).
 *
 * This is the composition primitive for composite controllers: instead of a
 * manual `source.subscribe(s => target.setState(project(s)))` bridge (an extra
 * hop that double-emits), project with `derived([source], project)`.
 *
 * The returned store is read-only: `setState` throws.
 */
export function derived<S extends readonly unknown[], R>(
  stores: readonly [...{ [K in keyof S]: Store<S[K]> }],
  combiner: (...states: S) => R,
  equals: (a: R, b: R) => boolean = Object.is,
): Store<R> {
  const readInputs = (): S => stores.map((s) => s.getState()) as unknown as S
  const listeners = new Set<(value: R) => void>()
  let inputs = readInputs()
  let value = combiner(...inputs)
  let unsubs: Array<() => void> | null = null

  // Recompute `value` ONLY when a source state changed identity, so `getState`
  // returns a STABLE reference while the sources are unchanged. This is required
  // for React's `useSyncExternalStore` (an unstable snapshot loops), while still
  // reflecting source changes on demand — even while unobserved. Returns whether
  // `value` moved per `equals`.
  const refresh = (): boolean => {
    const next = readInputs()
    let inputsChanged = next.length !== inputs.length
    if (!inputsChanged) {
      for (let i = 0; i < next.length; i++) {
        if (!Object.is(next[i], inputs[i])) {
          inputsChanged = true
          break
        }
      }
    }
    if (!inputsChanged) return false
    inputs = next
    const computed = combiner(...next)
    if (equals(value, computed)) return false
    value = computed
    return true
  }

  const onSourceChange = (): void => {
    if (!refresh()) return
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener(value)
    }
  }

  const ensureSubscribed = (): void => {
    if (unsubs) return
    refresh() // sync in case sources moved while we were detached
    unsubs = stores.map((s) => s.subscribe(onSourceChange))
  }

  const maybeUnsubscribe = (): void => {
    if (unsubs && listeners.size === 0) {
      for (const u of unsubs) u()
      unsubs = null
    }
  }

  const getState = (): R => {
    refresh()
    return value
  }

  const subscribe = (listener: (value: R) => void): (() => void) => {
    listeners.add(listener)
    ensureSubscribed()
    return () => {
      listeners.delete(listener)
      maybeUnsubscribe()
    }
  }

  return {
    getState,
    setState() {
      throw new Error('derived store is read-only')
    },
    batch<R2>(fn: () => R2): R2 {
      // A derived store has no own writes to coalesce; emits are driven by its
      // sources (batch THEM to coalesce). Run inline so the contract holds.
      return fn()
    },
    subscribe,
    subscribeWith<U>(
      selector: (state: R) => U,
      listener: (value: U) => void,
      equals2: (a: U, b: U) => boolean = Object.is,
    ): () => void {
      let last = selector(getState())
      return subscribe((s) => {
        const next = selector(s)
        if (!equals2(last, next)) {
          last = next
          listener(next)
        }
      })
    },
  }
}
