import * as React from 'react'
import { APPS } from '../apps'
import { useWm } from '../shell'

/** KDE Kickoff: bottom-left application launcher with search + list. */
export function Kickoff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const wm = useWm()
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
  const results = q ? APPS.filter((a) => a.name.toLowerCase().includes(q)) : APPS
  const launch = (id: string) => {
    const app = APPS.find((a) => a.id === id)
    if (app) wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
    onClose()
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 'calc(var(--os-bar-h) + 6px)',
        left: 6,
        width: 360,
        maxHeight: '64vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--os-bar-bg)',
        color: 'var(--os-bar-fg)',
        border: '1px solid rgba(61,174,233,0.5)',
        boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        zIndex: 100000,
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) launch(results[0].id)
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Search…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid rgba(61,174,233,0.5)',
            background: 'rgba(0,0,0,0.25)',
            color: 'inherit',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ overflow: 'auto', padding: 6 }}>
        {results.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => launch(app.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--os-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 22 }}>{app.icon}</span>
            {app.name}
          </button>
        ))}
        {results.length === 0 && (
          <div style={{ padding: 12, opacity: 0.6 }}>No applications found.</div>
        )}
      </div>
    </div>
  )
}
