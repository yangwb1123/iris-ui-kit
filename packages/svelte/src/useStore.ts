import { readable, type Readable } from 'svelte/store'
import type { Store } from '@iris-ui/core'

/**
 * Bridge a framework-agnostic `@iris-ui/core` store into a Svelte readable
 * store. The mirror of React's `useSyncExternalStore` and Vue's `ref + subscribe`
 * — the **same** core Store powers Button/Popover/Dialog on every framework.
 * Seeds the initial value from `store.getState()` (synchronous, SSR-safe, no
 * flash); the subscribe callback runs only in the browser. Use with the `$`
 * auto-subscription in markup: `{$count}`.
 */
export function toStore<T>(store: Store<T>): Readable<T> {
  return readable(store.getState(), (set) => store.subscribe(set))
}
