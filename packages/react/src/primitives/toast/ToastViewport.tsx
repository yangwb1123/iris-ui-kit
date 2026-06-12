import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type IrisToast,
  type IrisToastVariant,
} from './toastStore'
import { useI18n } from '../../i18n'

export type IrisToastPosition =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'

const VARIANT_BORDER: Record<IrisToastVariant, string> = {
  default: 'var(--iris-border)',
  success: 'var(--iris-success)',
  error: 'var(--iris-danger)',
  warning: 'var(--iris-warning)',
  info: 'var(--iris-primary)',
}

const VARIANT_ACCENT: Record<IrisToastVariant, string> = {
  default: 'var(--iris-muted)',
  success: 'var(--iris-success)',
  error: 'var(--iris-danger)',
  warning: 'var(--iris-warning)',
  info: 'var(--iris-primary)',
}

function positionStyle(position: IrisToastPosition): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1400,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--iris-gap-md, 12px)',
    // `padding` is the fallback; the per-side longhands add safe-area insets so
    // toasts clear the notch / home indicator on mobile webviews (Cordova). On
    // engines without env() the longhands are invalid and the shorthand applies.
    // (Host must set <meta name="viewport" content="...,viewport-fit=cover">.)
    padding: 16,
    paddingTop: 'max(16px, env(safe-area-inset-top))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    maxWidth: 420,
    width: '100%',
    pointerEvents: 'none',
  }
  const top = position.startsWith('top')
  const bottom = position.startsWith('bottom')
  const left = position.endsWith('-left')
  const right = position.endsWith('-right')
  const center = position.endsWith('-center')
  if (top) base.top = 0
  if (bottom) base.bottom = 0
  if (left) base.left = 0
  if (right) base.right = 0
  if (center) {
    base.left = '50%'
    base.transform = 'translateX(-50%)'
  }
  return base
}

export interface IrisToastViewportProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: IrisToastPosition
  portalTarget?: HTMLElement | false
  /** Maximum simultaneous toasts; older entries are evicted when exceeded. */
  max?: number
}

/**
 * Renders the queued toasts. Mount exactly **one** of these per page. The
 * viewport subscribes to the module-level toast store; toasts pushed via
 * `useToast()` from any component appear here.
 *
 * Auto-dismiss timers are managed per toast (paused while the pointer is over
 * the viewport). Manual dismiss is via the close button.
 */
