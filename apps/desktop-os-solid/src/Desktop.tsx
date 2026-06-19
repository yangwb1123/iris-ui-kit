import { For, Show, createMemo, createSignal, type JSX } from 'solid-js'
import { APPS } from './apps'
import { useWm, useWmState } from './wm'
import { Window } from './Window'
import { Taskbar } from './Taskbar'
import { StartMenu } from './StartMenu'

/** Desktop shortcuts shown top-left; double-click opens the app. */
const SHORTCUTS = ['about', 'files', 'notepad', 'showcase']

export function Desktop(): JSX.Element {
  const wm = useWm()
  const state = useWmState()
  const [launcherOpen, setLauncherOpen] = createSignal(false)

  // Window IDs in z-order — derived from the live store signal so opening,
  // closing and raising windows re-renders the desktop. Keying the `<For>` by
  // stable id (not the immutable window object, which is replaced on every
  // store update) keeps each window's DOM + per-window state across reorders.
  const orderedIds = createMemo(() =>
    [...state().windows].sort((a, b) => a.z - b.z).map((w) => w.id),
  )

  const open = (appId: string): void => {
    const app = APPS.find((a) => a.id === appId)
    if (app) wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
  }

  return (
    <div
      // Click on empty desktop dismisses the launcher.
      onPointerDown={() => setLauncherOpen(false)}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
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
        <For each={SHORTCUTS}>
          {(id) => {
            const app = APPS.find((a) => a.id === id)
            return (
              <Show when={app}>
                {(a) => (
                  <button
                    type="button"
                    class="desktop-icon"
                    onDblClick={() => open(id)}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <span style={{ 'font-size': '30px' }}>{a().icon}</span>
                    <span style={{ 'font-size': '12px' }}>{a().name}</span>
                  </button>
                )}
              </Show>
            )
          }}
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
              Double-click an icon, or press Start — all driven by @iris-ui/core/window.
            </div>
          </div>
        </div>
      </Show>

      <StartMenu open={launcherOpen()} onClose={() => setLauncherOpen(false)} />
      <Taskbar launcherOpen={launcherOpen()} onToggleLauncher={() => setLauncherOpen((o) => !o)} />
    </div>
  )
}
