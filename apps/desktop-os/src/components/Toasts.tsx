import * as React from 'react'
import { type DesktopNotification, type NotificationTone } from '@iris-ui/core/notifications'
import { useNotifications, useNotificationState } from '../shell'

/** Accent glyph + color per tone (color via token-friendly literals). */
const TONE: Record<NotificationTone, { glyph: string; color: string }> = {
  info: { glyph: 'ℹ️', color: 'var(--os-accent)' },
  success: { glyph: '✅', color: '#28c840' },
  warning: { glyph: '⚠️', color: '#febc2e' },
  danger: { glyph: '⛔', color: '#ff5f57' },
}

const MAX_TOASTS = 4

/** One toast — auto-dismisses after its `timeout` (0 = sticky); ✕ dismisses now. */
function Toast({ n, onDismiss }: { n: DesktopNotification; onDismiss: () => void }) {
  React.useEffect(() => {
    if (!n.timeout) return
    const t = setTimeout(onDismiss, n.timeout)
    return () => clearTimeout(t)
  }, [n.timeout, onDismiss])

  const tone = TONE[n.tone]
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        width: 320,
        padding: '10px 12px',
        borderRadius: 'var(--os-window-radius)',
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        boxShadow: 'var(--os-window-shadow)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        borderLeft: `3px solid ${tone.color}`,
        font: '13px var(--os-font)',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: '18px' }}>{n.icon || tone.glyph}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{n.title}</div>
        {n.body && <div style={{ opacity: 0.75, marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          opacity: 0.5,
          fontSize: 14,
          lineHeight: '14px',
          padding: 2,
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
 * auto-dismisses after its timeout; the full history lives in the center (the
 * taskbar/tray bell). Token-skinned to the active OS.
 */
export function Toasts() {
  const nc = useNotifications()
  const { notifications } = useNotificationState()
  const toasts = notifications.slice(0, MAX_TOASTS)
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 'calc(var(--os-topbar-h, 0px) + 12px)',
        right: 12,
        zIndex: 90000,
        display: 'grid',
        gap: 10,
        pointerEvents: 'auto',
      }}
    >
      {toasts.map((n) => (
        <Toast key={n.id} n={n} onDismiss={() => nc.dismiss(n.id)} />
      ))}
    </div>
  )
}
