/**
 * A subscribable store. The universal bridge between framework-agnostic
 * state and framework reactivity. Adapters wrap this with `ref`,
 * `useSyncExternalStore`, or `createSignal`.
 */
export interface Store<T> {
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
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<(state: T) => void>()

  const subscribe = (listener: (state: T) => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    getState() {
      return state
    },
    setState(updater) {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater
      if (Object.is(next, state)) return
      state = next
      // Snapshot before notifying so subscribe/unsubscribe DURING a notify is
      // well-defined: listeners present at emit-start are notified (ones added
      // mid-emit are not), and a listener removed mid-emit (e.g. by an earlier
      // listener tearing down a sibling) is skipped rather than called stale.
      for (const listener of [...listeners]) {
        if (listeners.has(listener)) listener(state)
      }
    },
    subscribe,
    subscribeWith<U>(
      selector: (state: T) => U,
      listener: (value: U) => void,
      equals: (a: U, b: U) => boolean = Object.is,
    ): () => void {
      let last = selector(state)
      return subscribe((s) => {
        const next = selector(s)
        if (!equals(last, next)) {
          last = next
          listener(next)
        }
      })
    },
  }
}
