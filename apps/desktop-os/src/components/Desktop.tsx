import * as React from 'react'
import { type SnapZone } from '@iris-ui/core/window'
import { APPS } from '../apps'
import { OS_ORDER, CHROMES } from '../os'
import { useOs, useWm, useWmState } from '../shell'
import { Window } from './Window'
import { SnapPreview } from './SnapPreview'
import { TopBar, BottomBar, Launcher } from './Bars'
import { ContextMenu, type MenuItem } from './ContextMenu'

/** Desktop shortcuts shown top-left; double-click opens the app. */
const SHORTCUTS = ['about', 'files', 'showcase', 'settings']

export function Desktop() {
  const wm = useWm()
  const state = useWmState()
  const { setOs } = useOs()
  const [launcherOpen, setLauncherOpen] = React.useState(false)
  // Live drag-to-edge snap zone (lifted from Window) → drives the snap preview.
  const [snapHint, setSnapHint] = React.useState<SnapZone | null>(null)
  // Right-click desktop menu anchor (null = closed).
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)

  const open = (appId: string) => {
    const app = APPS.find((a) => a.id === appId)
    if (app) wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
  }

  const desktopMenuItems: MenuItem[] = [
    ...OS_ORDER.map(
      (id): MenuItem => ({ label: `Use ${CHROMES[id].label}`, onClick: () => setOs(id) }),
    ),
    { separator: true },
    { label: 'Display settings', onClick: () => open('settings') },
    { label: 'Refresh', onClick: () => setMenu(null) },
  ]

  // Desktop keyboard shortcuts: Alt+Tab cycles focus, Meta+Space toggles the
  // launcher, Escape closes it. Registered once; cleaned up on unmount.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        // Next non-minimized window by ascending z-order, wrapping around.
        const cyclable = wm.ordered().filter((w) => w.state !== 'minimized')
        if (cyclable.length === 0) return
        const focusedId = wm.getState().focusedId
        const idx = cyclable.findIndex((w) => w.id === focusedId)
        const next = cyclable[(idx + 1) % cyclable.length]
        wm.focus(next.id)
        return
      }
      if (e.metaKey && e.code === 'Space') {
        e.preventDefault()
        setLauncherOpen((o) => !o)
        return
      }
      if (e.key === 'Escape') {
        setLauncherOpen((o) => {
          if (o) e.preventDefault()
          return false
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [wm])

  return (
    <div
      // Click on empty desktop dismisses the launcher.
      onPointerDown={() => setLauncherOpen(false)}
      // Right-click anywhere on the desktop surface opens the desktop menu.
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
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

      {/* Drag-to-edge snap preview — behind windows (z 0), above the wallpaper */}
      <SnapPreview zone={snapHint} />

      {/* Windows (painted in z-order) */}
      {wm.ordered().map((w) => (
        <Window key={w.id} window={w} onSnapHint={setSnapHint} />
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

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={desktopMenuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
