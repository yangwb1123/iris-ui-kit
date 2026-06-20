import { For, type JSX } from 'solid-js'
import { IrisButton } from '@iris-ui/solid'
import { useWm, useWmState } from './wm'

/**
 * Live window-manager state: the open windows, their state, and an "End task"
 * button per window. Reads straight from the framework-agnostic window manager
 * (`useWmState` accessor), so it re-renders as windows open / close / minimize.
 * Solid mirror of the React `TaskManagerView`.
 */
export function TaskManagerApp(): JSX.Element {
  const wm = useWm()
  const state = useWmState()
  return (
    <div style={{ padding: '12px', display: 'grid', gap: '4px', color: 'var(--os-window-fg)' }}>
      <div style={{ opacity: 0.6, 'font-size': '12px', padding: '0 8px' }}>
        {state().windows.length} open window(s) — live from the window manager store
      </div>
      <For each={state().windows}>
        {(w) => (
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', padding: '6px 8px' }}>
            <span style={{ flex: 1 }}>{w.title}</span>
            <span style={{ 'font-size': '12px', opacity: 0.5 }}>{w.state}</span>
            <IrisButton variant="ghost" onClick={() => wm.close(w.id)}>
              End task
            </IrisButton>
          </div>
        )}
      </For>
    </div>
  )
}
