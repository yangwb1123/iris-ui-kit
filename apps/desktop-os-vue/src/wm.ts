/**
 * The seam that proves `@iris-ui/core/window` is framework-agnostic: ONE
 * `createWindowManager()` instance, shared across the whole Vue shell via a
 * module singleton (mirrors React's `useRef(createWindowManager()).current`),
 * plus a `useWmState()` composable that bridges its core store into a Vue ref
 * with `@iris-ui/vue`'s `useStore`.
 */
import { shallowRef, type Ref } from 'vue'
import {
  createWindowManager,
  type WindowManager,
  type WindowManagerState,
} from '@iris-ui/core/window'

/** The single, app-wide window manager — the same engine the React demo uses. */
export const wm: WindowManager = createWindowManager()

// ONE module-level subscription bridges the core store into a Vue ref. Every
// consumer shares it (no per-component subscribe), so there's nothing to dispose
// and no effect-scope coupling — the singleton lives for the app's lifetime.
const wmState = shallowRef<WindowManagerState>(wm.getState())
wm.subscribe((next) => (wmState.value = next))

/** Reactive, read-only view of the live window-manager state (Vue store bridge). */
export function useWmState(): Ref<WindowManagerState> {
  return wmState
}
