import * as React from 'react'
import { type WindowManager, type WindowManagerState } from '@iris-ui/core/window'
import { type UserProfile, type ProfileData } from '@iris-ui/core/profile'
import { type OsChrome, type OsId } from './os'
import { type AppManifest, BUILTIN_APPS, getManifest } from './catalog'

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

// ── User profile ─────────────────────────────────────────────────────────────

const ProfileContext = React.createContext<UserProfile | null>(null)
export const ProfileProvider = ProfileContext.Provider

export function useProfile(): UserProfile {
  const profile = React.useContext(ProfileContext)
  if (!profile) throw new Error('useProfile must be used within <ProfileProvider>')
  return profile
}

/** Subscribe to the live profile state (installed apps + prefs). */
export function useProfileState(): ProfileData {
  const profile = useProfile()
  return React.useSyncExternalStore(
    profile.store.subscribe,
    profile.store.getState,
    profile.store.getState,
  )
}

/**
 * The apps to surface in launchers / desktop: every built-in app plus the
 * installed (non-builtin) catalog entries from the profile. Re-derives whenever
 * the profile's installed list changes.
 */
export function useApps(): AppManifest[] {
  const state = useProfileState()
  return React.useMemo(() => {
    const installed = state.installed
      .map((a) => getManifest(a.appId))
      .filter((m): m is AppManifest => Boolean(m) && !m!.builtin)
    return [...BUILTIN_APPS, ...installed]
  }, [state.installed])
}

/**
 * Launch an app by id. `link` apps open in a new browser tab (no window);
 * everything else opens a managed window via the window manager.
 */
export function useLaunchApp(): (appId: string) => void {
  const wm = useWm()
  return React.useCallback(
    (appId: string) => {
      const app = getManifest(appId)
      if (!app) return
      if (app.kind === 'link' && app.url) {
        window.open(app.url, '_blank', 'noopener')
        return
      }
      wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
    },
    [wm],
  )
}
