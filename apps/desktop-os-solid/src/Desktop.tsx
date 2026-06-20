import { For, Show, createMemo, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { useApps, useLaunchApp } from './profile'
import { useWm, useWmState } from './wm'
import { registerCommands, useDesktopCommands } from './commands'
import { Window } from './Window'
import { Taskbar } from './Taskbar'
import { StartMenu } from './StartMenu'
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

export function Desktop(): JSX.Element {
  const wm = useWm()
  const state = useWmState()
  const apps = useApps()
  const launch = useLaunchApp()
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

      {/* Desktop icons */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
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
              Double-click an icon, press Start, or hit ⌘K — all driven by @iris-ui/core.
            </div>
          </div>
        </div>
      </Show>

      <StartMenu open={launcherOpen()} onClose={() => setLauncherOpen(false)} />
      <CommandPalette open={paletteOpen()} onClose={() => setPaletteOpen(false)} />
      <Taskbar launcherOpen={launcherOpen()} onToggleLauncher={() => setLauncherOpen((o) => !o)} />
    </div>
  )
}
