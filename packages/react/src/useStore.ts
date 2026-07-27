import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { ReadonlyStore, Store } from '@iris-ui-kit/core'

/**
 * Bridge a framework-agnostic `@iris-ui-kit/core` store into React reactivity.
 * Uses React 18's `useSyncExternalStore` — the contract is identical to the
 * one Vue uses via `ref + onMounted` and Solid uses via `createSignal`. The
 * **same** store can power Button, Popover, Dialog, etc. on any framework.
 */
export function useStore<T>(store: ReadonlyStore<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState, // SSR fallback — same as client snapshot in our case.
  )
}

/**
 * Subscribe to a DERIVED slice of a core store — the component re-renders only
 * when `selector(state)` changes per `isEqual` (default `Object.is`), not on
 * every store emission. Built on {@link Store.subscribeWith}. Inline closures
 * for `selector`/`isEqual` are fine (captured via refs; the subscription is not
 * re-created between renders).
 */
export function useStoreSelector<T, U>(
  store: Store<T>,
  selector: (state: T) => U,
  isEqual?: (a: U, b: U) => boolean,
): U {
  const [slice, setSlice] = React.useState(() => selector(store.getState()))
  const selRef = React.useRef(selector)
  selRef.current = selector
  const eqRef = React.useRef(isEqual)
  eqRef.current = isEqual
  React.useEffect(() => {
    const read = (s: T): U => selRef.current(s)
    const eq = (a: U, b: U): boolean => (eqRef.current ?? Object.is)(a, b)
    // Re-sync in case the store moved between render and this effect.
    setSlice((prev) => {
      const next = read(store.getState())
      return eq(prev, next) ? prev : next
    })
    return store.subscribeWith(read, setSlice, eq)
  }, [store])
  return slice
}
