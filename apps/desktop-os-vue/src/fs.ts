/**
 * The seam that proves `@iris-ui-kit/core/fs` is framework-agnostic: ONE
 * `createVirtualFs()` instance, shared across the whole Vue shell via a module
 * singleton (mirrors React's `useRef(createVirtualFs()).current`), plus a
 * `useFs()` composable that returns the engine + a `ref`-backed live view of its
 * state (the Vue store bridge), matching the clipboard.ts / notifications.ts /
 * wm.ts / profile.ts pattern.
 *
 * This is the VIRTUAL FILE SYSTEM engine behind the Files manager: a flat map of
 * absolute paths → text content, plus explicit folders. Apps create/edit/rename/
 * delete folders + text files (the desktop's `storage` permission gates this), and
 * App.vue mirrors the state into the user profile so files survive a reload. The
 * engine stays pure + persistable.
 */
import { shallowRef, type Ref } from 'vue'
import { createVirtualFs, type VirtualFs, type VfsState } from '@iris-ui-kit/core/fs'

/** The single, app-wide virtual file system — the same engine the React demo uses. */
export const fs: VirtualFs = createVirtualFs()

// ONE module-level subscription bridges the core store into a Vue ref. Every
// consumer shares it (no per-component subscribe), matching the wm.ts pattern.
const fsState = shallowRef<VfsState>(fs.getState())
fs.subscribe((next) => (fsState.value = next))

/** The shared virtual file system instance (write/read/mkdir/remove/rename/list). */
export function useFs(): VirtualFs {
  return fs
}

/** Reactive, read-only view of the live virtual file system. */
export function useFsState(): Ref<VfsState> {
  return fsState
}
