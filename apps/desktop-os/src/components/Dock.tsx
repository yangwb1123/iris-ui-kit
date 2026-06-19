import * as React from 'react'
import { getManifest } from '../catalog'
import { useApps, useLaunchApp, useWm, useWmState } from '../shell'

const PINNED = ['about', 'appstore', 'files', 'showcase', 'settings']

const BASE = 46 // resting icon box
const MAX_BOOST = 26 // extra px added to the icon under the cursor
const RADIUS = 110 // how far (px) the magnification reaches along the dock

/** macOS dock: centered translucent pill, pinned + running apps, running dots, hover magnification. */
export function Dock({ onToggleLauncher }: { onToggleLauncher: () => void }) {
  const wm = useWm()
  const state = useWmState()
  const apps = useApps()
  const launch = useLaunchApp()
  const available = new Set(apps.map((a) => a.id))
  const running = new Set(state.windows.map((w) => w.appId))
  // Pinned apps that are actually available + any running app not already pinned.
  const ids = [
    ...PINNED.filter((id) => available.has(id)),
    ...state.windows.map((w) => w.appId).filter((id) => !PINNED.includes(id)),
  ]
  const seen = new Set<string>()
  const items = ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))

  // Pointer X relative to the dock pill; null when the cursor isn't over it.
  const [pointerX, setPointerX] = React.useState<number | null>(null)
  // Icons that should bounce (keyed by appId) right after launch.
  const [bouncing, setBouncing] = React.useState<Set<string>>(new Set())

  const bounce = (appId: string) => {
    setBouncing((prev) => new Set(prev).add(appId))
    window.setTimeout(() => {
      setBouncing((prev) => {
        const next = new Set(prev)
        next.delete(appId)
        return next
      })
    }, 560)
  }

  const activate = (appId: string) => {
    const win = state.windows.find((w) => w.appId === appId)
    if (win) {
      if (win.focused && win.state !== 'minimized') wm.minimize(win.id)
      else wm.focus(win.id)
    } else {
      const app = getManifest(appId)
      if (!app) return
      launch(appId)
      // Only window-creating apps bounce; `link` apps open in a new tab.
      if (app.kind !== 'link') bounce(appId)
    }
  }

  /** Magnification scale (1 → 1+boost) for an icon centered at `center` px. */
  const scaleFor = (center: number): number => {
    if (pointerX == null) return 1
    const dist = Math.abs(pointerX - center)
    if (dist >= RADIUS) return 1
    // Cosine falloff: smooth, peaks at the cursor, settles to 1 at the radius.
    const t = (Math.cos((dist / RADIUS) * Math.PI) + 1) / 2
    return 1 + (MAX_BOOST / BASE) * t
  }

  // Resolve each item's running center so magnification is symmetric around the cursor.
  let cursor = 0
  const GAP = 6
  const PAD = 10
  const centers = items.map(() => {
    const c = PAD + cursor + BASE / 2
    cursor += BASE + GAP
    return c
  })

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 10,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        className="dock"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setPointerX(e.clientX - rect.left)
        }}
        onPointerLeave={() => setPointerX(null)}
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          gap: GAP,
          padding: `8px ${PAD}px`,
          background: 'var(--os-bar-bg)',
          backdropFilter: 'var(--os-blur)',
          WebkitBackdropFilter: 'var(--os-blur)',
          borderRadius: 'var(--os-bar-radius)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        {items.map((id, i) => {
          const app = getManifest(id)
          if (!app) return null
          const scale = scaleFor(centers[i] ?? 0)
          const isBouncing = bouncing.has(id)
          return (
            <button
              key={id}
              type="button"
              title={app.name}
              className="dock-item"
              onClick={() => activate(id)}
              style={{
                position: 'relative',
                width: BASE,
                height: BASE,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 30,
                lineHeight: 1,
                padding: 0,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                transition: 'transform 140ms cubic-bezier(0.25, 1, 0.5, 1)',
                transformOrigin: 'bottom center',
                transform: isBouncing
                  ? 'translateY(-22px) scale(1.08)'
                  : `scale(${scale.toFixed(3)})`,
                willChange: 'transform',
              }}
            >
              <span style={{ display: 'block' }}>{app.icon}</span>
              {running.has(id) && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--os-window-fg)',
                    opacity: 0.7,
                  }}
                />
              )}
            </button>
          )
        })}
        <span
          style={{
            width: 1,
            alignSelf: 'stretch',
            margin: '4px 4px',
            background: 'rgba(0,0,0,0.18)',
          }}
        />
        <button
          type="button"
          title="Launchpad"
          className="dock-item"
          onClick={onToggleLauncher}
          style={{
            width: BASE,
            height: BASE,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 28,
            padding: 0,
            transition: 'transform 140ms cubic-bezier(0.25, 1, 0.5, 1)',
            transformOrigin: 'bottom center',
          }}
          onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.35)')}
          onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🚀
        </button>
      </div>
    </div>
  )
}
