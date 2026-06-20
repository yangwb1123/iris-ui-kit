import { For, Show, createSignal, onCleanup, type JSX } from 'solid-js'
import { getManifest } from './catalog'
import { useWm, useWmState } from './wm'

/** A faux quick-toggle in the KDE system-tray popup (Wi-Fi / Sound / Night-Color). */
interface Toggle {
  id: string
  label: string
  icon: string
}

const TOGGLES: Toggle[] = [
  { id: 'wifi', label: 'Wi-Fi', icon: '🌐' },
  { id: 'sound', label: 'Sound', icon: '🔊' },
  { id: 'night', label: 'Night Color', icon: '🌙' },
]

/** Right-click context menu anchored to a task button. */
interface TaskMenu {
  id: string
  x: number
}

/** Shared inset glow shown on hover (KDE accent underline). */
const HOVER_LINE = 'inset 0 2px 0 0 var(--os-accent)'

/**
 * KDE Plasma panel: full-width dark bar — Kickoff launcher + LEFT-aligned,
 * LABELLED task buttons on the left, system tray + clock on the right. Mirrors
 * the React shell's Panel, here in Solid signals. The bottom bar when the skin's
 * `chrome.bottomBar === 'panel'`. Task buttons focus / minimize their window;
 * the launcher button toggles the Kickoff menu.
 */
