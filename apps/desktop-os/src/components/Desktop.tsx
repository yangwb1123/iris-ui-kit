import * as React from 'react'
import { APPS } from '../apps'
import { useWm, useWmState } from '../shell'
import { Window } from './Window'
import { TopBar, BottomBar, Launcher } from './Bars'

/** Desktop shortcuts shown top-left; double-click opens the app. */
const SHORTCUTS = ['about', 'files', 'showcase', 'settings']

export function Desktop() {
  const wm = useWm()
  const state = useWmState()
  const [launcherOpen, setLauncherOpen] = React.useState(false)

  const open = (appId: string) => {
    const app = APPS.find((a) => a.id === appId)
    if (app) wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
  }

  return (
    <div
      // Click on empty desktop dismisses the launcher.
      onPointerDown={() => setLauncherOpen(false)}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <TopBar />
      {/* Desktop icons */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'grid',
          gap: 6,
          gridAutoRows: 'min-content',
        }}
      >
        {SHORTCUTS.map((id) => {
          const app = APPS.find((a) => a.id === id)
          if (!app) return null
          return (
            <button
              key={id}
              type="button"
              className="desktop-icon"
              onDoubleClick={() => open(id)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span style={{ fontSize: 30 }}>{app.icon}</span>
              <span style={{ fontSize: 12 }}>{app.name}</span>
            </button>
          )
        })}
      </div>

      {/* Windows (painted in z-order) */}
      {wm.ordered().map((w) => (
        <Window key={w.id} window={w} />
      ))}

      {/* Empty-desktop hint when nothing is open */}
      {state.windows.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>Iris Desktop OS</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              Double-click an icon, or press Start. Try Settings to switch skins.
            </div>
          </div>
        </div>
      )}

      <Launcher open={launcherOpen} onClose={() => setLauncherOpen(false)} />
      <BottomBar launcherOpen={launcherOpen} onToggleLauncher={() => setLauncherOpen((o) => !o)} />
    </div>
  )
}
