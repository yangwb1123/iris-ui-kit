import { createEffect, onCleanup, onMount, type JSX } from 'solid-js'
import {
  createWindowManager,
  serializeSession,
  restoreSession,
  type WindowManager,
  type WindowSession,
} from '@iris-ui-kit/core/window'
import {
  createUserProfile,
  localStorageProfileStorage,
  type UserProfile,
} from '@iris-ui-kit/core/profile'
import { createCommandRegistry } from '@iris-ui-kit/core/commands'
import { createNotificationCenter } from '@iris-ui-kit/core/notifications'
import { createClipboardHistory } from '@iris-ui-kit/core/clipboard-history'
import { createVirtualFs, type VirtualFs, type VfsState } from '@iris-ui-kit/core/fs'
import { barInsets } from './os'
import { WmProvider, useWm } from './wm'
import { ProfileProvider } from './profile'
import { OsProvider, useOs } from './os-state'
import { CommandsProvider } from './commands'
import { NotificationsProvider } from './notifications'
import { ClipboardProvider } from './clipboard-context'
import { FsProvider } from './fs-context'
import { getManifest, registerCustomApps, type AppManifest } from './catalog'
import { Desktop } from './Desktop'

/** The saved window session, filtered to apps that still resolve (removed apps skipped). */
function knownSession(profile: UserProfile): WindowSession {
  const raw = profile.getPref<WindowSession>('session')
  if (!Array.isArray(raw)) return []
  // Custom (URL-added) apps live in prefs — register them so getManifest resolves.
  registerCustomApps((profile.getPref<AppManifest[]>('customApps') ?? []) as AppManifest[])
  return raw.filter((e) => Boolean(getManifest(e.appId)))
}

/**
 * Restore the saved window session ONCE (after hydrate populated prefs + the work
 * area is set), then persist it debounced on every WM change — so open windows,
 * geometry, stacking, and focus survive a reload. Mirrors the React shell.
 */
function attachSessionPersistence(wm: WindowManager, profile: UserProfile): () => void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  if (wm.getState().windows.length === 0) restoreSession(wm, knownSession(profile))
  const unsubscribe = wm.subscribe(() => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => profile.setPref('session', serializeSession(wm.getState())), 400)
  })
  return () => {
    clearTimeout(saveTimer)
    unsubscribe()
  }
}

/**
 * Seed the virtual file system from the profile ONCE (the saved `fs` pref), or a
 * starter set on a fresh profile, then persist it debounced on every change — so
 * user files survive a reload. Mirrors the React shell's fs persistence.
 */
function attachFsPersistence(fs: VirtualFs, profile: UserProfile): () => void {
  const saved = profile.getPref<VfsState>('fs')
  if (saved && Array.isArray(saved.folders) && saved.files) {
    fs.store.setState(() => saved)
  } else if (Object.keys(fs.getState().files).length === 0) {
    fs.write(
      '/Documents/Welcome.txt',
      'Welcome to Iris Desktop OS.\n\nThis Files app is a real virtual file system — create folders and text files, rename, delete. It persists to your profile and survives a reload.',
    )
    fs.write(
      '/Documents/notes.md',
      '# Notes\n\n- Backed by @iris-ui-kit/core/fs\n- The same engine drives all four shells.',
    )
    fs.mkdir('/Pictures')
  }
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = fs.subscribe(() => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => profile.setPref('fs', fs.getState()), 400)
  })
  return () => {
    clearTimeout(saveTimer)
    unsubscribe()
  }
}

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
  // the React desktop demo drives, proven here on Solid. Four virtual desktops
  // (workspaces) so the Pager / next-prev commands have something to switch.
  const wm = createWindowManager({ workspaces: 4 })

  // ONE user profile (installed apps + user-added web apps + the OS-skin pref),
  // persisted to localStorage. Hydration is async; the desktop renders
  // immediately and prefs (skin, installed apps) apply once it lands.
  const profile = createUserProfile({
    storage: localStorageProfileStorage('iris-desktop-os-solid'),
  })

  // ONE command registry behind the ⌘K palette + agent surface.
  const commands = createCommandRegistry()

  // ONE notification center for the whole shell (toasts + history).
  const notifications = createNotificationCenter()

  // ONE clipboard history (the clipboard-manager engine behind the Clipboard app).
  const clipboard = createClipboardHistory()

  // ONE virtual file system (the engine behind the Files manager + document I/O).
  const fs = createVirtualFs()

  onMount(() => {
    // Hydrate the profile, then restore the window session + seed/persist the fs,
    // and start persisting both. The Shell's work-area effects run synchronously
    // on mount (before this async hydrate resolves), so geometry clamps against
    // the real work area.
    let detachSession: (() => void) | undefined
    let detachFs: (() => void) | undefined
    void profile.hydrate().then(() => {
      detachSession = attachSessionPersistence(wm, profile)
      detachFs = attachFsPersistence(fs, profile)
    })
    onCleanup(() => {
      detachSession?.()
      detachFs?.()
    })
  })

  return (
    <WmProvider wm={wm}>
      <ProfileProvider profile={profile}>
        <OsProvider>
          <CommandsProvider registry={commands}>
            <NotificationsProvider notifications={notifications}>
              <ClipboardProvider clipboard={clipboard}>
                <FsProvider fs={fs}>
                  <Shell />
                </FsProvider>
              </ClipboardProvider>
            </NotificationsProvider>
          </CommandsProvider>
        </OsProvider>
      </ProfileProvider>
    </WmProvider>
  )
}
