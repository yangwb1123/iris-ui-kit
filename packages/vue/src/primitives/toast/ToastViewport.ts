import {
  Teleport,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  type PropType,
  type VNode,
} from 'vue'
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type IrisToast,
  type IrisToastVariant,
} from './store'
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

/** Horizontal swipe distance (px) past which a release dismisses the toast. */
const SWIPE_DISMISS_PX = 80

/**
 * Renders the queued toasts. Mount exactly **one** of these per page —
 * typically near the root of the application layout. The viewport subscribes
 * to the module-level toast store; toasts pushed via `useToast()` from any
 * component appear here.
 *
 * Auto-dismiss timers are managed per toast (paused while the pointer is
 * over the viewport). Manual dismiss is via the close button.
 */
export const IrisToastViewport = defineComponent({
  name: 'IrisToastViewport',
  inheritAttrs: false,
  props: {
    position: { type: String as PropType<IrisToastPosition>, default: 'top-right' },
    teleport: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: 'body',
    },
    /** Maximum simultaneous toasts; older entries are evicted when exceeded. */
    max: { type: Number, default: 5 },
  },
  setup(props, { attrs }) {
    const { t } = useI18n()
    const toasts = ref<IrisToast[]>(getToasts())
    const hovered = ref(false)
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    // Swipe-to-dismiss: one toast is dragged at a time; past the threshold on
    // release it dismisses, otherwise it snaps back. The decision logic reads a
    // plain closure object (synchronous — survives event batching); the reactive
    // ref drives the visual offset.
    const drag = ref<{ id: string; dx: number } | null>(null)
    let dragLogic: { id: string; startX: number; dx: number } | null = null

    const onToastPointerDown = (toast: IrisToast, e: PointerEvent) => {
      dragLogic = { id: toast.id, startX: e.clientX, dx: 0 }
      // Pointer capture keeps move/up on this element; unsupported in jsdom.
      try {
        ;(e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId)
      } catch {
        /* no-op */
      }
      drag.value = { id: toast.id, dx: 0 }
    }
    const onToastPointerMove = (toast: IrisToast, e: PointerEvent) => {
      const d = dragLogic
      if (d && d.id === toast.id) {
        d.dx = e.clientX - d.startX
        drag.value = { id: toast.id, dx: d.dx }
      }
    }
    const onToastPointerUp = (toast: IrisToast) => {
      const d = dragLogic
      if (d && d.id === toast.id) {
        if (Math.abs(d.dx) > SWIPE_DISMISS_PX) dismissToast(toast.id)
        dragLogic = null
        drag.value = null
      }
    }

    const clearTimer = (id: string) => {
      const t = timers.get(id)
      if (t) {
        clearTimeout(t)
        timers.delete(id)
      }
    }

    const armTimer = (toast: IrisToast) => {
      if (!toast.duration || toast.duration === Infinity) return
      clearTimer(toast.id)
      const remaining = Math.max(0, toast.createdAt + toast.duration - Date.now())
      const timer = setTimeout(() => {
        timers.delete(toast.id)
        dismissToast(toast.id)
      }, remaining)
      timers.set(toast.id, timer)
    }

    const armAll = () => {
      if (hovered.value) return
      for (const toast of toasts.value) armTimer(toast)
    }

    const clearAll = () => {
      for (const id of timers.keys()) clearTimer(id)
    }

    let unsubscribe: (() => void) | null = null

    onMounted(() => {
      armAll()
      unsubscribe = subscribeToasts((next) => {
        // Evict oldest if exceeding `max`.
        let trimmed = next
        if (next.length > props.max) {
          trimmed = next.slice(-props.max)
        }
        toasts.value = trimmed
        // Arm timers for any new toasts.
        for (const toast of trimmed) {
          if (!timers.has(toast.id)) armTimer(toast)
        }
        // Clear timers for removed toasts.
        const liveIds = new Set(trimmed.map((t) => t.id))
        for (const id of timers.keys()) {
          if (!liveIds.has(id)) clearTimer(id)
        }
      })
    })

    onBeforeUnmount(() => {
      clearAll()
      unsubscribe?.()
    })

    const onPointerEnter = () => {
      hovered.value = true
      clearAll()
    }
    const onPointerLeave = () => {
      hovered.value = false
      armAll()
    }

    const positionStyle = (): Record<string, string> => {
      const base: Record<string, string> = {
        position: 'fixed',
        zIndex: '1400',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-gap-md)',
        // `padding` is the fallback; the per-side longhands add safe-area insets
        // so toasts clear the notch / home indicator on mobile webviews
        // (Cordova). On engines without env() the longhands are invalid and the
        // shorthand applies. (Host must set
        // <meta name="viewport" content="...,viewport-fit=cover">.)
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        maxWidth: '420px',
        width: '100%',
        pointerEvents: 'none',
      }
      const top = props.position.startsWith('top')
      const bottom = props.position.startsWith('bottom')
      const left = props.position.endsWith('-left')
      const right = props.position.endsWith('-right')
      const center = props.position.endsWith('-center')
      if (top) base.top = '0'
      if (bottom) base.bottom = '0'
      if (left) base.left = '0'
      if (right) base.right = '0'
      if (center) {
        base.left = '50%'
        base.transform = 'translateX(-50%)'
      }
      return base
    }

    const renderToast = (toast: IrisToast): VNode => {
      const isDragging = drag.value?.id === toast.id
      const dx = isDragging ? (drag.value?.dx ?? 0) : 0
      return h(
        'div',
        {
          key: toast.id,
          role: toast.variant === 'error' ? 'alert' : 'status',
          'aria-live': toast.variant === 'error' ? 'assertive' : 'polite',
          'data-iris-toast': '',
          'data-variant': toast.variant,
          onPointerdown: (e: PointerEvent) => onToastPointerDown(toast, e),
          onPointermove: (e: PointerEvent) => onToastPointerMove(toast, e),
          onPointerup: () => onToastPointerUp(toast),
          style: {
            pointerEvents: 'auto',
            transform: dx ? `translateX(${dx}px)` : undefined,
            opacity: isDragging ? String(Math.max(0.3, 1 - Math.abs(dx) / 250)) : undefined,
            transition: isDragging ? 'none' : 'transform 150ms ease, opacity 150ms ease',
            touchAction: 'pan-y',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--iris-gap-md)',
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            border: `1px solid ${VARIANT_BORDER[toast.variant]}`,
            borderInlineStart: `4px solid ${VARIANT_ACCENT[toast.variant]}`,
            borderRadius: 'var(--iris-radius-md)',
            padding: 'var(--iris-padding-md)',
            boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
            minWidth: '280px',
            fontSize: '14px',
          },
        },
        [
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            toast.title && h('div', { style: { fontWeight: '600' } }, toast.title),
            toast.description &&
              h(
                'div',
                { style: { color: 'var(--iris-muted)', fontSize: '13px', marginTop: '2px' } },
                toast.description,
              ),
          ]),
          toast.action &&
            h(
              'button',
              {
                type: 'button',
                onClick: () => {
                  toast.action!.onClick()
                  dismissToast(toast.id)
                },
                style: {
                  background: 'transparent',
                  border: 'none',
                  color: VARIANT_ACCENT[toast.variant],
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                },
              },
              toast.action.label,
            ),
          h(
            'button',
            {
              type: 'button',
              'aria-label': t('toast.dismiss'),
              onClick: () => dismissToast(toast.id),
              style: {
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'var(--iris-muted)',
                lineHeight: '1',
                fontFamily: 'inherit',
                fontSize: '16px',
              },
            },
            '×',
          ),
        ],
      )
    }

    return () => {
      const viewport = h(
        'div',
        {
          ...attrs,
          'data-iris-toast-viewport': '',
          'data-position': props.position,
          onPointerenter: onPointerEnter,
          onPointerleave: onPointerLeave,
          style: {
            ...positionStyle(),
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        toasts.value.map(renderToast),
      )
      if (props.teleport === false) return viewport
      return h(Teleport, { to: props.teleport as string | HTMLElement }, [viewport])
    }
  },
})
