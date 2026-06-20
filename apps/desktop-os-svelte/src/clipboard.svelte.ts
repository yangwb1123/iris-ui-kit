/**
 * The ONE clipboard history for this desktop shell — a module singleton over the
 * framework-agnostic `@iris-ui/core/clipboard-history` (`createClipboardHistory`).
 * It holds the live clip list (newest first) that drives the Clipboard manager
 * app (Win+V / macOS clipboard-manager feel); the SAME engine the React demo
 * drives, proving it runs unchanged on Svelte 5. Apps record copied text here
 * (the desktop's `clipboard` permission gates this); the engine is pure +
 * timer-free, so the view owns the actual system-clipboard write.
 *
 * Svelte gotcha — `$state`/`$effect` only work in `.svelte` / `.svelte.ts`
 * modules, and a `$state` variable must NOT be named `state` (reserved-ish
 * footgun); we use `cstate`.
 */
import {
  createClipboardHistory,
  type ClipboardHistory,
  type ClipboardHistoryState,
} from '@iris-ui/core/clipboard-history'

/** One clipboard history for the whole shell (re-copy / pin / clear). */
export const clipboard: ClipboardHistory = createClipboardHistory()

/**
 * Bridge the core clipboard store into Svelte runes: a reactive snapshot of the
 * clip list (newest first). Call inside a component (it registers an `$effect`);
 * read the returned `.value` in markup / `$derived` to stay live.
 */
export function useClipboardState(): { readonly value: ClipboardHistoryState } {
  let cstate = $state<ClipboardHistoryState>(clipboard.getState())
  $effect(() => clipboard.subscribe((v) => (cstate = v)))
  return {
    get value() {
      return cstate
    },
  }
}
