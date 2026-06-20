import { onCleanup, onMount, type JSX } from 'solid-js'
import { createWindowManager } from '@iris-ui/core/window'
import { createUserProfile, localStorageProfileStorage } from '@iris-ui/core/profile'
import { createCommandRegistry } from '@iris-ui/core/commands'
import { WmProvider } from './wm'
import { ProfileProvider } from './profile'
import { CommandsProvider } from './commands'
import { Desktop } from './Desktop'

/** Taskbar height (var(--os-bar-h)); reserved so maximize/snap avoid it. */
const BAR_H = 48

export function App(): JSX.Element {
  // ONE framework-agnostic window manager for the whole shell — the same engine
  // the React desktop demo drives, proven here on Solid.
  const wm = createWindowManager()

  // ONE user profile (installed apps + user-added web apps), persisted to
  // localStorage. Hydration is async; the desktop renders immediately and the
  // installed/custom apps appear once it lands.
  const profile = createUserProfile({
    storage: localStorageProfileStorage('iris-desktop-os-solid'),
  })

  // ONE command registry behind the ⌘K palette + agent surface.
  const commands = createCommandRegistry()

  let rootRef: HTMLDivElement | undefined

  onMount(() => {
    void profile.hydrate()

    // Reserve the bottom taskbar and feed the remaining rectangle to the WM as
    // its work area (drives maximize + snap). Re-measured on resize.
    const el = rootRef
    if (!el) return
    const apply = (): void => {
      const r = el.getBoundingClientRect()
      wm.setWorkArea({
        x: 0,
        y: 0,
        width: r.width,
        height: Math.max(240, r.height - BAR_H),
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  return (
    <WmProvider wm={wm}>
      <ProfileProvider profile={profile}>
        <CommandsProvider registry={commands}>
          <div
            ref={rootRef}
            class="os-root"
            style={{
              position: 'fixed',
              inset: 0,
              overflow: 'hidden',
              'font-family': 'var(--os-font)',
              background: 'var(--os-wallpaper)',
            }}
          >
            <Desktop />
          </div>
        </CommandsProvider>
      </ProfileProvider>
    </WmProvider>
  )
}
