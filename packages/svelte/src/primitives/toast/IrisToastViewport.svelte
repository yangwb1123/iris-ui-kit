<script lang="ts">
  import { onMount } from 'svelte'
  import { portal } from '../../internal/portal'
  import { useI18n } from '../../i18n'
  import {
    dismissToast,
    getToasts,
    subscribeToasts,
    type IrisToast,
    type IrisToastVariant,
  } from './toastStore'

  export type IrisToastPosition =
    | 'top-left'
    | 'top-right'
    | 'top-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'bottom-center'

  interface Props {
    position?: IrisToastPosition
    /** Portal target — pass `false` to render in place. Default renders into document.body. */
    portalTarget?: HTMLElement | false
    /** Maximum simultaneous toasts; older entries are evicted when exceeded. */
    max?: number
    [key: string]: unknown
  }

  let { position = 'top-right', portalTarget = undefined, max = 5, ...rest }: Props = $props()

  const { t } = useI18n()

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

  let toasts = $state<IrisToast[]>(getToasts())
  let hovered = $state(false)
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  // Swipe-to-dismiss: one toast is dragged at a time; past the threshold on
  // release it dismisses, otherwise it snaps back. The decision logic reads the
  // plain `dragLogic` closure var (synchronous — survives event batching); the
  // `drag` $state drives the visual offset (re-renders the transform).
  const SWIPE_DISMISS_PX = 80
  let dragLogic: { id: string; startX: number; dx: number } | null = null
  let drag = $state<{ id: string; dx: number } | null>(null)

  function onPointerDown(toast: IrisToast, e: PointerEvent): void {
    dragLogic = { id: toast.id, startX: e.clientX, dx: 0 }
    // Pointer capture keeps move/up on this element; unsupported in jsdom.
    try {
      ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
    } catch {
      /* no-op */
    }
    drag = { id: toast.id, dx: 0 }
  }

  function onPointerMove(toast: IrisToast, e: PointerEvent): void {
    if (dragLogic && dragLogic.id === toast.id) {
      dragLogic.dx = e.clientX - dragLogic.startX
      drag = { id: toast.id, dx: dragLogic.dx }
    }
  }

  function onPointerUp(toast: IrisToast): void {
    if (dragLogic && dragLogic.id === toast.id) {
      if (Math.abs(dragLogic.dx) > SWIPE_DISMISS_PX) dismissToast(toast.id)
      dragLogic = null
      drag = null
    }
  }

  function toastStyle(toast: IrisToast): string {
    const isDragging = drag?.id === toast.id
    const dx = isDragging ? (drag?.dx ?? 0) : 0
    const transform = dx ? `transform: translateX(${dx}px); ` : ''
    const opacity = isDragging ? `opacity: ${Math.max(0.3, 1 - Math.abs(dx) / 250)}; ` : ''
    const transition = isDragging
      ? 'transition: none; '
      : 'transition: transform 150ms ease, opacity 150ms ease; '
    return (
      'pointer-events: auto; ' +
      transform +
      opacity +
      transition +
      'touch-action: pan-y; cursor: grab; display: flex; align-items: flex-start; ' +
      'gap: var(--iris-gap-md, 12px); background: var(--iris-surface); color: var(--iris-foreground); ' +
      `border: 1px solid ${VARIANT_BORDER[toast.variant]}; ` +
      `border-inline-start: 4px solid ${VARIANT_ACCENT[toast.variant]}; ` +
      'border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-md, 12px); ' +
      'box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08); ' +
      'min-width: 280px; font-size: 14px'
    )
  }

  function clearTimer(id: string): void {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  function armTimer(toast: IrisToast): void {
    if (!toast.duration || toast.duration === Infinity) return
    clearTimer(toast.id)
    const remaining = Math.max(0, toast.createdAt + toast.duration - Date.now())
    const timer = setTimeout(() => {
      timers.delete(toast.id)
      dismissToast(toast.id)
    }, remaining)
    timers.set(toast.id, timer)
  }

  function armAll(): void {
    if (hovered) return
    for (const toast of toasts) armTimer(toast)
  }

  function clearAll(): void {
    for (const id of [...timers.keys()]) clearTimer(id)
  }

  onMount(() => {
    armAll()
    const unsubscribe = subscribeToasts((next) => {
      // Evict oldest if exceeding `max`.
      const trimmed = next.length > max ? next.slice(-max) : next
      toasts = trimmed
      // Arm timers for any new toasts.
      for (const toast of trimmed) {
        if (!timers.has(toast.id)) armTimer(toast)
      }
      // Clear timers for removed toasts.
      const liveIds = new Set(trimmed.map((entry) => entry.id))
      for (const id of [...timers.keys()]) {
        if (!liveIds.has(id)) clearTimer(id)
      }
    })
    return () => {
      clearAll()
      unsubscribe()
    }
  })

  function onPointerEnter(): void {
    hovered = true
    clearAll()
  }

  function onPointerLeave(): void {
    hovered = false
    armAll()
  }

  function positionStyle(pos: IrisToastPosition): string {
    const parts = [
      'position: fixed',
      'z-index: 1400',
      'display: flex',
      'flex-direction: column',
      'gap: var(--iris-gap-md, 12px)',
      'padding: 16px',
      'max-width: 420px',
      'width: 100%',
      'pointer-events: none',
    ]
    if (pos.startsWith('top')) parts.push('top: 0')
    if (pos.startsWith('bottom')) parts.push('bottom: 0')
    if (pos.endsWith('-left')) parts.push('left: 0')
    if (pos.endsWith('-right')) parts.push('right: 0')
    if (pos.endsWith('-center')) parts.push('left: 50%', 'transform: translateX(-50%)')
    return parts.join('; ')
  }
</script>

<div
  {...rest}
  use:portal={portalTarget}
  data-iris-toast-viewport=""
  data-position={position}
  onpointerenter={onPointerEnter}
  onpointerleave={onPointerLeave}
  style={positionStyle(position)}
>
  {#each toasts as toast (toast.id)}
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      data-iris-toast=""
      data-variant={toast.variant}
      onpointerdown={(e) => onPointerDown(toast, e)}
      onpointermove={(e) => onPointerMove(toast, e)}
      onpointerup={() => onPointerUp(toast)}
      style={toastStyle(toast)}
    >
      <div style="flex: 1; min-width: 0">
        {#if toast.title}
          <div style="font-weight: 600">{toast.title}</div>
        {/if}
        {#if toast.description}
          <div style="color: var(--iris-muted); font-size: 13px; margin-top: 2px">
            {toast.description}
          </div>
        {/if}
      </div>
      {#if toast.action}
        {@const action = toast.action}
        <button
          type="button"
          onclick={() => {
            action.onClick()
            dismissToast(toast.id)
          }}
          style="background: transparent; border: none; color: {VARIANT_ACCENT[
            toast.variant
          ]}; font-weight: 600; cursor: pointer; padding: 4px 8px; font-size: 13px; font-family: inherit"
        >
          {action.label}
        </button>
      {/if}
      <button
        type="button"
        aria-label={t('toast.dismiss')}
        onclick={() => dismissToast(toast.id)}
        style="background: transparent; border: none; cursor: pointer; padding: 4px; color: var(--iris-muted); line-height: 1; font-family: inherit; font-size: 16px"
      >
        ×
      </button>
    </div>
  {/each}
</div>
