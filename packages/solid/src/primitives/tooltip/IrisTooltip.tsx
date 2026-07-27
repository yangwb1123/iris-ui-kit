import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  mergeProps,
  onCleanup,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import { createHoverIntent } from '@iris-ui-kit/core'
import { useFloating } from '../../floating/useFloating'
import type { Placement } from '@iris-ui-kit/core'

export interface IrisTooltipProps {
  /** Plain-text tooltip content. */
  content?: string
  /** Side relative to the trigger; may flip to stay in view. */
  placement?: Placement
  /** Pixel offset between trigger and tooltip. */
  offset?: number
  /** Hover/focus dwell before opening, in ms. */
  openDelay?: number
  /** Hover/blur dwell before closing, in ms. */
  closeDelay?: number
  /** Disable the tooltip without removing the trigger. */
  disabled?: boolean
  /** Portal target — pass `false` to render in place. Default renders into document.body. */
  portalTarget?: HTMLElement | false
  children?: JSX.Element
  style?: JSX.CSSProperties
  /** Additional attributes forwarded to the trigger span (e.g. data-* attrs). */
  [key: string]: unknown
}

/**
 * Hover / focus triggered tooltip. Powered by `createHoverIntent` state machine.
 *
 * Zero-delay uses `hi.open()`/`hi.close()` (FORCE_OPEN/FORCE_CLOSE — single
 * machine transition) so Solid reactively updates synchronously. Positive delays
 * use `hi.pointerEnter()`/`hi.pointerLeave()` with the machine's after-timer.
 *
 * Solid port of the Vue IrisTooltip.
 */
export function IrisTooltip(props: IrisTooltipProps): JSX.Element {
  const [local, htmlAttrs] = splitProps(props, [
    'content',
    'placement',
    'offset',
    'openDelay',
    'closeDelay',
    'disabled',
    'portalTarget',
    'children',
    'style',
  ])
  const merged = mergeProps(
    {
      placement: 'top' as Placement,
      offset: 6,
      openDelay: 600,
      closeDelay: 0,
      disabled: false,
    },
    local,
  )

  const tooltipId = createUniqueId()
  const [open, setOpen] = createSignal(false)
  const [trigger, setTrigger] = createSignal<HTMLElement | undefined>()
  const [tooltip, setTooltip] = createSignal<HTMLElement | undefined>()

  // createHoverIntent keyed on delays; onChange syncs the Solid signal.
  // createMemo re-creates when openDelay/closeDelay change.
  const hi = createMemo(() =>
    createHoverIntent({
      openDelay: merged.openDelay,
      closeDelay: merged.closeDelay,
      onChange: setOpen,
    }),
  )

  onCleanup(() => hi().stop())

  // Escape closes immediately.
  createEffect(() => {
    if (!open()) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hi().close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  // Close immediately if disabled flips while open.
  createEffect(() => {
    if (merged.disabled && open()) hi().close()
  })

  const { floatingStyles } = useFloating({
    anchor: trigger,
    floating: tooltip,
    open,
    placement: merged.placement,
    offset: merged.offset,
  })

  // 0-delay → FORCE_OPEN/COSE (single transition, sync Solid reactivity).
  // Positive delay → pointerEnter/Leave (machine after-timer).
  const handleEnter = (): void => {
    if (merged.disabled) return
    if (merged.openDelay > 0) hi().pointerEnter()
    else hi().open()
  }
  const handleLeave = (): void => {
    if (merged.disabled) return
    if (merged.closeDelay > 0) hi().pointerLeave()
    else hi().close()
  }

  const tooltipContent = (): JSX.Element => (
    <div
      ref={setTooltip}
      id={tooltipId}
      role="tooltip"
      data-state={open() ? 'open' : 'closed'}
      data-placement={merged.placement}
      style={{
        ...floatingStyles(),
        background: 'var(--iris-foreground)',
        color: 'var(--iris-background)',
        padding: '4px 8px',
        'border-radius': 'var(--iris-radius-sm)',
        'font-size': '12px',
        'line-height': '1.4',
        'max-width': '240px',
        'pointer-events': 'none',
        'z-index': 1100,
        ...(merged.style ?? {}),
      }}
    >
      {merged.content}
    </div>
  )

  return (
    <>
      <span
        ref={setTrigger}
        {...htmlAttrs}
        style={{ display: 'contents' }}
        aria-describedby={open() ? tooltipId : undefined}
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        onFocus={() => {
          if (!merged.disabled) hi().open()
        }}
        onBlur={() => {
          if (!merged.disabled) hi().close()
        }}
      >
        {local.children}
      </span>
      <Show when={open()}>
        <Show when={local.portalTarget !== false} fallback={tooltipContent()}>
          <Portal
            mount={local.portalTarget instanceof HTMLElement ? local.portalTarget : undefined}
          >
            {tooltipContent()}
          </Portal>
        </Show>
      </Show>
    </>
  )
}
