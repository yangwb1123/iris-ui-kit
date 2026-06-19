import * as React from 'react'
import { type WindowManager, type WindowManagerState } from '@iris-ui/core/window'
import { type OsChrome, type OsId } from './os'

export type Wm = WindowManager

const WmContext = React.createContext<Wm | null>(null)
export const WmProvider = WmContext.Provider

export function useWm(): Wm {
  const wm = React.useContext(WmContext)
  if (!wm) throw new Error('useWm must be used within <WmProvider>')
  return wm
}

/** Subscribe to the live window-manager state (React bridge over its core store). */
export function useWmState(): WindowManagerState {
  const wm = useWm()
  return React.useSyncExternalStore(wm.subscribe, wm.getState, wm.getState)
}

export interface OsContextValue {
  chrome: OsChrome
  setOs: (id: OsId) => void
}
const OsContext = React.createContext<OsContextValue | null>(null)
export const OsProvider = OsContext.Provider

export function useOs(): OsContextValue {
  const ctx = React.useContext(OsContext)
  if (!ctx) throw new Error('useOs must be used within <OsProvider>')
  return ctx
}
