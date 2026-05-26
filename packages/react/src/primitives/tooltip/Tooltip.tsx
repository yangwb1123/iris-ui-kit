import * as React from 'react'
import { createPortal } from 'react-dom'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { useFloating } from '../../floating/useFloating'
import { IrisSlot } from '../slot/Slot'

export interface IrisTooltipProps {
  /** Plain-text tooltip content. */
  content?: React.ReactNode
  /** Side relative to the trigger; may flip to stay in view. */
  placement?: Placement
  /** Pixel offset between trigger and tooltip. */
  offset?: number
  /** Hover/focus dwell before opening, in ms. */
  openDelay?: number
  /** Hover/blur dwell before closing, in ms. */
  closeDelay?: number
  /** Portal target. `false` renders in place; an HTMLElement renders inside it; default = `document.body`. */
  portalTarget?: HTMLElement | false
  /** Disable the tooltip without removing the trigger. */
  disabled?: boolean
  children?: React.ReactNode
}

/**
 * Hover / focus triggered tooltip. Wraps a single child element (no wrapping
 * markup is added — behavior is attached via `IrisSlot`). Opens after
 * `openDelay` ms of pointer hover or focus on the trigger; closes after
 * `closeDelay` ms when the pointer leaves and focus departs. Escape closes
 * immediately while open.
 *
 * Accessibility:
 *   - The tooltip element gets `role="tooltip"` + a stable id.
 *   - The trigger gets `aria-describedby` pointing at that id while open.
 *   - Tooltips do not trap focus and are non-interactive.
 *
 * @example
 *   <IrisTooltip content="Save changes">
 *     <button>Save</button>
 *   </IrisTooltip>
 */
export function IrisTooltip({
  content,
  placement = 'top',
  offset = 6,
  openDelay = 600,
  closeDelay = 0,
  portalTarget,
  disabled = false,
  children,
}: IrisTooltipProps): React.ReactElement | null {
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const floatingRef = React.useRef<HTMLElement | null>(null)
  const tooltipId = React.useId()

  const [state, send] = useMachine(() => createFloatingMachine('closed'))
  const open = state.value === 'open'

  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = React.useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleOpen = React.useCallback(() => {
    if (disabled) return
    clearTimers()
    if (openDelay <= 0) {
      send({ type: 'OPEN' })
      return
    }
    openTimerRef.current = setTimeout(() => {
      send({ type: 'OPEN' })
      openTimerRef.current = null
    }, openDelay)
  }, [disabled, openDelay, send, clearTimers])

  const scheduleClose = React.useCallback(() => {
    clearTimers()
    if (closeDelay <= 0) {
      send({ type: 'CLOSE' })
      return
    }
    closeTimerRef.current = setTimeout(() => {
      send({ type: 'CLOSE' })
      closeTimerRef.current = null
    }, closeDelay)
  }, [closeDelay, send, clearTimers])

  // Escape immediately closes (skips closeDelay).
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimers()
        send({ type: 'CLOSE' })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, clearTimers, send])

  // If `disabled` flips while open, close immediately.
  React.useEffect(() => {
    if (disabled && open) {
      clearTimers()
      send({ type: 'CLOSE' })
    }
  }, [disabled, open, clearTimers, send])

  // Tear down pending timers on unmount.
  React.useEffect(() => clearTimers, [clearTimers])

  const { floatingStyles } = useFloating({
    anchor: triggerRef,
    floating: floatingRef,
    open,
    placement,
    offset,
  })

  const captureTriggerRef = React.useCallback((el: HTMLElement | null) => {
    triggerRef.current = el
  }, [])

  const captureFloatingRef = React.useCallback((el: HTMLElement | null) => {
    floatingRef.current = el
  }, [])

  if (!React.isValidElement(children)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[iris-ui] IrisTooltip requires a single React element child as trigger')
    }
    return null
  }

  const tooltipNode = open ? (
    <div
      ref={captureFloatingRef as React.Ref<HTMLDivElement>}
      id={tooltipId}
      role="tooltip"
      data-state="open"
      data-placement={placement}
      style={{
        ...floatingStyles,
        background: 'var(--iris-foreground)',
        color: 'var(--iris-background)',
        padding: '4px 8px',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        fontSize: '12px',
        lineHeight: 1.4,
        maxWidth: '240px',
        pointerEvents: 'none',
        zIndex: 1100,
      }}
    >
      {content}
    </div>
  ) : null

  const portaled =
    tooltipNode && portalTarget !== false
      ? createPortal(tooltipNode, portalTarget ?? document.body)
      : tooltipNode

  return (
    <>
      <IrisSlot
        ref={captureTriggerRef as React.Ref<unknown>}
        onPointerEnter={scheduleOpen}
        onPointerLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </IrisSlot>
      {portaled}
    </>
  )
}
