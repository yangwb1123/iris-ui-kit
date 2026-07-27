import { createContext, createSignal, onCleanup, useContext, type JSX } from 'solid-js'
import { type VirtualFs, type VfsState } from '@iris-ui-kit/core/fs'

/**
 * Solid glue around ONE `@iris-ui-kit/core/fs` — the framework-agnostic VIRTUAL FILE
 * SYSTEM behind the desktop's Files manager (and any app that opens/saves
 * documents). A single fs lives in context (the SAME engine the React desktop
 * drives, here on Solid); the Files app reads + mutates it (the `storage`
 * permission gates this), and the shell mirrors it into the user profile so user
 * files survive a reload. Reached anywhere via {@link useFs}.
 */
const FsContext = createContext<VirtualFs>()

export function FsProvider(props: { fs: VirtualFs; children: JSX.Element }): JSX.Element {
  return <FsContext.Provider value={props.fs}>{props.children}</FsContext.Provider>
}

/** The shared virtual file system. Throws outside a {@link FsProvider}. */
export function useFs(): VirtualFs {
  const fs = useContext(FsContext)
  if (!fs) throw new Error('useFs must be used within <FsProvider>')
  return fs
}

/**
 * Subscribe to the live virtual file system as a Solid accessor. Mirrors the
 * clipboard / notifications bridges: seed from `getState()` (the synchronous
 * initial value), then push every emission into a signal, unsubscribing on cleanup.
 */
export function useFsState(): () => VfsState {
  const fs = useFs()
  const [state, setState] = createSignal(fs.getState())
  const unsubscribe = fs.subscribe((next) => setState(() => next))
  onCleanup(unsubscribe)
  return state
}
