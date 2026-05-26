import { useSyncExternalStore } from 'react'
import type { Store } from '@iris-ui/core'

/**
 * Bridge a framework-agnostic `@iris-ui/core` store into React reactivity.
 * Uses React 18's `useSyncExternalStore` — the contract is identical to the
 * one Vue uses via `ref + onMounted` and Solid uses via `createSignal`. The
 * **same** store can power Button, Popover, Dialog, etc. on any framework.
 */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState, // SSR fallback — same as client snapshot in our case.
  )
}
