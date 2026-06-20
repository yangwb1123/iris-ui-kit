import { For, Show, type JSX } from 'solid-js'
import { useWm, useWmState } from './wm'

/**
 * Virtual-desktop PAGER — a compact switcher for the window manager's workspaces
 * (GNOME/KDE pager feel). Shows one pip per desktop, highlights the active one,
 * marks desktops that have windows, and switches on click. Renders nothing when
 * there's only a single workspace (the feature is opt-in via the WM config).
 * Token-skinned to the active OS; sits top-center above windows. Mirrors the
 * React shell's Pager, here in Solid signals (state read via `useWmState`).
 */
export function Pager(): JSX.Element {
  const wm = useWm()
  const state = useWmState()

  return (
    <Show when={state().workspaces > 1}>
      <div
        role="tablist"
        aria-label="Virtual desktops"
        style={{
          position: 'absolute',
          top: 'calc(var(--os-topbar-h, 0px) + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          'z-index': 80000,
          display: 'flex',
          gap: '4px',
          padding: '4px',
          'border-radius': '999px',
          background: 'var(--os-window-bg)',
          border: 'var(--os-window-border)',
          'box-shadow': 'var(--os-window-shadow)',
          'backdrop-filter': 'var(--os-blur)',
          '-webkit-backdrop-filter': 'var(--os-blur)',
        }}
      >
        <For each={Array.from({ length: state().workspaces }, (_, i) => i)}>
          {(i) => {
            const active = (): boolean => i === state().currentWorkspace
            const hasWindows = (): boolean => state().windows.some((w) => w.workspace === i)
            return (
              <button
                type="button"
                role="tab"
                aria-selected={active()}
                aria-label={`Desktop ${i + 1}`}
                title={`Desktop ${i + 1}`}
                onClick={() => wm.setWorkspace(i)}
                style={{
                  width: '26px',
                  height: '20px',
                  'border-radius': '6px',
                  cursor: 'pointer',
                  'font-size': '11px',
                  'line-height': '18px',
                  color: active() ? '#fff' : 'inherit',
                  border: hasWindows()
                    ? '1px solid var(--os-accent)'
                    : '1px solid rgba(127,127,127,0.4)',
                  background: active()
                    ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
                    : 'transparent',
                }}
              >
                {i + 1}
              </button>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
