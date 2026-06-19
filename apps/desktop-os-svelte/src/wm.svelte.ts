/**
 * The ONE window manager instance for this desktop shell — a module singleton.
 * Every component (Desktop, Window, Taskbar, StartMenu, the in-window apps)
 * drives the SAME framework-agnostic `createWindowManager` from
 * `@iris-ui/core/window`, proving the core engine runs unchanged on Svelte 5.
 */
import {
  createWindowManager,
  type WindowManager,
  type WindowManagerState,
} from '@iris-ui/core/window'

export const wm: WindowManager = createWindowManager()

/**
 * Bridge the core store into Svelte runes: a reactive snapshot of the window
 * manager state. Call inside a component (it registers an `$effect`); read the
 * returned `.value` in markup/`$derived` to stay live.
 *
 * Svelte gotcha — do NOT name a `$state` variable `state` (reserved-ish footgun
 * with the WM's own `state` fields); we use `s`.
 */
export function useWmState(): { readonly value: WindowManagerState } {
  let s = $state<WindowManagerState>(wm.getState())
  $effect(() => wm.subscribe((v) => (s = v)))
  return {
    get value() {
      return s
    },
  }
}
