/**
 * A subscribable store. The universal bridge between framework-agnostic
 * state and framework reactivity. Adapters wrap this with `ref`,
 * `useSyncExternalStore`, or `createSignal`.
 */
export interface Store<T> {
  getState(): T
  setState(updater: T | ((prev: T) => T)): void
  subscribe(listener: (state: T) => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<(state: T) => void>()

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
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
