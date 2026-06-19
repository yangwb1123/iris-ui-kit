import * as React from 'react'
import { createWindowManager } from '@iris-ui/core/window'
import { createUserProfile, localStorageProfileStorage } from '@iris-ui/core/profile'
import { CHROMES, barInsets, OS_ORDER, type OsId } from './os'
import { WmProvider, OsProvider, ProfileProvider, useProfileState } from './shell'
import { Desktop } from './components/Desktop'

const isOsId = (v: unknown): v is OsId => OS_ORDER.includes(v as OsId)

/**
 * The desktop, parameterized by the user profile. Subscribes to profile state so
 * the skin (a persisted pref) re-renders when hydrate resolves OR the user picks
 * a new one. Renders synchronously — hydrate just updates prefs once it lands.
 */
function Shell({ profile }: { profile: ReturnType<typeof createUserProfile> }) {
  const wm = React.useRef(createWindowManager()).current
  // Subscribe to the profile store so a hydrated/updated `skin` pref re-renders.
  const state = useProfileState()
  const skin = state.prefs.skin
  const os: OsId = isOsId(skin) ? skin : 'win11'
  const chrome = CHROMES[os]
  const rootRef = React.useRef<HTMLDivElement>(null)

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

  React.useEffect(() => {
    void profile.hydrate()
  }, [profile])

  return (
    <ProfileProvider value={profile}>
      <Shell profile={profile} />
    </ProfileProvider>
  )
}
