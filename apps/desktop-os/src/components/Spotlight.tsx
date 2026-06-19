import * as React from 'react'
import { APPS } from '../apps'
import { useWm } from '../shell'

/** macOS Spotlight: centered search overlay; type to filter, Enter/click to open. */
export function Spotlight({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      onPointerDown={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '18vh',
        background: 'rgba(0,0,0,0.06)',
        zIndex: 100000,
      }}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(620px, 92vw)',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--os-window-bg)',
          color: 'var(--os-window-fg)',
          border: 'var(--os-window-border)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          backdropFilter: 'var(--os-blur)',
          WebkitBackdropFilter: 'var(--os-blur)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid rgba(127,127,127,0.2)',
          }}
        >
          <span style={{ fontSize: 22, opacity: 0.6 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) launch(results[0].id)
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Spotlight Search"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'inherit',
              fontSize: 22,
            }}
          />
        </div>
        <div style={{ overflow: 'auto' }}>
          {results.map((app, i) => (
            <button
              key={app.id}
              type="button"
              onClick={() => launch(app.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 18px',
                border: 'none',
                background:
                  i === 0 ? 'color-mix(in srgb, var(--os-accent) 22%, transparent)' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 15,
              }}
            >
              <span style={{ fontSize: 22 }}>{app.icon}</span>
              {app.name}
            </button>
          ))}
          {results.length === 0 && <div style={{ padding: 18, opacity: 0.6 }}>No results.</div>}
        </div>
      </div>
    </div>
  )
}
