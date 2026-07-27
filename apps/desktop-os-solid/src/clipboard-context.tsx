import { createContext, createSignal, onCleanup, useContext, type JSX } from 'solid-js'
import {
  type ClipboardHistory,
  type ClipboardHistoryState,
} from '@iris-ui-kit/core/clipboard-history'

/**
 * Solid glue around ONE `@iris-ui-kit/core/clipboard-history` — the framework-agnostic
 * CLIPBOARD MANAGER engine behind the desktop's Win+V / macOS clipboard-manager
 * feel. A single history lives in context (the SAME engine the React desktop
 * drives, here on Solid); apps record copied text into it (the `clipboard`
 * permission gates this), the Clipboard app lists recent clips, and the user can
 * re-copy / pin / clear. Reached anywhere via {@link useClipboard}.
 */
const ClipboardContext = createContext<ClipboardHistory>()

export function ClipboardProvider(props: {
  clipboard: ClipboardHistory
  children: JSX.Element
}): JSX.Element {
  return (
    <ClipboardContext.Provider value={props.clipboard}>{props.children}</ClipboardContext.Provider>
  )
}

/** The shared clipboard history. Throws outside a {@link ClipboardProvider}. */
export function useClipboard(): ClipboardHistory {
  const c = useContext(ClipboardContext)
  if (!c) throw new Error('useClipboard must be used within <ClipboardProvider>')
  return c
}

/**
 * Subscribe to the live clipboard history (newest first) as a Solid accessor.
 * Mirrors the notifications bridge: seed from `getState()` (the synchronous
 * initial value), then push every emission into a signal, unsubscribing on cleanup.
 */
export function useClipboardState(): () => ClipboardHistoryState {
  const c = useClipboard()
  const [state, setState] = createSignal(c.getState())
  const unsubscribe = c.subscribe((next) => setState(() => next))
  onCleanup(unsubscribe)
  return state
}
