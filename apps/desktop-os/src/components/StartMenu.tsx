import * as React from 'react'
import { useApps, useLaunchApp, useOs } from '../shell'

/** App launcher / Start menu — search filters the app grid; click opens a window. */
export function StartMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const apps = useApps()
  const launchApp = useLaunchApp()
  const { chrome } = useOs()
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setQuery('')
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const results = q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps

  const launch = (appId: string) => {
    launchApp(appId)
    onClose()
  }

  const alignLeft = chrome.taskAlign === 'left'

  return (
    <div
      className="startmenu"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 'calc(var(--os-bar-h) + 10px)',
        left: alignLeft ? 12 : '50%',
        transform: alignLeft ? 'none' : 'translateX(-50%)',
        width: 'min(560px, 92vw)',
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 18,
        borderRadius: 14,
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        boxShadow: 'var(--os-window-shadow)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        zIndex: 100000,
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search apps…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 14px',
          borderRadius: 999,
          border: '1px solid rgba(127,127,127,0.35)',
          background: 'rgba(255,255,255,0.6)',
          color: 'inherit',
          outline: 'none',
          fontSize: 14,
        }}
      />
      <div style={{ fontSize: 12, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {q ? `${results.length} result(s)` : 'All apps'}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 10,
          overflow: 'auto',
        }}
      >
        {results.map((app) => (
          <button key={app.id} type="button" onClick={() => launch(app.id)} className="launch-tile">
            <span style={{ fontSize: 28 }}>{app.icon}</span>
            <span style={{ fontSize: 12, textAlign: 'center' }}>{app.name}</span>
          </button>
        ))}
        {results.length === 0 && (
          <div style={{ opacity: 0.6, gridColumn: '1 / -1', padding: 16 }}>
            No apps match “{query}”.
          </div>
        )}
      </div>
    </div>
  )
}
