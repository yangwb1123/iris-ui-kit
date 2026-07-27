/**
 * The ONE virtual file system for this desktop shell — a module singleton over
 * the framework-agnostic `@iris-ui-kit/core/fs` (`createVirtualFs`). A flat map of
 * absolute paths → text content plus explicit folders; the state engine behind
 * the Files manager and any app that opens/saves documents. The SAME engine the
 * React demo drives, proving it runs unchanged on Svelte 5. The shell mirrors
 * the state into the user profile (gated on the `storage` permission); the engine
 * itself is pure + persistable.
 *
 * Svelte gotcha — `$state`/`$effect` only work in `.svelte` / `.svelte.ts`
 * modules, and a `$state` variable must NOT be named `state` (reserved-ish
 * footgun); we use `fstate`.
 */
import { createVirtualFs, type VirtualFs, type VfsState } from '@iris-ui-kit/core/fs'

/** One virtual file system for the whole shell (Files + document open/save). */
export const fs: VirtualFs = createVirtualFs()

/**
 * Bridge the core fs store into Svelte runes: a reactive snapshot of the virtual
 * file system. Call inside a component (it registers an `$effect`); read the
 * returned `.value` in markup / `$derived` to stay live.
 */
export function useFsState(): { readonly value: VfsState } {
  let fstate = $state<VfsState>(fs.getState())
  $effect(() => fs.subscribe((v) => (fstate = v)))
  return {
    get value() {
      return fstate
    },
  }
}
