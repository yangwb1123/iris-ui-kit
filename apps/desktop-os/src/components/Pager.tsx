import { useWm, useWmState } from '../shell'

/**
 * Virtual-desktop PAGER — a compact switcher for the window manager's workspaces
 * (GNOME/KDE pager feel). Shows one pip per desktop, highlights the active one,
 * marks desktops that have windows, and switches on click. Renders nothing when
 * there's only a single workspace (the feature is opt-in via the WM config).
 * Token-skinned to the active OS; sits top-center above windows.
 */
export function Pager() {
  const wm = useWm()
  const state = useWmState()
  if (state.workspaces <= 1) return null

  return (
    <div
      role="tablist"
      aria-label="Virtual desktops"
      style={{
        position: 'absolute',
        top: 'calc(var(--os-topbar-h, 0px) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 80000,
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: 'var(--os-window-bg)',
        border: 'var(--os-window-border)',
        boxShadow: 'var(--os-window-shadow)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
      }}
    >
      {Array.from({ length: state.workspaces }, (_, i) => {
        const active = i === state.currentWorkspace
        const hasWindows = state.windows.some((w) => w.workspace === i)
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Desktop ${i + 1}`}
            title={`Desktop ${i + 1}`}
            onClick={() => wm.setWorkspace(i)}
            style={{
              width: 26,
              height: 20,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              lineHeight: '18px',
              color: active ? '#fff' : 'inherit',
              border: hasWindows ? '1px solid var(--os-accent)' : '1px solid rgba(127,127,127,0.4)',
              background: active
                ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
                : 'transparent',
            }}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
