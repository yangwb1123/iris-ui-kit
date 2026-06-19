import { getApp } from '../apps'
import { useWm, useWmState } from '../shell'

const PINNED = ['about', 'files', 'notepad', 'showcase', 'settings']

/** macOS dock: centered translucent pill, pinned + running apps, running dots. */
export function Dock({ onToggleLauncher }: { onToggleLauncher: () => void }) {
  const wm = useWm()
  const state = useWmState()
  const running = new Set(state.windows.map((w) => w.appId))
  const ids = [...PINNED, ...state.windows.map((w) => w.appId).filter((id) => !PINNED.includes(id))]
  const seen = new Set<string>()
  const items = ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))

  const activate = (appId: string) => {
    const win = state.windows.find((w) => w.appId === appId)
    if (win) {
      if (win.focused && win.state !== 'minimized') wm.minimize(win.id)
      else wm.focus(win.id)
    } else {
      const app = getApp(appId)
      if (app) wm.open({ appId, title: app.name, rect: app.defaultSize })
    }
  }

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
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          padding: '8px 10px',
          background: 'var(--os-bar-bg)',
          backdropFilter: 'var(--os-blur)',
          WebkitBackdropFilter: 'var(--os-blur)',
          borderRadius: 'var(--os-bar-radius)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        {items.map((id) => {
          const app = getApp(id)
          if (!app) return null
          return (
            <button
              key={id}
              type="button"
              title={app.name}
              className="dock-item"
              onClick={() => activate(id)}
              style={{
                position: 'relative',
                width: 46,
                height: 46,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 30,
                lineHeight: 1,
                padding: 0,
              }}
            >
              {app.icon}
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
            width: 46,
            height: 46,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 28,
            padding: 0,
          }}
        >
          🚀
        </button>
      </div>
    </div>
  )
}
