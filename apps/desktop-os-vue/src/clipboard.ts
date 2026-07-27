/**
 * The seam that proves `@iris-ui-kit/core/clipboard-history` is framework-agnostic: ONE
 * `createClipboardHistory()` instance, shared across the whole Vue shell via a
 * module singleton (mirrors React's `useRef(createClipboardHistory()).current`),
 * plus a `useClipboard()` composable that returns the engine + a `ref`-backed live
 * view of its state (the Vue store bridge), matching the notifications.ts / wm.ts /
 * profile.ts pattern.
 *
 * This is the CLIPBOARD MANAGER engine (Win+V / macOS clipboard-manager feel): apps
 * record copied text (the desktop's `clipboard` permission gates this), and the
 * Clipboard view lists recent clips, re-copies / pins / clears them, and performs
 * the actual system-clipboard write. The engine stays pure + timer-free.
 */
import { shallowRef, type Ref } from 'vue'
import {
  createClipboardHistory,
  type ClipboardHistory,
  type ClipboardHistoryState,
} from '@iris-ui-kit/core/clipboard-history'

/** The single, app-wide clipboard history — the same engine the React demo uses. */
export const clipboard: ClipboardHistory = createClipboardHistory()

// ONE module-level subscription bridges the core store into a Vue ref. Every
// consumer shares it (no per-component subscribe), matching the wm.ts pattern.
const clipboardState = shallowRef<ClipboardHistoryState>(clipboard.getState())
clipboard.subscribe((next) => (clipboardState.value = next))

/** The shared clipboard history instance (add / remove / clear / togglePin / list). */
export function useClipboard(): ClipboardHistory {
  return clipboard
}

/** Reactive, read-only view of the live clipboard history (newest first). */
export function useClipboardState(): Ref<ClipboardHistoryState> {
  return clipboardState
}
