import { For, createSignal, onCleanup, type JSX } from 'solid-js'
import { getManifest } from './catalog'
import { useWm, useWmState } from './wm'

function Clock(): JSX.Element {
  const [now, setNow] = createSignal(new Date())
  const t = setInterval(() => setNow(new Date()), 1000 * 30)
  onCleanup(() => clearInterval(t))
  return (
    <div
      style={{ 'text-align': 'right', 'font-size': '12px', 'line-height': 1.25, padding: '0 14px' }}
    >
      <div>{now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div>
        {now().toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  )
}

/** Windows 11 taskbar: centered Start + running apps; clock pinned right. */
export function Taskbar(props: {
  launcherOpen: boolean
  onToggleLauncher: () => void
}): JSX.Element {
  const wm = useWm()
  const state = useWmState()

  const onTask = (id: string): void => {
    const w = state().windows.find((x) => x.id === id)
    if (!w) return
    if (w.focused && w.state !== 'minimized') wm.minimize(id)
    else wm.focus(id)
  }

  return (
    <div
      class="taskbar"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'var(--os-bar-h)',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        color: 'var(--os-bar-fg)',
        background: 'var(--os-bar-bg)',
        'backdrop-filter': 'var(--os-blur)',
        '-webkit-backdrop-filter': 'var(--os-blur)',
        'border-top': '1px solid rgba(255,255,255,0.18)',
      }}
    >
      <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <button
          type="button"
          aria-label="Start"
          aria-pressed={props.launcherOpen}
          class="task-btn task-btn--start"
          onPointerDown={(e) => {
            e.stopPropagation()
            props.onToggleLauncher()
          }}
          style={{ 'font-size': '18px' }}
        >
          ⊞
        </button>
        <For each={state().windows}>
          {(w) => {
            const active = (): boolean => w.focused && w.state !== 'minimized'
            return (
              <button
                type="button"
                title={w.title}
                class={`task-btn${active() ? ' task-btn--active' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onTask(w.id)
                }}
              >
                <span style={{ 'font-size': '18px' }}>{getManifest(w.appId)?.icon}</span>
              </button>
            )
          }}
        </For>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          'align-items': 'center',
        }}
      >
        <Clock />
      </div>
    </div>
  )
}
