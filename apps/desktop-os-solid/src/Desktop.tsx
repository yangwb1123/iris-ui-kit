import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from 'solid-js'
import { useApps, useLaunchApp } from './profile'
import { useOs } from './os-state'
import { useWm, useWmState } from './wm'
import { registerCommands, useDesktopCommands } from './commands'
import { Window } from './Window'
import { Taskbar } from './Taskbar'
import { StartMenu } from './StartMenu'
import { Dock } from './Dock'
import { Panel } from './Panel'
import { MenuBar } from './MenuBar'
import { Spotlight } from './Spotlight'
import { Kickoff } from './Kickoff'
import { CommandPalette } from './CommandPalette'

/** Desktop shortcuts shown top-left; double-click opens the app. */
const SHORTCUTS = ['about', 'appstore', 'files', 'notepad', 'showcase']

/**
 * Registers the live desktop commands into the shared registry for as long as the
 * desktop is mounted. Renders nothing — purely the registration side-effect.
 */
function CommandRegistration(): JSX.Element {
  registerCommands(useDesktopCommands())
  return null
}

/** Optional global top bar — macOS menu bar; nothing on Windows. Per the live skin. */
function TopBar(): JSX.Element {
  const { chrome } = useOs()
  return <Show when={chrome().topBar === 'menubar'}>{<MenuBar />}</Show>
}

/** The bottom bar — taskbar (Win), dock (mac) or KDE panel, per the live skin. */
function BottomBar(props: { launcherOpen: boolean; onToggleLauncher: () => void }): JSX.Element {
  const { chrome } = useOs()
  return (
    <Switch
      fallback={
        <Taskbar launcherOpen={props.launcherOpen} onToggleLauncher={props.onToggleLauncher} />
      }
    >
      <Match when={chrome().bottomBar === 'dock'}>
        <Dock onToggleLauncher={props.onToggleLauncher} />
      </Match>
      <Match when={chrome().bottomBar === 'panel'}>
        <Panel onToggleLauncher={props.onToggleLauncher} />
      </Match>
    </Switch>
  )
}

/** The app launcher — Start menu (Win), Spotlight (mac) or KDE Kickoff, per the live skin. */
function Launcher(props: { open: boolean; onClose: () => void }): JSX.Element {
  const { chrome } = useOs()
  return (
    <Switch fallback={<StartMenu open={props.open} onClose={props.onClose} />}>
      <Match when={chrome().launcher === 'spotlight'}>
        <Spotlight open={props.open} onClose={props.onClose} />
      </Match>
      <Match when={chrome().launcher === 'kickoff'}>
        <Kickoff open={props.open} onClose={props.onClose} />
      </Match>
    </Switch>
  )
}

export function Desktop(): JSX.Element {
  const wm = useWm()
  const state = useWmState()
  const apps = useApps()
  const launch = useLaunchApp()
  const { chrome } = useOs()
  const [launcherOpen, setLauncherOpen] = createSignal(false)
  // ⌘K / Ctrl+K command palette visibility.
  const [paletteOpen, setPaletteOpen] = createSignal(false)

  // Window IDs in z-order — derived from the live store signal so opening,
  // closing and raising windows re-renders the desktop. Keying the `<For>` by
  // stable id (not the immutable window object, which is replaced on every
  // store update) keeps each window's DOM + per-window state across reorders.
  const orderedIds = createMemo(() =>
    [...state().windows].sort((a, b) => a.z - b.z).map((w) => w.id),
  )

  const shortcutApps = createMemo(() =>
    SHORTCUTS.map((id) => apps().find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> =>
      Boolean(a),
    ),
  )

  // Push desktop icons below the macOS menu bar (none reserved on Windows).
  const iconTop = createMemo(() =>
    chrome().topBar === 'menubar' ? 'calc(var(--os-topbar-h) + 16px)' : '16px',
  )

  // Desktop keyboard shortcuts: (Meta|Ctrl)+K toggles the command palette,
  // Meta+Space toggles the launcher, Alt+Tab cycles focus, Escape closes
  // overlays. Registered once; cleaned up on unmount. The palette toggle is
  // checked first so it wins, and the existing shortcuts are preserved.
  onMount(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        const cyclable = wm.ordered().filter((w) => w.state !== 'minimized')
        if (cyclable.length === 0) return
        const focusedId = wm.getState().focusedId
        const idx = cyclable.findIndex((w) => w.id === focusedId)
        const next = cyclable[(idx + 1) % cyclable.length]!
        wm.focus(next.id)
        return
      }
      if (e.metaKey && e.code === 'Space') {
        e.preventDefault()
        setLauncherOpen((o) => !o)
        return
      }
      if (e.key === 'Escape') {
        setLauncherOpen((o) => {
          if (o) e.preventDefault()
          return false
        })
        setPaletteOpen((o) => {
          if (o) e.preventDefault()
          return false
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  return (
    <div
      // Click on empty desktop dismisses the launcher.
      onPointerDown={() => setLauncherOpen(false)}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <CommandRegistration />

      {/* Optional global top bar (macOS menu bar). */}
      <TopBar />

      {/* Desktop icons */}
      <div
        style={{
          position: 'absolute',
          top: iconTop(),
          left: '16px',
          display: 'grid',
          gap: '6px',
          'grid-auto-rows': 'min-content',
        }}
      >
        <For each={shortcutApps()}>
          {(app) => (
            <button
              type="button"
              class="desktop-icon"
              onDblClick={() => launch(app.id)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span style={{ 'font-size': '30px' }}>{app.icon}</span>
              <span style={{ 'font-size': '12px' }}>{app.name}</span>
            </button>
          )}
        </For>
      </div>

      {/* Windows (painted in z-order from the framework-agnostic manager) */}
      <For each={orderedIds()}>{(id) => <Window windowId={id} />}</For>

      {/* Empty-desktop hint when nothing is open */}
      <Show when={state().windows.length === 0}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'pointer-events': 'none',
            color: 'rgba(255,255,255,0.85)',
            'text-shadow': '0 1px 8px rgba(0,0,0,0.5)',
            'text-align': 'center',
          }}
        >
          <div>
            <div style={{ 'font-size': '22px', 'font-weight': 600 }}>Iris Desktop OS</div>
            <div style={{ opacity: 0.85, 'margin-top': '6px' }}>
              Double-click an icon, press Start, or hit ⌘K — all driven by @iris-ui/core. Try
              Settings to switch skins.
            </div>
          </div>
        </div>
      </Show>

      <Launcher open={launcherOpen()} onClose={() => setLauncherOpen(false)} />
      <CommandPalette open={paletteOpen()} onClose={() => setPaletteOpen(false)} />
      <BottomBar
        launcherOpen={launcherOpen()}
        onToggleLauncher={() => setLauncherOpen((o) => !o)}
      />
    </div>
  )
}
