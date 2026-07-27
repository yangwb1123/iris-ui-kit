import { shallowRef, onScopeDispose, type ShallowRef } from 'vue'
import type { ReadonlyStore, Store } from '@iris-ui-kit/core'

/**
 * Bridge a framework-agnostic `@iris-ui-kit/core` store into a Vue ref — updates on
 * every store emission. The mirror of React's `useSyncExternalStore`, Solid's
 * `createSignal`, and Svelte's `readable`. Seeds synchronously from
 * `store.getState()` (SSR-safe); detaches on scope dispose.
 */
export function useStore<T>(store: ReadonlyStore<T>): Readonly<ShallowRef<T>> {
  const state = shallowRef(store.getState()) as ShallowRef<T>
  onScopeDispose(store.subscribe((next) => (state.value = next)))
  return state
}

/**
 * Subscribe to a DERIVED slice of a core store — the ref updates only when
 * `selector(state)` changes per `equals` (default `Object.is`), not on every
 * store emission. Built on {@link Store.subscribeWith}.
 */
export function useStoreSelector<T, U>(
  store: Store<T>,
  selector: (state: T) => U,
  equals?: (a: U, b: U) => boolean,
): Readonly<ShallowRef<U>> {
  const slice = shallowRef(selector(store.getState())) as ShallowRef<U>
  onScopeDispose(store.subscribeWith(selector, (v) => (slice.value = v), equals))
  return slice
}
