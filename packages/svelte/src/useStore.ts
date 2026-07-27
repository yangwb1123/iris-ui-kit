import { readable, type Readable } from 'svelte/store'
import type { ReadonlyStore, Store } from '@iris-ui-kit/core'

/**
 * Bridge a framework-agnostic `@iris-ui-kit/core` store into a Svelte readable
 * store. The mirror of React's `useSyncExternalStore` and Vue's `ref + subscribe`
 * — the **same** core Store powers Button/Popover/Dialog on every framework.
 * Seeds the initial value from `store.getState()` (synchronous, SSR-safe, no
 * flash); the subscribe callback runs only in the browser. Use with the `$`
 * auto-subscription in markup: `{$count}`.
 */
export function toStore<T>(store: ReadonlyStore<T>): Readable<T> {
  return readable(store.getState(), (set) => store.subscribe(set))
}

/**
 * Bridge a DERIVED slice of a core store into a Svelte readable — it emits only
 * when `selector(state)` changes per `equals` (default `Object.is`), not on
 * every store emission. Built on {@link Store.subscribeWith}.
 */
export function toStoreSelector<T, U>(
  store: Store<T>,
  selector: (state: T) => U,
  equals?: (a: U, b: U) => boolean,
): Readable<U> {
  return readable(selector(store.getState()), (set) => store.subscribeWith(selector, set, equals))
}
