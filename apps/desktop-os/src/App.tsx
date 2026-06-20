import * as React from 'react'
import {
  createWindowManager,
  serializeSession,
  restoreSession,
  type WindowSession,
} from '@iris-ui/core/window'
import { createUserProfile, localStorageProfileStorage } from '@iris-ui/core/profile'
import { createNotificationCenter } from '@iris-ui/core/notifications'
import { CHROMES, barInsets, OS_ORDER, type OsId } from './os'
import {
  WmProvider,
  OsProvider,
  ProfileProvider,
  NotificationsProvider,
  useProfileState,
} from './shell'
import { getManifest, registerCustomApps, type AppManifest } from './catalog'
import { Desktop } from './components/Desktop'

const isOsId = (v: unknown): v is OsId => OS_ORDER.includes(v as OsId)

type Profile = ReturnType<typeof createUserProfile>

/** The saved window session, filtered to apps that still resolve (removed custom apps are skipped). */
function knownSession(profile: Profile): WindowSession {
  const raw = profile.getPref<WindowSession>('session')
  if (!Array.isArray(raw)) return []
  // Custom (URL-added) apps live in prefs — register them so getManifest resolves them.
  registerCustomApps((profile.getPref<AppManifest[]>('customApps') ?? []) as AppManifest[])
  return raw.filter((e) => Boolean(getManifest(e.appId)))
}

/**
 * The desktop, parameterized by the user profile. Subscribes to profile state so
 * the skin (a persisted pref) re-renders when hydrate resolves OR the user picks
 * a new one. Renders synchronously — hydrate just updates prefs once it lands.
 */
function Shell({ profile, hydrated }: { profile: Profile; hydrated: boolean }) {
  const wm = React.useRef(createWindowManager()).current
  // Subscribe to the profile store so a hydrated/updated `skin` pref re-renders.
  const state = useProfileState()
  const skin = state.prefs.skin
  const os: OsId = isOsId(skin) ? skin : 'win11'
  const chrome = CHROMES[os]
  const rootRef = React.useRef<HTMLDivElement>(null)
  const restoredRef = React.useRef(false)

  // Persist the skin to the profile (→ localStorage) so it survives a reload.
  const setOs = React.useCallback((id: OsId) => profile.setPref('skin', id), [profile])

  // Reserve the bottom bar and feed the remaining rectangle to the WM as its
  // work area (drives maximize + snap). Re-measured on resize and skin change.
  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const { top, bottom } = barInsets(chrome)
    const apply = () => {
      const r = el.getBoundingClientRect()
      wm.setWorkArea({
        x: 0,
        y: top,
        width: r.width,
        height: Math.max(240, r.height - top - bottom),
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [wm, chrome])

  // Restore the saved window session ONCE, after hydrate has populated prefs and
  // the work area is set (the work-area effect above runs first, on mount).
  React.useEffect(() => {
    if (!hydrated || restoredRef.current) return
    restoredRef.current = true
    if (wm.getState().windows.length === 0) restoreSession(wm, knownSession(profile))
  }, [hydrated, profile, wm])

  // Persist the window session (debounced) on every WM change, once restore ran —
  // so a reload brings back the same windows, geometry, stack order, and focus.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = wm.subscribe(() => {
      if (!restoredRef.current) return
      clearTimeout(timer)
      timer = setTimeout(() => profile.setPref('session', serializeSession(wm.getState())), 400)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [wm, profile])

  return (
    <WmProvider value={wm}>
      <OsProvider value={{ chrome, setOs }}>
        <div
          ref={rootRef}
          style={
            {
              position: 'fixed',
              inset: 0,
              overflow: 'hidden',
              fontFamily: 'var(--os-font)',
              background: 'var(--os-wallpaper)',
              ...chrome.vars,
            } as React.CSSProperties
          }
        >
          <Desktop />
        </div>
      </OsProvider>
    </WmProvider>
  )
}

export function App() {
  // One profile for the whole shell, persisted to localStorage. Hydration is
  // async; the desktop renders immediately and prefs (skin) update when it lands.
  const profile = React.useRef(
    createUserProfile({ storage: localStorageProfileStorage('iris-desktop-os') }),
  ).current
  // One notification center for the whole shell (toasts + history).
  const notifications = React.useRef(createNotificationCenter()).current
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    void profile.hydrate().then(() => setHydrated(true))
  }, [profile])

  return (
    <ProfileProvider value={profile}>
      <NotificationsProvider value={notifications}>
        <Shell profile={profile} hydrated={hydrated} />
      </NotificationsProvider>
    </ProfileProvider>
  )
}
