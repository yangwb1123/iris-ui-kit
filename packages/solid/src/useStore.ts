import { createSignal, onCleanup, type Accessor } from 'solid-js'
import type { Store } from '@iris-ui/core'

/**
 * Bridge a framework-agnostic `@iris-ui/core` store into Solid reactivity.
 * Returns an accessor `() => T` that updates on every store emission — the
 * same contract React covers via `useSyncExternalStore` and Vue via
 * `ref + subscribe`. The **same** store powers Button/Popover/Dialog etc. on
 * every framework; only this thin bridge differs.
 *
 * Preferred over Solid's built-in `from(store)` because it has a synchronous
 * initial value (no `undefined` flash) and is SSR-safe.
 */
export function useStore<T>(store: Store<T>): Accessor<T> {
  const [state, setState] = createSignal(store.getState())
  // A signal setter treats a function argument as an updater, so wrap the
  // value in a thunk in case T is itself a function/object.
  const unsubscribe = store.subscribe((next) => setState(() => next))
  onCleanup(unsubscribe)
  return state
}

/**
 * Subscribe to a DERIVED slice of a core store — the accessor updates only when
 * `selector(state)` changes per `equals` (default `Object.is`), not on every
 * store emission. Built on {@link Store.subscribeWith}.
 */
export function useStoreSelector<T, U>(
  store: Store<T>,
  selector: (state: T) => U,
  equals?: (a: U, b: U) => boolean,
): Accessor<U> {
  const [slice, setSlice] = createSignal(selector(store.getState()))
  const unsubscribe = store.subscribeWith(selector, (v) => setSlice(() => v), equals)
  onCleanup(unsubscribe)
  return slice
}
