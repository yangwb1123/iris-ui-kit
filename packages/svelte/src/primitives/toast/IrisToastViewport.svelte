<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { createAutoDismiss, type AutoDismiss } from '@iris-ui-kit/core'
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
    danger: 'var(--iris-danger)',
    warning: 'var(--iris-warning)',
    info: 'var(--iris-info)',
  }

  const VARIANT_ACCENT: Record<IrisToastVariant, string> = {
    default: 'var(--iris-muted)',
    success: 'var(--iris-success)',
    danger: 'var(--iris-danger)',
    warning: 'var(--iris-warning)',
    info: 'var(--iris-info)',
  }

  let toasts = $state<IrisToast[]>(getToasts())
  let hovered = $state(false)
  // One core `createAutoDismiss` per live toast keyed by id — the after-machine
  // primitive replaces the hand-rolled setTimeout Map. start() on add, pause()
  // all on hover, resume() on un-hover, cancel() on remove/unmount.
  const dismissers = new Map<string, AutoDismiss>()

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
      'box-shadow: var(--iris-shadow-lg); ' +
      'min-width: 280px; font-size: var(--iris-font-size-md, 14px)'
    )
  }

  function cancelDismisser(id: string): void {
    const d = dismissers.get(id)
    if (d) {
      d.cancel()
      dismissers.delete(id)
    }
  }

  // Create + arm an auto-dismiss for a toast. The remaining time accounts for
  // any wall-clock already elapsed since `createdAt` (preserving the exact
  // observable timing the setTimeout Map had). duration 0/Infinity = persistent
  // (the early return means those toasts get no map entry).
  function armDismisser(toast: IrisToast): void {
    if (!toast.duration || toast.duration === Infinity) return
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

  onMount(() => {
    const unsubscribe = subscribeToasts((next) => {
      // Evict oldest if exceeding `max`.
      toasts = next.length > max ? next.slice(-max) : next
    })
    return unsubscribe
  })

  // List-sync: cancel dismissers for removed toasts; arm one for each new toast.
  // While hovered, a newly-armed dismisser is immediately paused (created-then-
  // paused) so it doesn't tick until the pointer leaves.
  $effect(() => {
    const liveIds = new Set(toasts.map((entry) => entry.id))
    for (const id of [...dismissers.keys()]) {
      if (!liveIds.has(id)) cancelDismisser(id)
    }
    for (const toast of toasts) {
      if (!dismissers.has(toast.id)) {
        armDismisser(toast)
        if (hovered) dismissers.get(toast.id)?.pause()
      }
    }
  })

  // Hover-sync: when hover toggles, pause/resume every live dismisser wholesale.
  $effect(() => {
    if (hovered) {
      for (const d of dismissers.values()) d.pause()
    } else {
      for (const d of dismissers.values()) d.resume()
    }
  })

  // Tear down on unmount: detach every dismisser permanently.
  onDestroy(() => {
    for (const d of dismissers.values()) d.cancel()
    dismissers.clear()
  })

  function onPointerEnter(): void {
    hovered = true
  }

  function onPointerLeave(): void {
    hovered = false
  }

  function positionStyle(pos: IrisToastPosition): string {
    // `padding` is the fallback; the per-side longhands add safe-area insets so
    // toasts clear the notch / home indicator on mobile webviews (Cordova). On
    // engines without env() the longhands are invalid and the shorthand applies.
    // (Host must set <meta name="viewport" content="...,viewport-fit=cover">.)
    const parts = [
      'position: fixed',
      'z-index: 1400',
      'display: flex',
      'flex-direction: column',
      'gap: var(--iris-gap-md, 12px)',
      'padding: 16px',
      'padding-top: max(16px, env(safe-area-inset-top))',
      'padding-right: max(16px, env(safe-area-inset-right))',
      'padding-bottom: max(16px, env(safe-area-inset-bottom))',
      'padding-left: max(16px, env(safe-area-inset-left))',
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
      role={toast.variant === 'danger' ? 'alert' : 'status'}
      aria-live={toast.variant === 'danger' ? 'assertive' : 'polite'}
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
          <div
            style="color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px); margin-top: var(--iris-space-xxs, 4px)"
          >
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
          ]}; font-weight: 600; cursor: pointer; padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px); font-size: var(--iris-font-size-sm, 13px); font-family: inherit"
        >
          {action.label}
        </button>
      {/if}
      <button
        type="button"
        aria-label={t('toast.dismiss')}
        onclick={() => dismissToast(toast.id)}
        style="background: transparent; border: none; cursor: pointer; padding: var(--iris-space-xxs, 4px); color: var(--iris-muted); line-height: 1; font-family: inherit; font-size: var(--iris-font-size-lg, 16px)"
      >
        ×
      </button>
    </div>
  {/each}
</div>
