import { For, Show, createEffect, onCleanup, type JSX } from 'solid-js'
import { type DesktopNotification, type NotificationTone } from '@iris-ui/core/notifications'
import { useNotifications, useNotificationState } from './notifications'

/** Accent glyph + color per tone (color via token-friendly literals). */
const TONE: Record<NotificationTone, { glyph: string; color: string }> = {
  info: { glyph: 'ℹ️', color: 'var(--os-accent)' },
  success: { glyph: '✅', color: '#28c840' },
  warning: { glyph: '⚠️', color: '#febc2e' },
  danger: { glyph: '⛔', color: '#ff5f57' },
}

const MAX_TOASTS = 4

/** One toast — auto-dismisses after its `timeout` (0 = sticky); ✕ dismisses now. */
function Toast(props: { n: DesktopNotification; onDismiss: () => void }): JSX.Element {
  // Schedule the auto-dismiss whenever the toast's timeout changes; clear it on
  // cleanup (re-run / unmount), mirroring React's effect + clearTimeout.
  createEffect(() => {
    const timeout = props.n.timeout
    if (!timeout) return
    const t = setTimeout(() => props.onDismiss(), timeout)
    onCleanup(() => clearTimeout(t))
  })

  const tone = (): { glyph: string; color: string } => TONE[props.n.tone]
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        gap: '10px',
        'align-items': 'flex-start',
        width: '320px',
        padding: '10px 12px',
        'border-radius': 'var(--os-window-radius)',
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        'box-shadow': 'var(--os-window-shadow)',
        'backdrop-filter': 'var(--os-blur)',
        '-webkit-backdrop-filter': 'var(--os-blur)',
        'border-left': `3px solid ${tone().color}`,
        font: '13px var(--os-font)',
      }}
    >
      <span style={{ 'font-size': '16px', 'line-height': '18px' }}>
        {props.n.icon || tone().glyph}
      </span>
      <div style={{ flex: 1, 'min-width': 0 }}>
        <div style={{ 'font-weight': 600 }}>{props.n.title}</div>
        <Show when={props.n.body}>
          <div style={{ opacity: 0.75, 'margin-top': '2px', 'line-height': 1.4 }}>
            {props.n.body}
          </div>
        </Show>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => props.onDismiss()}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          opacity: 0.5,
          'font-size': '14px',
          'line-height': '14px',
          padding: '2px',
        }}
      >
        ✕
      </button>
    </div>
  )
}

/**
 * The desktop TOAST stack — renders the newest notifications from the shared
 * {@link createNotificationCenter} in a corner, above windows. Each toast
 * auto-dismisses after its timeout; the full history lives in the center.
 * Token-skinned to the active OS (sits under `--os-topbar-h`).
 */
export function Toasts(): JSX.Element {
  const nc = useNotifications()
  const state = useNotificationState()
  const toasts = (): DesktopNotification[] => state().notifications.slice(0, MAX_TOASTS)
  return (
    <Show when={toasts().length > 0}>
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          top: 'calc(var(--os-topbar-h, 0px) + 12px)',
          right: '12px',
          'z-index': 90000,
          display: 'grid',
          gap: '10px',
          'pointer-events': 'auto',
        }}
      >
        <For each={toasts()}>{(n) => <Toast n={n} onDismiss={() => nc.dismiss(n.id)} />}</For>
      </div>
    </Show>
  )
}