export function Panel(props: { onToggleLauncher: () => void }): JSX.Element {
  const wm = useWm()
  const state = useWmState()
  const [now, setNow] = createSignal(new Date())
  const [trayOpen, setTrayOpen] = createSignal(false)
  const [toggles, setToggles] = createSignal<Record<string, boolean>>({
    wifi: true,
    sound: true,
    night: false,
  })
  const [taskMenu, setTaskMenu] = createSignal<TaskMenu | null>(null)
  let root: HTMLDivElement | undefined

  const t = setInterval(() => setNow(new Date()), 1000 * 30)
  onCleanup(() => clearInterval(t))

  // Click-outside closes the tray popup + the task context menu.
  const onDoc = (e: PointerEvent): void => {
    if (root && !root.contains(e.target as Node)) {
      setTrayOpen(false)
      setTaskMenu(null)
    }
  }
  document.addEventListener('pointerdown', onDoc)
  onCleanup(() => document.removeEventListener('pointerdown', onDoc))

  const onTask = (id: string): void => {
    const w = state().windows.find((x) => x.id === id)
    if (!w) return
    if (w.focused && w.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }

  return (
    <div
      ref={root}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'var(--os-bar-h)',
        display: 'flex',
        'align-items': 'stretch',
        gap: '4px',
        padding: '0 6px',
        color: 'var(--os-bar-fg)',
        background: 'var(--os-bar-bg)',
        'backdrop-filter': 'var(--os-blur)',
        '-webkit-backdrop-filter': 'var(--os-blur)',
        'border-top': '2px solid var(--os-accent)',
        'font-family': 'var(--os-font)',
      }}
    >
      <button
        type="button"
        aria-label="Application Launcher"
        class="kde-launch"
        onPointerDown={(e) => {
          e.stopPropagation()
          setTrayOpen(false)
          setTaskMenu(null)
          props.onToggleLauncher()
        }}
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '6px',
          padding: '0 12px',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          'font-weight': 600,
          'box-shadow': 'none',
          transition: 'background 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.boxShadow = HOVER_LINE
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <span style={{ 'font-size': '18px' }}>☰</span>
      </button>

      <div
        style={{
          display: 'flex',
          'align-items': 'stretch',
          gap: '4px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <For each={state().windows.filter((w) => w.workspace === state().currentWorkspace)}>
          {(w) => {
            const active = (): boolean => w.focused && w.state !== 'minimized'
            const minimized = (): boolean => w.state === 'minimized'
            return (
              <button
                type="button"
                title={w.title}
                class="kde-task"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (e.button === 2) return // handled by onContextMenu
                  setTaskMenu(null)
                  onTask(w.id)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setTrayOpen(false)
                  setTaskMenu({ id: w.id, x: e.currentTarget.offsetLeft })
                }}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '8px',
                  'max-width': '180px',
                  padding: '0 12px',
                  border: 'none',
                  'border-bottom': active()
                    ? '2px solid var(--os-accent)'
                    : '2px solid transparent',
                  background: active() ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  opacity: minimized() ? 0.6 : 1,
                  'box-shadow': 'none',
                  transition: 'background 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!active()) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.boxShadow = HOVER_LINE
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = active()
                    ? 'rgba(255,255,255,0.12)'
                    : 'transparent'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span style={{ 'font-size': '16px' }}>{getManifest(w.appId)?.icon}</span>
                <span
                  style={{
                    'font-size': '12px',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    'white-space': 'nowrap',
                  }}
                >
                  {w.title}
                </span>
              </button>
            )
          }}
        </For>
      </div>

      {/* System tray cluster — clicking toggles the quick-settings popup. */}
      <button
        type="button"
        aria-label="System Tray"
        class="kde-tray"
        onPointerDown={(e) => {
          e.stopPropagation()
          setTaskMenu(null)
          setTrayOpen((v) => !v)
        }}
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '0 12px',
          border: 'none',
          background: trayOpen() ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          'font-size': '12px',
          'box-shadow': 'none',
          transition: 'background 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={(e) => {
          if (!trayOpen()) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
          e.currentTarget.style.boxShadow = HOVER_LINE
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = trayOpen() ? 'rgba(255,255,255,0.12)' : 'transparent'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <span style={{ opacity: toggles().sound ? 1 : 0.4 }}>🔊</span>
        <span style={{ opacity: toggles().wifi ? 1 : 0.4 }}>🌐</span>
        <span>🔔</span>
      </button>

      {/* Digital clock — time over date, stacked. */}
      <div
        aria-label="Clock"
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          padding: '0 12px',
          'line-height': 1.1,
          'min-width': '64px',
        }}
      >
        <span
          style={{
            'font-size': '13px',
            'font-weight': 600,
            'font-variant-numeric': 'tabular-nums',
          }}
        >
          {now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ 'font-size': '10px', opacity: 0.7 }}>
          {now().toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Quick-settings tray popup. */}
      <Show when={trayOpen()}>
        <div
          role="menu"
          aria-label="Quick Settings"
          style={{
            position: 'absolute',
            bottom: 'calc(var(--os-bar-h) + 6px)',
            right: '6px',
            width: '240px',
            padding: '6px',
            'border-radius': '6px',
            background: 'var(--os-bar-bg)',
            color: 'var(--os-bar-fg)',
            border: '1px solid rgba(61,174,233,0.5)',
            'box-shadow': '0 14px 40px rgba(0,0,0,0.5)',
            'backdrop-filter': 'var(--os-blur)',
            '-webkit-backdrop-filter': 'var(--os-blur)',
            'z-index': 100000,
          }}
        >
          <div style={{ padding: '6px 10px 8px', 'font-size': '11px', opacity: 0.6 }}>
            Quick Settings
          </div>
          <For each={TOGGLES}>
            {(toggle) => {
              const on = (): boolean => Boolean(toggles()[toggle.id])
              return (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setToggles((s) => ({ ...s, [toggle.id]: !s[toggle.id] }))}
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    'border-radius': '4px',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    'text-align': 'left',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span
                    aria-hidden
                    style={{
                      display: 'grid',
                      'place-items': 'center',
                      width: '30px',
                      height: '30px',
                      'border-radius': '4px',
                      'font-size': '15px',
                      background: on()
                        ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
                        : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    {toggle.icon}
                  </span>
                  <span style={{ flex: 1, 'font-size': '13px' }}>{toggle.label}</span>
                  <span style={{ 'font-size': '11px', opacity: 0.7 }}>{on() ? 'On' : 'Off'}</span>
                </button>
              )
            }}
          </For>
        </div>
      </Show>

      {/* Task button right-click context menu. */}
      <Show when={taskMenu()}>
        {(menu) => (
          <div
            role="menu"
            aria-label="Task Actions"
            style={{
              position: 'absolute',
              bottom: 'calc(var(--os-bar-h) + 4px)',
              left: `${Math.max(6, menu().x)}px`,
              width: '150px',
              padding: '4px',
              'border-radius': '6px',
              background: 'var(--os-bar-bg)',
              color: 'var(--os-bar-fg)',
              border: '1px solid rgba(61,174,233,0.5)',
              'box-shadow': '0 14px 40px rgba(0,0,0,0.5)',
              'backdrop-filter': 'var(--os-blur)',
              '-webkit-backdrop-filter': 'var(--os-blur)',
              'z-index': 100000,
            }}
          >
            <For
              each={
                [
                  { label: 'Minimize', icon: '🗕', run: () => wm.minimize(menu().id) },
                  { label: 'Close', icon: '✕', run: () => wm.close(menu().id) },
                ] as const
              }
            >
              {(item) => (
                <button
                  type="button"
                  role="menuitem"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    item.run()
                    setTaskMenu(null)
                  }}
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    'border-radius': '4px',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    'text-align': 'left',
                    'font-size': '13px',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span aria-hidden style={{ width: '16px', 'text-align': 'center' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  )
}
