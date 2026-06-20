import * as React from 'react'
import { getManifest } from '../catalog'
import { useWm, useWmState } from '../shell'

function Clock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ textAlign: 'right', fontSize: 12, lineHeight: 1.25, padding: '0 14px' }}>
      <div>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div>{now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
    </div>
  )
}

/** Windows 11 taskbar: centered Start + running apps; clock pinned right. */
export function Taskbar({
  launcherOpen,
  onToggleLauncher,
}: {
  launcherOpen: boolean
  onToggleLauncher: () => void
}) {
  const wm = useWm()
  const state = useWmState()

  const onTask = (id: string) => {
    const w = state.windows.find((x) => x.id === id)
    if (!w) return
    if (w.focused && w.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }

  return (
    <div
      className="taskbar"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'var(--os-bar-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--os-bar-fg)',
        background: 'var(--os-bar-bg)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        borderTop: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          aria-label="Start"
          aria-pressed={launcherOpen}
          className="task-btn task-btn--start"
          onPointerDown={(e) => {
            e.stopPropagation()
            onToggleLauncher()
          }}
          style={{ fontSize: 18 }}
        >
          ⊞
        </button>
        {state.windows
          .filter((w) => w.workspace === state.currentWorkspace)
          .map((w) => {
            const active = w.focused && w.state !== 'minimized'
            return (
              <button
                key={w.id}
                type="button"
                title={w.title}
                className={`task-btn${active ? ' task-btn--active' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onTask(w.id)
                }}
              >
                <span style={{ fontSize: 18 }}>{getManifest(w.appId)?.icon}</span>
              </button>
            )
          })}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Clock />
      </div>
    </div>
  )
}
