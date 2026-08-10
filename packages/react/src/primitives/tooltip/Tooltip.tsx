import * as React from 'react'
import { installFloatingAnimations, ANIM_TOOLTIP } from '../../floating/animations'
import { createPortal } from 'react-dom'
import { createHoverIntent, type Placement } from '@iris-ui-kit/core'
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
 * Hover / focus triggered tooltip. Powered by `createHoverIntent` state machine.
 *
 * Zero-delay uses `hi.open()`/`hi.close()` (FORCE_OPEN/FORCE_CLOSE — single
 * machine transition) so React renders synchronously. Positive delays use
 * `hi.pointerEnter()`/`hi.pointerLeave()` with the machine's `after` timer.
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
  ...rest
}: IrisTooltipProps): React.ReactElement | null {
  installFloatingAnimations()
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const floatingRef = React.useRef<HTMLElement | null>(null)
  const tooltipId = React.useId()

  const [open, setOpen] = React.useState(false)

  // createHoverIntent keyed on delays; onChange syncs React state.
  // setOpen from useState is stable across renders so useMemo dep is clean.
  const hi = React.useMemo(
    () => createHoverIntent({ openDelay, closeDelay, onChange: setOpen }),
    [openDelay, closeDelay],
  )

  // Cleanup on unmount or when delays change.
  React.useEffect(() => () => hi.stop(), [hi])

  // Escape immediately closes (skips closeDelay).
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hi.close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, hi])

  // If `disabled` flips while open, close immediately.
  React.useEffect(() => {
    if (disabled && open) hi.close()
  }, [disabled, open, hi])

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

  // 0-delay → FORCE_OPEN/COSE (single machine transition, sync React render).
  // Positive delay → pointerEnter/Leave (machine after-timer).
  const handleEnter = React.useCallback(
    () => (openDelay > 0 ? hi.pointerEnter() : hi.open()),
    [openDelay, hi],
  )
  const handleLeave = React.useCallback(
    () => (closeDelay > 0 ? hi.pointerLeave() : hi.close()),
    [closeDelay, hi],
  )

  const tooltipNode = open ? (
    <div
      ref={captureFloatingRef as React.Ref<HTMLDivElement>}
      id={tooltipId}
      role="tooltip"
      {...rest}
      data-state="open"
      data-placement={placement}
      style={{
        ...floatingStyles,
        background: 'var(--iris-foreground)',
        color: 'var(--iris-background)',
        animation: ANIM_TOOLTIP,
        padding: '4px 8px',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        fontSize: 'var(--iris-font-size-xs, 12px)',
        lineHeight: 1.4,
        maxWidth: '240px',
        pointerEvents: 'none',
        zIndex: 'var(--iris-z-tooltip, 1100)',
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
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        onFocus={() => hi.open()}
        onBlur={() => hi.close()}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </IrisSlot>
      {portaled}
    </>
  )
}
