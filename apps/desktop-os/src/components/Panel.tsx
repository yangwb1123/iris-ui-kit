import * as React from 'react'
import { getManifest } from '../catalog'
import { useWm, useWmState } from '../shell'

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

/** KDE Plasma panel: full-width dark bar — Kickoff + labelled tasks left, tray + clock right. */
export function Panel({ onToggleLauncher }: { onToggleLauncher: () => void }) {
  const wm = useWm()
  const state = useWmState()
  const [now, setNow] = React.useState(() => new Date())
  const [trayOpen, setTrayOpen] = React.useState(false)
  const [toggles, setToggles] = React.useState<Record<string, boolean>>({
    wifi: true,
    sound: true,
    night: false,
  })
  const [taskMenu, setTaskMenu] = React.useState<TaskMenu | null>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(t)
  }, [])

  // Click-outside closes the tray popup + the task context menu.
  React.useEffect(() => {
    if (!trayOpen && !taskMenu) return
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setTrayOpen(false)
        setTaskMenu(null)
      }
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [trayOpen, taskMenu])

  const onTask = (id: string) => {
    const w = state.windows.find((x) => x.id === id)
    if (!w) return
    if (w.focused && w.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }

  const hoverLine = 'inset 0 2px 0 0 var(--os-accent)'

  return (
    <div
      ref={rootRef}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'var(--os-bar-h)',
        display: 'flex',
        alignItems: 'stretch',
        gap: 4,
        padding: '0 6px',
        color: 'var(--os-bar-fg)',
        background: 'var(--os-bar-bg)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        borderTop: '2px solid var(--os-accent)',
        fontFamily: 'var(--os-font)',
      }}
    >
      <button
        type="button"
        aria-label="Application Launcher"
        className="kde-launch"
        onPointerDown={(e) => {
          e.stopPropagation()
          setTrayOpen(false)
          setTaskMenu(null)
          onToggleLauncher()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontWeight: 600,
          boxShadow: 'none',
          transition: 'background 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.boxShadow = hoverLine
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <span style={{ fontSize: 18 }}>☰</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, flex: 1, overflow: 'hidden' }}>
        {state.windows
          .filter((w) => w.workspace === state.currentWorkspace)
          .map((w) => {
            const active = w.focused && w.state !== 'minimized'
            const minimized = w.state === 'minimized'
            return (
              <button
                key={w.id}
                type="button"
                title={w.title}
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
                  alignItems: 'center',
                  gap: 8,
                  maxWidth: 180,
                  padding: '0 12px',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--os-accent)' : '2px solid transparent',
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  opacity: minimized ? 0.6 : 1,
                  boxShadow: 'none',
                  transition: 'background 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.boxShadow = hoverLine
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = active
                    ? 'rgba(255,255,255,0.12)'
                    : 'transparent'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span style={{ fontSize: 16 }}>{getManifest(w.appId)?.icon}</span>
                <span
                  style={{
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w.title}
                </span>
              </button>
            )
          })}
      </div>

      {/* System tray cluster — clicking toggles the quick-settings popup. */}
      <button
        type="button"
        aria-label="System Tray"
        className="kde-tray"
        onPointerDown={(e) => {
          e.stopPropagation()
          setTaskMenu(null)
          setTrayOpen((v) => !v)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          border: 'none',
          background: trayOpen ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: 12,
          boxShadow: 'none',
          transition: 'background 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={(e) => {
          if (!trayOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
          e.currentTarget.style.boxShadow = hoverLine
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = trayOpen ? 'rgba(255,255,255,0.12)' : 'transparent'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <span style={{ opacity: toggles.sound ? 1 : 0.4 }}>🔊</span>
        <span style={{ opacity: toggles.wifi ? 1 : 0.4 }}>🌐</span>
        <span>🔔</span>
      </button>

      {/* Digital clock — time over date, stacked. */}
      <div
        aria-label="Clock"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
          lineHeight: 1.1,
          minWidth: 64,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>
          {now.toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Quick-settings tray popup. */}
      {trayOpen && (
        <div
          role="menu"
          aria-label="Quick Settings"
          style={{
            position: 'absolute',
            bottom: 'calc(var(--os-bar-h) + 6px)',
            right: 6,
            width: 240,
            padding: 6,
            borderRadius: 6,
            background: 'var(--os-bar-bg)',
            color: 'var(--os-bar-fg)',
            border: '1px solid rgba(61,174,233,0.5)',
            boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
            backdropFilter: 'var(--os-blur)',
            WebkitBackdropFilter: 'var(--os-blur)',
            zIndex: 100000,
          }}
        >
          <div style={{ padding: '6px 10px 8px', fontSize: 11, opacity: 0.6 }}>Quick Settings</div>
          {TOGGLES.map((t) => {
            const on = toggles[t.id]
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setToggles((s) => ({ ...s, [t.id]: !s[t.id] }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 4,
                    fontSize: 15,
                    background: on
                      ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
                      : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {t.icon}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{t.label}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>{on ? 'On' : 'Off'}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Task button right-click context menu. */}
      {taskMenu && (
        <div
          role="menu"
          aria-label="Task Actions"
          style={{
            position: 'absolute',
            bottom: 'calc(var(--os-bar-h) + 4px)',
            left: Math.max(6, taskMenu.x),
            width: 150,
            padding: 4,
            borderRadius: 6,
            background: 'var(--os-bar-bg)',
            color: 'var(--os-bar-fg)',
            border: '1px solid rgba(61,174,233,0.5)',
            boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
            backdropFilter: 'var(--os-blur)',
            WebkitBackdropFilter: 'var(--os-blur)',
            zIndex: 100000,
          }}
        >
          {(
            [
              { label: 'Minimize', icon: '🗕', run: () => wm.minimize(taskMenu.id) },
              { label: 'Close', icon: '✕', run: () => wm.close(taskMenu.id) },
            ] as const
          ).map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                item.run()
                setTaskMenu(null)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                border: 'none',
                borderRadius: 4,
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span aria-hidden style={{ width: 16, textAlign: 'center' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
