import { createEffect, onCleanup, onMount, type JSX } from 'solid-js'
import { createWindowManager } from '@iris-ui/core/window'
import { createUserProfile, localStorageProfileStorage } from '@iris-ui/core/profile'
import { createCommandRegistry } from '@iris-ui/core/commands'
import { barInsets } from './os'
import { WmProvider, useWm } from './wm'
import { ProfileProvider } from './profile'
import { OsProvider, useOs } from './os-state'
import { CommandsProvider } from './commands'
import { Desktop } from './Desktop'

/**
 * The desktop surface. Lives INSIDE the providers so it can read the live OS skin
 * ({@link useOs}): it applies `CHROMES[os].vars` to the root reactively (the skin
 * recolors instantly) and re-feeds the WM work area from `barInsets(chrome)` on
 * every skin change + resize (a top menu bar / dock reserves different space).
 */
function Shell(): JSX.Element {
  const wm = useWm()
  const { chrome } = useOs()
  let rootRef: HTMLDivElement | undefined

  onMount(() => {
    // Reserve the bars and feed the remaining rectangle to the WM as its work
    // area (drives maximize + snap). Re-measured on resize AND skin change (the
    // effect re-runs because it reads the reactive `chrome()`).
    const el = rootRef
    if (!el) return
    const ro = new ResizeObserver(() => {
      const c = chrome()
      const { top, bottom } = barInsets(c)
      const r = el.getBoundingClientRect()
      wm.setWorkArea({
        x: 0,
        y: top,
        width: r.width,
        height: Math.max(240, r.height - top - bottom),
      })
    })
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  // Recompute the work area whenever the skin changes (different bar insets).
  createEffect(() => {
    const el = rootRef
    if (!el) return
    const { top, bottom } = barInsets(chrome())
    const r = el.getBoundingClientRect()
    wm.setWorkArea({
      x: 0,
      y: top,
      width: r.width,
      height: Math.max(240, r.height - top - bottom),
    })
  })

  return (
    <div
      ref={rootRef}
      class="os-root"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        'font-family': 'var(--os-font)',
        background: 'var(--os-wallpaper)',
        // Apply the active skin's CSS variables reactively — switching OS recolors
        // every Iris/OS surface live (they all read these custom properties).
        ...chrome().vars,
      }}
    >
      <Desktop />
    </div>
  )
}

export function App(): JSX.Element {
  // ONE framework-agnostic window manager for the whole shell — the same engine
  // the React desktop demo drives, proven here on Solid.
  const wm = createWindowManager()

  // ONE user profile (installed apps + user-added web apps + the OS-skin pref),
  // persisted to localStorage. Hydration is async; the desktop renders
  // immediately and prefs (skin, installed apps) apply once it lands.
  const profile = createUserProfile({
    storage: localStorageProfileStorage('iris-desktop-os-solid'),
  })

  // ONE command registry behind the ⌘K palette + agent surface.
  const commands = createCommandRegistry()

  onMount(() => {
    void profile.hydrate()
  })

  return (
    <WmProvider wm={wm}>
      <ProfileProvider profile={profile}>
        <OsProvider>
          <CommandsProvider registry={commands}>
            <Shell />
          </CommandsProvider>
        </OsProvider>
      </ProfileProvider>
    </WmProvider>
  )
}
