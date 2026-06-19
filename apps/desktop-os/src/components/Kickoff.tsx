import * as React from 'react'
import { type AppManifest } from '../catalog'
import { useApps, useLaunchApp } from '../shell'

/** A left-rail category in the Kickoff launcher. */
interface Category {
  id: string
  label: string
  icon: string
  /** App ids this category contains; undefined = all applications. */
  apps?: string[]
}

const FAVORITE_IDS = ['files', 'notepad', 'settings']

const CATEGORIES: Category[] = [
  { id: 'favorites', label: 'Favorites', icon: '⭐', apps: FAVORITE_IDS },
  { id: 'all', label: 'All Applications', icon: '🗂️' },
  { id: 'utilities', label: 'Utilities', icon: '🛠️', apps: ['files', 'notepad', 'taskmgr'] },
  { id: 'system', label: 'System', icon: '⚙️', apps: ['settings', 'about', 'taskmgr'] },
]

/** KDE Kickoff: bottom-left application launcher — user header, search, category rail + app list. */
export function Kickoff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const apps = useApps()
  const launchApp = useLaunchApp()
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState('favorites')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setCategory('favorites')
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[1]
  // Searching spans every app; otherwise scope to the selected category.
  const scoped = q
    ? apps
    : cat.apps
      ? cat.apps
          .map((id) => apps.find((a) => a.id === id))
          .filter((a): a is AppManifest => Boolean(a))
      : apps
  const results = q ? scoped.filter((a) => a.name.toLowerCase().includes(q)) : scoped

  const launch = (id: string) => {
    launchApp(id)
    onClose()
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 'calc(var(--os-bar-h) + 6px)',
        left: 6,
        width: 440,
        height: '62vh',
        maxHeight: 520,
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
        fontFamily: 'var(--os-font)',
        zIndex: 100000,
      }}
    >
      {/* User header. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.18)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            fontSize: 20,
            color: '#fff',
            background:
              'linear-gradient(135deg, var(--os-accent) 0%, var(--os-accent-strong) 100%)',
          }}
        >
          👤
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <strong style={{ fontSize: 14 }}>user@iris-os</strong>
          <span style={{ fontSize: 11, opacity: 0.65 }}>Plasma Desktop</span>
        </div>
      </div>

      {/* Search box. */}
      <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) launch(results[0].id)
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Search applications…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid rgba(61,174,233,0.5)',
            background: 'rgba(0,0,0,0.25)',
            color: 'inherit',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Body: category rail (left) + app list (right). */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          role="tablist"
          aria-label="Categories"
          style={{
            width: 140,
            flexShrink: 0,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.12)',
            overflow: 'auto',
          }}
        >
          {CATEGORIES.map((c) => {
            const selected = !q && c.id === category
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={Boolean(q)}
                onClick={() => setCategory(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  borderLeft: selected ? '3px solid var(--os-accent)' : '3px solid transparent',
                  borderRadius: 4,
                  background: selected
                    ? 'color-mix(in srgb, var(--os-accent) 22%, transparent)'
                    : 'transparent',
                  color: 'inherit',
                  cursor: q ? 'default' : 'pointer',
                  opacity: q ? 0.4 : 1,
                  textAlign: 'left',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!selected && !q) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span aria-hidden style={{ fontSize: 15 }}>
                  {c.icon}
                </span>
                {c.label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
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
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--os-accent)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'inherit'
              }}
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
    </div>
  )
}