export function IrisToastViewport({
  position = 'top-right',
  portalTarget,
  max = 5,
  style,
  ...rest
}: IrisToastViewportProps): React.ReactElement | null {
  const { t } = useI18n()
  const allToasts = React.useSyncExternalStore(subscribeToasts, getToasts, () => [] as IrisToast[])

  const toasts = React.useMemo(
    () => (allToasts.length > max ? allToasts.slice(-max) : allToasts),
    [allToasts, max],
  )

  const [hovered, setHovered] = React.useState(false)
  const timersRef = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Swipe-to-dismiss: one toast is dragged at a time; past the threshold on
  // release it dismisses, otherwise it snaps back. The decision logic reads the
  // ref (synchronous — survives event batching); state drives the visual offset.
  const SWIPE_DISMISS_PX = 80
  const [drag, setDrag] = React.useState<{ id: string; dx: number } | null>(null)
  const dragRef = React.useRef<{ id: string; startX: number; dx: number } | null>(null)

  const clearTimer = React.useCallback((id: string) => {
    const t = timersRef.current.get(id)
    if (t) {
      clearTimeout(t)
      timersRef.current.delete(id)
    }
  }, [])

  const armTimer = React.useCallback(
    (toast: IrisToast) => {
      if (!toast.duration || toast.duration === Infinity) return
      clearTimer(toast.id)
      const remaining = Math.max(0, toast.createdAt + toast.duration - Date.now())
      const timer = setTimeout(() => {
        timersRef.current.delete(toast.id)
        dismissToast(toast.id)
      }, remaining)
      timersRef.current.set(toast.id, timer)
    },
    [clearTimer],
  )

  // Arm timers for new toasts, clear timers for removed ones; respect hover-pause.
  React.useEffect(() => {
    const liveIds = new Set(toasts.map((t) => t.id))
    // Clear timers for toasts that no longer exist.
    for (const id of Array.from(timersRef.current.keys())) {
      if (!liveIds.has(id)) clearTimer(id)
    }
    if (hovered) return
    for (const toast of toasts) {
      if (!timersRef.current.has(toast.id)) armTimer(toast)
    }
  }, [toasts, hovered, armTimer, clearTimer])

  // When hovered toggles, sync timers wholesale.
  React.useEffect(() => {
    if (hovered) {
      for (const id of Array.from(timersRef.current.keys())) clearTimer(id)
    } else {
      for (const toast of toasts) {
        if (!timersRef.current.has(toast.id)) armTimer(toast)
      }
    }
  }, [hovered, toasts, armTimer, clearTimer])

  // Tear down on unmount.
  React.useEffect(
    () => () => {
      for (const id of Array.from(timersRef.current.keys())) clearTimer(id)
    },
    [clearTimer],
  )

  const node = (
    <div
      {...rest}
      data-iris-toast-viewport=""
      data-position={position}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{ ...positionStyle(position), ...style }}
    >
      {toasts.map((toast) => {
        const isDragging = drag?.id === toast.id
        const dx = isDragging ? (drag?.dx ?? 0) : 0
        return (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
            data-iris-toast=""
            data-variant={toast.variant}
            onPointerDown={(e) => {
              dragRef.current = { id: toast.id, startX: e.clientX, dx: 0 }
              // Pointer capture keeps move/up on this element; unsupported in jsdom.
              try {
                e.currentTarget.setPointerCapture?.(e.pointerId)
              } catch {
                /* no-op */
              }
              setDrag({ id: toast.id, dx: 0 })
            }}
            onPointerMove={(e) => {
              const d = dragRef.current
              if (d && d.id === toast.id) {
                d.dx = e.clientX - d.startX
                setDrag({ id: toast.id, dx: d.dx })
              }
            }}
            onPointerUp={() => {
              const d = dragRef.current
              if (d && d.id === toast.id) {
                if (Math.abs(d.dx) > SWIPE_DISMISS_PX) dismissToast(toast.id)
                dragRef.current = null
                setDrag(null)
              }
            }}
            style={{
              pointerEvents: 'auto',
              transform: dx ? `translateX(${dx}px)` : undefined,
              opacity: isDragging ? Math.max(0.3, 1 - Math.abs(dx) / 250) : undefined,
              transition: isDragging ? 'none' : 'transform 150ms ease, opacity 150ms ease',
              touchAction: 'pan-y',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--iris-gap-md, 12px)',
              background: 'var(--iris-surface)',
              color: 'var(--iris-foreground)',
              border: `1px solid ${VARIANT_BORDER[toast.variant]}`,
              borderInlineStart: `4px solid ${VARIANT_ACCENT[toast.variant]}`,
              borderRadius: 'var(--iris-radius-md, 6px)',
              padding: 'var(--iris-padding-md, 12px)',
              boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
              minWidth: 280,
              fontSize: 14,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {toast.title ? <div style={{ fontWeight: 600 }}>{toast.title}</div> : null}
              {toast.description ? (
                <div
                  style={{
                    color: 'var(--iris-muted)',
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  {toast.description}
                </div>
              ) : null}
            </div>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick()
                  dismissToast(toast.id)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: VARIANT_ACCENT[toast.variant],
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={t('toast.dismiss')}
              onClick={() => dismissToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--iris-muted)',
                lineHeight: 1,
                fontFamily: 'inherit',
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )

  if (portalTarget === false) return node
  if (typeof document === 'undefined') return null
  return createPortal(node, portalTarget ?? document.body)
}
