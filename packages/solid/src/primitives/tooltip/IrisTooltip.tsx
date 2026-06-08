import {
  createEffect,
  createSignal,
  createUniqueId,
  mergeProps,
  onCleanup,
  Show,
  type JSX,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import { useFloating } from '../../floating/useFloating'
import type { Placement } from '@iris-ui/core'

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
}

/**
 * Hover / focus triggered tooltip. Wraps a single child element.
 * Opens after `openDelay` ms of pointer hover or focus on the trigger;
 * closes after `closeDelay` ms when the pointer leaves.
 *
 * Accessibility:
 *   - The tooltip element gets `role="tooltip"` + a stable id.
 *   - The trigger gets `aria-describedby` pointing at that id while open.
 *
 * Solid port of the Vue IrisTooltip.
 */
export function IrisTooltip(props: IrisTooltipProps): JSX.Element {
  const merged = mergeProps(
    {
      placement: 'top' as Placement,
      offset: 6,
      openDelay: 600,
      closeDelay: 0,
      disabled: false,
    },
    props,
  )

  const tooltipId = createUniqueId()
  const [open, setOpen] = createSignal(false)
  const [trigger, setTrigger] = createSignal<HTMLElement | undefined>()
  const [tooltip, setTooltip] = createSignal<HTMLElement | undefined>()

  let openTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = (): void => {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  const scheduleOpen = (): void => {
    if (merged.disabled) return
    clearTimers()
    if (merged.openDelay <= 0) {
      setOpen(true)
      return
    }
    openTimer = setTimeout(() => {
      setOpen(true)
      openTimer = null
    }, merged.openDelay)
  }

  const scheduleClose = (): void => {
    clearTimers()
    if (merged.closeDelay <= 0) {
      setOpen(false)
      return
    }
    closeTimer = setTimeout(() => {
      setOpen(false)
      closeTimer = null
    }, merged.closeDelay)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && open()) {
      clearTimers()
      setOpen(false)
    }
  }

  createEffect(() => {
    if (open()) {
      document.addEventListener('keydown', onKeyDown)
    } else {
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  onCleanup(() => {
    clearTimers()
    document.removeEventListener('keydown', onKeyDown)
  })

  // Close immediately if disabled flips while open
  createEffect(() => {
    if (merged.disabled && open()) {
      clearTimers()
      setOpen(false)
    }
  })

  const { floatingStyles } = useFloating({
    anchor: trigger,
    floating: tooltip,
    open,
    placement: merged.placement,
    offset: merged.offset,
  })

  // The trigger wrapper — we render the child inside a span with attached listeners
  // (Solid lacks cloneElement; we wrap instead)
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
        style={{ display: 'contents' }}
        aria-describedby={open() ? tooltipId : undefined}
        onPointerEnter={scheduleOpen}
        onPointerLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
      >
        {props.children}
      </span>
      <Show when={open()}>
        <Show when={props.portalTarget !== false} fallback={tooltipContent()}>
          <Portal
            mount={props.portalTarget instanceof HTMLElement ? props.portalTarget : undefined}
          >
            {tooltipContent()}
          </Portal>
        </Show>
      </Show>
    </>
  )
}
