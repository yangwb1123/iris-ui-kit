import * as React from 'react'
import { useApps, useLaunchApp } from '../shell'

/** macOS Spotlight: centered search overlay; type to filter, Enter/click to open, with preview. */
export function Spotlight({ open, onClose }: { open: boolean; onClose: () => void }) {
  const apps = useApps()
  const launchApp = useLaunchApp()
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  // Drives the scale/opacity entrance; flipped on after mount so CSS transitions in.
  const [shown, setShown] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
      const r = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    return undefined
  }, [open])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const results = q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps
  const selected = results[Math.min(active, results.length - 1)]

  const launch = (id: string) => {
    launchApp(id)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selected) launch(selected.id)
    else if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    }
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
          width: 'min(680px, 92vw)',
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
          transformOrigin: 'top center',
          transform: shown ? 'scale(1)' : 'scale(0.96)',
          opacity: shown ? 1 : 0,
          transition: 'transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 160ms ease',
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
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
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

        <div style={{ display: 'flex', minHeight: 0 }}>
          {/* Results list */}
          <div
            style={{ flex: 1, overflow: 'auto', borderRight: '1px solid rgba(127,127,127,0.18)' }}
          >
            <div
              style={{
                padding: '8px 18px 4px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                opacity: 0.45,
              }}
            >
              Applications
            </div>
            {results.map((app, i) => {
              const isActive = i === Math.min(active, results.length - 1)
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => launch(app.id)}
                  onPointerEnter={() => setActive(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '9px 18px',
                    border: 'none',
                    background: isActive
                      ? 'color-mix(in srgb, var(--os-accent) 22%, transparent)'
                      : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 15,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{app.icon}</span>
                  {app.name}
                </button>
              )
            })}
            {results.length === 0 && <div style={{ padding: 18, opacity: 0.6 }}>No results.</div>}
          </div>

          {/* Preview column for the selected result */}
          <div
            style={{
              width: 220,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '24px 16px',
              textAlign: 'center',
            }}
          >
            {selected ? (
              <>
                <div style={{ fontSize: 64, lineHeight: 1 }}>{selected.icon}</div>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{selected.name}</div>
                <div style={{ fontSize: 12, opacity: 0.55 }}>Application</div>
              </>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.45 }}>No selection</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
