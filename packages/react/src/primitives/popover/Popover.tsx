import * as React from 'react'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { PopoverContext } from './context'

export interface IrisPopoverProps {
  /** Controlled open value. Combine with `onOpenChange`. */
  open?: boolean
  /** Initial open value in uncontrolled mode. */
  defaultOpen?: boolean
  /** Called whenever the open state changes (controlled or uncontrolled). */
  onOpenChange?: (open: boolean) => void
  /** Anchor placement; may be flipped by Floating UI to stay in view. */
  placement?: Placement
  /** Distance in px between trigger and content. */
  offset?: number
  children?: React.ReactNode
}

/**
 * Root provider for a Popover surface. Wraps the trigger and the content,
 * threads a state machine + DOM refs + positioning options through context.
 * Supports controlled (`open` + `onOpenChange`) and uncontrolled (`defaultOpen`)
 * modes.
 *
 * @example
 *   <IrisPopover defaultOpen={false} placement="bottom-start">
 *     <IrisPopoverTrigger>Click me</IrisPopoverTrigger>
 *     <IrisPopoverContent>Hello</IrisPopoverContent>
 *   </IrisPopover>
 */
export function IrisPopover({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  offset = 8,
  children,
}: IrisPopoverProps): React.ReactElement {
  const isControlled = openProp !== undefined

  const [state, send] = useMachine(() => createFloatingMachine(defaultOpen ? 'open' : 'closed'))
  const internalOpen = state.value === 'open'

  // Sync controlled prop → machine.
  React.useEffect(() => {
    if (!isControlled) return
    const target = openProp ? 'open' : 'closed'
    if (state.value !== target) {
      send({ type: openProp ? 'OPEN' : 'CLOSE' })
    }
  }, [isControlled, openProp, state.value, send])

  const open = isControlled ? Boolean(openProp) : internalOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        send({ type: next ? 'OPEN' : 'CLOSE' })
      }
      onOpenChange?.(next)
    },
    [isControlled, send, onOpenChange],
  )

  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)
  const contentId = React.useId()

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId,
      placement,
      offset,
    }),
    [open, setOpen, contentId, placement, offset],
  )

  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>
}
