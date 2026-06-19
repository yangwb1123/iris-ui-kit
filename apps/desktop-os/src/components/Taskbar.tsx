import * as React from 'react'
import { getApp } from '../apps'
import { useOs, useWm, useWmState } from '../shell'

function Clock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(t)
  }, [])
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })
  return (
    <div style={{ textAlign: 'right', fontSize: 12, lineHeight: 1.25, padding: '0 12px' }}>
      <div>{time}</div>
      <div>{date}</div>
    </div>
  )
}

export function Taskbar({
  startOpen,
  onToggleStart,
}: {
  startOpen: boolean
  onToggleStart: () => void
}) {
  const wm = useWm()
  const { chrome } = useOs()
  const state = useWmState()

  const onTaskClick = (id: string) => {
    const w = state.windows.find((x) => x.id === id)
    if (!w) return
    // Active + visible → minimize; otherwise focus/restore (taskbar toggle).
    if (w.focused && w.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }

  const startBtn = (
    <button
      type="button"
      aria-label="Start"
      aria-pressed={startOpen}
      className="task-btn task-btn--start"
      onPointerDown={(e) => {
        e.stopPropagation()
        onToggleStart()
      }}
      style={{ fontSize: 18 }}
    >
      {chrome.id === 'macos' ? '' : '⊞'}
    </button>
  )

  const taskButtons = state.windows.map((w) => {
    const app = getApp(w.appId)
    const active = w.focused && w.state !== 'minimized'
    return (
      <button
        key={w.id}
        type="button"
        title={w.title}
        className={`task-btn${active ? ' task-btn--active' : ''}`}
        onPointerDown={(e) => {
          e.stopPropagation()
          onTaskClick(w.id)
        }}
      >
        <span style={{ fontSize: 18 }}>{app?.icon}</span>
        {chrome.taskLabels && (
          <span
            style={{
              fontSize: 12,
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {w.title}
          </span>
        )}
      </button>
    )
  })

  const cluster = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: chrome.bar === 'dock' ? 10 : 4,
        padding: chrome.bar === 'dock' ? '0 12px' : '0 6px',
        ...(chrome.bar === 'dock'
          ? {
              background: 'var(--os-bar-bg)',
              backdropFilter: 'var(--os-blur)',
              WebkitBackdropFilter: 'var(--os-blur)',
              borderRadius: 'var(--os-bar-radius)',
              height: 'calc(var(--os-bar-h) - 8px)',
              border: '1px solid rgba(255,255,255,0.25)',
            }
          : {}),
      }}
    >
      {startBtn}
      {taskButtons}
    </div>
  )

  const aligned = chrome.taskAlign === 'center'

  return (
    <div
      className="taskbar"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: chrome.bar === 'dock' ? 0 : 0,
        right: 0,
        bottom: chrome.bar === 'dock' ? 8 : 0,
        height: 'var(--os-bar-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: aligned ? 'center' : 'flex-start',
        color: 'var(--os-bar-fg)',
        ...(chrome.bar === 'dock'
          ? { background: 'transparent' }
          : {
              background: 'var(--os-bar-bg)',
              backdropFilter: 'var(--os-blur)',
              WebkitBackdropFilter: 'var(--os-blur)',
              borderTop: '1px solid rgba(255,255,255,0.18)',
            }),
      }}
    >
      {/* center cluster */}
      <div
        style={{
          position: aligned ? 'static' : 'relative',
          flex: aligned ? '0 0 auto' : 1,
          display: 'flex',
          justifyContent: aligned ? 'center' : 'flex-start',
        }}
      >
        {cluster}
      </div>
      {/* right system tray (hidden for centered dock) */}
      {chrome.bar !== 'dock' && (
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
      )}
    </div>
  )
}
