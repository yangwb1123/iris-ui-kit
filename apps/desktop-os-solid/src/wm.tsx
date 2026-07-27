import { createContext, createSignal, onCleanup, useContext, type JSX } from 'solid-js'
import { type WindowManager, type WindowManagerState } from '@iris-ui-kit/core/window'

export type Wm = WindowManager

/**
 * ONE framework-agnostic window manager for the whole shell — the SAME engine
 * (`@iris-ui-kit/core/window`) the React desktop demo drives, here proven on Solid.
 * Provided via context so any component reaches it through {@link useWm}.
 */
const WmContext = createContext<Wm>()

export function WmProvider(props: { wm: Wm; children: JSX.Element }): JSX.Element {
  return <WmContext.Provider value={props.wm}>{props.children}</WmContext.Provider>
}

export function useWm(): Wm {
  const wm = useContext(WmContext)
  if (!wm) throw new Error('useWm must be used within <WmProvider>')
  return wm
}

/**
 * Subscribe to the live window-manager state as a Solid accessor. Mirrors the
 * React `useSyncExternalStore` bridge and the Vue `ref + subscribe` one: seed
 * from `getState()` (synchronous initial value), then push every emission into
 * a signal, unsubscribing on cleanup.
 */
export function useWmState(): () => WindowManagerState {
  const wm = useWm()
  const [state, setState] = createSignal(wm.getState())
  const unsubscribe = wm.subscribe((next) => setState(() => next))
  onCleanup(unsubscribe)
  return state
}
