import { For, Show, createSignal, onCleanup, splitProps, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createAutoDismiss, type AutoDismiss } from '@iris-ui-kit/core'
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
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning)',
  info: 'var(--iris-primary)',
}

const VARIANT_ACCENT: Record<IrisToastVariant, string> = {
  default: 'var(--iris-muted)',
  success: 'var(--iris-success)',
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning)',
  info: 'var(--iris-primary)',
}

export interface IrisToastViewportProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'style'> {
  position?: IrisToastPosition
  /** Portal target — pass `false` to render in place. Default renders into document.body. */
  portalTarget?: HTMLElement | false
  /** Maximum simultaneous toasts; older entries are evicted when exceeded. */
  max?: number
  style?: JSX.CSSProperties
}

/**
 * Renders the queued toasts. Mount exactly **one** of these per page. The
 * viewport subscribes to the module-level toast store; toasts pushed via
 * `useToast()` from any component appear here.
 *
 * Auto-dismiss timers are managed per toast (paused while the pointer is over
 * the viewport). Manual dismiss is via the close button.
 * Solid port of the Vue IrisToastViewport.
 */
export function IrisToastViewport(props: IrisToastViewportProps): JSX.Element {
  const [local, rest] = splitProps(props, ['position', 'portalTarget', 'max', 'style'])
  const { t } = useI18n()

  const position = (): IrisToastPosition => local.position ?? 'top-right'
  const max = (): number => local.max ?? 5

  const [toasts, setToasts] = createSignal<IrisToast[]>(getToasts())
  const [hovered, setHovered] = createSignal(false)
  // One core `createAutoDismiss` per live toast keyed by id — the after-machine
  // primitive replaces the hand-rolled setTimeout Map. start() on add, pause()
  // all on hover, resume() on un-hover, cancel() on remove/unmount.
  const dismissers = new Map<string, AutoDismiss>()

  // Swipe-to-dismiss: one toast is dragged at a time; past the threshold on
  // release it dismisses, otherwise it snaps back. The decision logic reads the
  // plain `dragLogic` ref (synchronous — survives event batching); the signal
  // drives the visual offset.
  const SWIPE_DISMISS_PX = 80
  const [drag, setDrag] = createSignal<{ id: string; dx: number } | null>(null)
  let dragLogic: { id: string; startX: number; dx: number } | null = null

  const cancelDismisser = (id: string): void => {
    const d = dismissers.get(id)
    if (d) {
      d.cancel()
      dismissers.delete(id)
    }
  }

  // Create + arm an auto-dismiss for a toast. The remaining time accounts for
  // any wall-clock already elapsed since `createdAt` (preserving the exact
  // observable timing the setTimeout Map had). duration 0/Infinity = persistent.
  const armDismisser = (toast: IrisToast): void => {
    if (!toast.duration || toast.duration === Infinity) return
    cancelDismisser(toast.id)
    const remaining = Math.max(0, toast.createdAt + toast.duration - Date.now())
    const dismisser = createAutoDismiss({
      duration: remaining,
      onDismiss: () => {
        dismissers.delete(toast.id)
        dismissToast(toast.id)
      },
    })
    dismissers.set(toast.id, dismisser)
    dismisser.start()
  }

  const cancelAll = (): void => {
    for (const id of [...dismissers.keys()]) cancelDismisser(id)
  }

  // Arm dismissers for the initial queue (none are armed while hovered, but on
  // first mount the viewport is not hovered yet).
  for (const toast of toasts()) armDismisser(toast)

  const unsubscribe = subscribeToasts((next) => {
    // Evict oldest if exceeding `max`.
    const trimmed = next.length > max() ? next.slice(-max()) : next
    setToasts(trimmed)
    // Cancel dismissers for removed toasts.
    const liveIds = new Set(trimmed.map((entry) => entry.id))
    for (const id of [...dismissers.keys()]) {
      if (!liveIds.has(id)) cancelDismisser(id)
    }
    // Arm a dismisser for each new toast. While hovered, newly-added toasts are
    // created paused (started then paused) so they don't tick until the pointer
    // leaves.
    for (const toast of trimmed) {
      if (!dismissers.has(toast.id)) {
        armDismisser(toast)
        if (hovered()) dismissers.get(toast.id)?.pause()
      }
    }
  })

  onCleanup(() => {
    cancelAll()
    unsubscribe()
  })

  const onPointerEnter = (): void => {
    setHovered(true)
    for (const d of dismissers.values()) d.pause()
  }
  const onPointerLeave = (): void => {
    setHovered(false)
    for (const d of dismissers.values()) d.resume()
  }

  const positionStyle = (): JSX.CSSProperties => {
    const pos = position()
    const base: JSX.CSSProperties = {
      position: 'fixed',
      'z-index': '1400',
      display: 'flex',
      'flex-direction': 'column',
      gap: 'var(--iris-gap-md, 12px)',
      // `padding` is the fallback; the per-side longhands add safe-area insets so
      // toasts clear the notch / home indicator on mobile webviews (Cordova). On
      // engines without env() the longhands are invalid and the shorthand applies.
      // (Host must set <meta name="viewport" content="...,viewport-fit=cover">.)
      padding: '16px',
      'padding-top': 'max(16px, env(safe-area-inset-top))',
      'padding-right': 'max(16px, env(safe-area-inset-right))',
      'padding-bottom': 'max(16px, env(safe-area-inset-bottom))',
      'padding-left': 'max(16px, env(safe-area-inset-left))',
      'max-width': '420px',
      width: '100%',
      'pointer-events': 'none',
    }
    if (pos.startsWith('top')) base.top = '0'
    if (pos.startsWith('bottom')) base.bottom = '0'
    if (pos.endsWith('-left')) base.left = '0'
    if (pos.endsWith('-right')) base.right = '0'
    if (pos.endsWith('-center')) {
      base.left = '50%'
      base.transform = 'translateX(-50%)'
    }
    return base
  }

  const viewport = (): JSX.Element => (
    <div
      {...rest}
      data-iris-toast-viewport=""
      data-position={position()}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{ ...positionStyle(), ...(local.style ?? {}) }}
    >
      <For each={toasts()}>
        {(toast) => {
          const isDragging = (): boolean => drag()?.id === toast.id
          const dx = (): number => (isDragging() ? (drag()?.dx ?? 0) : 0)
          const onPointerDown = (e: PointerEvent & { currentTarget: HTMLDivElement }): void => {
            dragLogic = { id: toast.id, startX: e.clientX, dx: 0 }
            // Pointer capture keeps move/up on this element; unsupported in jsdom.
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId)
            } catch {
              /* no-op */
            }
            setDrag({ id: toast.id, dx: 0 })
          }
          const onPointerMove = (e: PointerEvent): void => {
            const d = dragLogic
            if (d && d.id === toast.id) {
              d.dx = e.clientX - d.startX
              setDrag({ id: toast.id, dx: d.dx })
            }
          }
          const onPointerUp = (): void => {
            const d = dragLogic
            if (d && d.id === toast.id) {
              if (Math.abs(d.dx) > SWIPE_DISMISS_PX) dismissToast(toast.id)
              dragLogic = null
              setDrag(null)
            }
          }
          return (
            <div
              role={toast.variant === 'danger' ? 'alert' : 'status'}
              aria-live={toast.variant === 'danger' ? 'assertive' : 'polite'}
              data-iris-toast=""
              data-variant={toast.variant}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                'pointer-events': 'auto',
                transform: dx() ? `translateX(${dx()}px)` : undefined,
                opacity: isDragging() ? `${Math.max(0.3, 1 - Math.abs(dx()) / 250)}` : undefined,
                transition: isDragging() ? 'none' : 'transform 150ms ease, opacity 150ms ease',
                'touch-action': 'pan-y',
                cursor: 'grab',
                display: 'flex',
                'align-items': 'flex-start',
                gap: 'var(--iris-gap-md, 12px)',
                background: 'var(--iris-surface)',
                color: 'var(--iris-foreground)',
                border: `1px solid ${VARIANT_BORDER[toast.variant]}`,
                'border-inline-start': `4px solid ${VARIANT_ACCENT[toast.variant]}`,
                'border-radius': 'var(--iris-radius-md, 6px)',
                padding: 'var(--iris-padding-md, 12px)',
                'box-shadow':
                  '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
                'min-width': '280px',
                'font-size': '14px',
              }}
            >
              <div style={{ flex: '1', 'min-width': '0' }}>
                <Show when={toast.title}>
                  <div style={{ 'font-weight': '600' }}>{toast.title}</div>
                </Show>
                <Show when={toast.description}>
                  <div
                    style={{ color: 'var(--iris-muted)', 'font-size': '13px', 'margin-top': '2px' }}
                  >
                    {toast.description}
                  </div>
                </Show>
              </div>
              <Show when={toast.action}>
                {(action) => (
                  <button
                    type="button"
                    onClick={() => {
                      action().onClick()
                      dismissToast(toast.id)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: VARIANT_ACCENT[toast.variant],
                      'font-weight': '600',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      'font-size': '13px',
                      'font-family': 'inherit',
                    }}
                  >
                    {action().label}
                  </button>
                )}
              </Show>
              <button
                type="button"
                aria-label={t('toast.dismiss')}
                onClick={() => dismissToast(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--iris-muted)',
                  'line-height': '1',
                  'font-family': 'inherit',
                  'font-size': '16px',
                }}
              >
                ×
              </button>
            </div>
          )
        }}
      </For>
    </div>
  )

  return (
    <Show when={local.portalTarget !== false} fallback={viewport()}>
      <Portal mount={local.portalTarget instanceof HTMLElement ? local.portalTarget : undefined}>
        {viewport()}
      </Portal>
    </Show>
  )
}
