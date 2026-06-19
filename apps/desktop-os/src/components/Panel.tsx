import * as React from 'react'
import { getApp } from '../apps'
import { useWm, useWmState } from '../shell'

/** KDE Plasma panel: full-width dark bar — Kickoff + labelled tasks left, tray + clock right. */
export function Panel({ onToggleLauncher }: { onToggleLauncher: () => void }) {
  const wm = useWm()
  const state = useWmState()
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(t)
  }, [])

  const onTask = (id: string) => {
    const w = state.windows.find((x) => x.id === id)
    if (!w) return
    if (w.focused && w.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }

  return (
    <div
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
      }}
    >
      <button
        type="button"
        aria-label="Application Launcher"
        className="kde-launch"
        onPointerDown={(e) => {
          e.stopPropagation()
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
        }}
      >
        <span style={{ fontSize: 18 }}>☰</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, flex: 1, overflow: 'hidden' }}>
        {state.windows.map((w) => {
          const active = w.focused && w.state !== 'minimized'
          return (
            <button
              key={w.id}
              type="button"
              title={w.title}
              onPointerDown={(e) => {
                e.stopPropagation()
                onTask(w.id)
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
              }}
            >
              <span style={{ fontSize: 16 }}>{getApp(w.appId)?.icon}</span>
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
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', fontSize: 12 }}
      >
        <span style={{ opacity: 0.85 }}>🔊 🌐 🔔</span>
        <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  )
}
