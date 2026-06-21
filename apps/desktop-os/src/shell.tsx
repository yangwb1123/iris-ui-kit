import * as React from 'react'
import { type WindowManager, type WindowManagerState } from '@iris-ui/core/window'
import { type UserProfile, type ProfileData } from '@iris-ui/core/profile'
import { type NotificationCenter, type NotificationCenterState } from '@iris-ui/core/notifications'
import { type ClipboardHistory, type ClipboardHistoryState } from '@iris-ui/core/clipboard-history'
import { type VirtualFs, type VfsState } from '@iris-ui/core/fs'
import { type OsChrome, type OsId } from './os'
import { type AppManifest, BUILTIN_APPS, getManifest, registerCustomApps } from './catalog'

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

// ── Notification center ────────────────────────────────────────────────────────

const NotificationsContext = React.createContext<NotificationCenter | null>(null)
export const NotificationsProvider = NotificationsContext.Provider

export function useNotifications(): NotificationCenter {
  const nc = React.useContext(NotificationsContext)
  if (!nc) throw new Error('useNotifications must be used within <NotificationsProvider>')
  return nc
}

/** Subscribe to the live notification list (newest first). */
export function useNotificationState(): NotificationCenterState {
  const nc = useNotifications()
  return React.useSyncExternalStore(nc.store.subscribe, nc.store.getState, nc.store.getState)
}

// ── Clipboard history ──────────────────────────────────────────────────────────

const ClipboardContext = React.createContext<ClipboardHistory | null>(null)
export const ClipboardProvider = ClipboardContext.Provider

export function useClipboard(): ClipboardHistory {
  const c = React.useContext(ClipboardContext)
  if (!c) throw new Error('useClipboard must be used within <ClipboardProvider>')
  return c
}

/** Subscribe to the live clipboard history (newest first). */
export function useClipboardState(): ClipboardHistoryState {
  const c = useClipboard()
  return React.useSyncExternalStore(c.store.subscribe, c.store.getState, c.store.getState)
}

// ── Virtual file system ────────────────────────────────────────────────────────

const FsContext = React.createContext<VirtualFs | null>(null)
export const FsProvider = FsContext.Provider

export function useFs(): VirtualFs {
  const fs = React.useContext(FsContext)
  if (!fs) throw new Error('useFs must be used within <FsProvider>')
  return fs
}

/** Subscribe to the live virtual file system. */
export function useFsState(): VfsState {
  const fs = useFs()
  return React.useSyncExternalStore(fs.store.subscribe, fs.store.getState, fs.store.getState)
}

/** Raw user-added web-app manifests from the profile (`customApps` pref). */
function readCustomApps(state: ProfileData): AppManifest[] {
  return (state.prefs.customApps as AppManifest[] | undefined) ?? []
}

/**
 * The apps to surface in launchers / desktop: every built-in app, plus the
 * installed (non-builtin) catalog entries from the profile, plus all user-added
 * web apps (`customApps`) so they appear in every launcher. Re-derives whenever
 * the profile's installed list or custom apps change.
 *
 * Custom apps live in the profile (not the static catalog), so this also mirrors
 * them into the catalog's lookup registry — every shell component resolves apps
 * by id via `getManifest`, and that must find user-added apps too.
 */
export function useApps(): AppManifest[] {
  const state = useProfileState()
  const customApps = readCustomApps(state)
  // Keep `getManifest` able to resolve user-added apps (windows, icons, taskbar).
  registerCustomApps(customApps)
  return React.useMemo(() => {
    const installed = state.installed
      .map((a) => getManifest(a.appId))
      .filter((m): m is AppManifest => Boolean(m) && !m!.builtin && !m!.custom)
    return [...BUILTIN_APPS, ...installed, ...customApps]
  }, [state.installed, state.prefs.customApps])
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
