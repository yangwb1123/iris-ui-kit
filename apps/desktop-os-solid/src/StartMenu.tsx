import { For, Show, createMemo, createSignal, type JSX } from 'solid-js'
import { APPS } from './apps'
import { useWm } from './wm'

/** App launcher / Start menu — search filters the app grid; click opens a window. */
export function StartMenu(props: { open: boolean; onClose: () => void }): JSX.Element {
  const wm = useWm()
  const [query, setQuery] = createSignal('')

  const results = createMemo(() => {
    const q = query().trim().toLowerCase()
    return q ? APPS.filter((a) => a.name.toLowerCase().includes(q)) : APPS
  })

  const launch = (appId: string): void => {
    const app = APPS.find((a) => a.id === appId)
    if (!app) return
    wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
    props.onClose()
  }

  return (
    <Show when={props.open}>
      <div
        class="startmenu"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 'calc(var(--os-bar-h) + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(560px, 92vw)',
          'max-height': '60vh',
          display: 'flex',
          'flex-direction': 'column',
          gap: '14px',
          padding: '18px',
          'border-radius': '14px',
          background: 'var(--os-window-bg)',
          color: 'var(--os-window-fg)',
          border: 'var(--os-window-border)',
          'box-shadow': 'var(--os-window-shadow)',
          'backdrop-filter': 'var(--os-blur)',
          '-webkit-backdrop-filter': 'var(--os-blur)',
          'z-index': 100000,
        }}
      >
        <input
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search apps…"
          style={{
            width: '100%',
            'box-sizing': 'border-box',
            padding: '10px 14px',
            'border-radius': '999px',
            border: '1px solid rgba(127,127,127,0.35)',
            background: 'rgba(255,255,255,0.6)',
            color: 'inherit',
            outline: 'none',
            'font-size': '14px',
          }}
        />
        <div
          style={{
            'font-size': '12px',
            opacity: 0.6,
            'text-transform': 'uppercase',
            'letter-spacing': '0.4px',
          }}
        >
          {query().trim() ? `${results().length} result(s)` : 'All apps'}
        </div>
        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: '10px',
            overflow: 'auto',
          }}
        >
          <For each={results()}>
            {(app) => (
              <button type="button" onClick={() => launch(app.id)} class="launch-tile">
                <span style={{ 'font-size': '28px' }}>{app.icon}</span>
                <span style={{ 'font-size': '12px', 'text-align': 'center' }}>{app.name}</span>
              </button>
            )}
          </For>
          <Show when={results().length === 0}>
            <div style={{ opacity: 0.6, 'grid-column': '1 / -1', padding: '16px' }}>
              No apps match “{query()}”.
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
