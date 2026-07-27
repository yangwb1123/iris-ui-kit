import { createEffect, createSignal, createUniqueId, mergeProps, type JSX } from 'solid-js'
import { createFloatingMachine, type Placement } from '@iris-ui-kit/core'
import { useMachine } from '../../useMachine'
import { PopoverContext } from './context'

export interface IrisPopoverProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: Placement
  offset?: number
  children?: JSX.Element
}

/**
 * Popover root. Provides open state + positioning options to Trigger + Content.
 * Supports controlled (open + onOpenChange) and uncontrolled (defaultOpen) modes.
 * Solid port of the Vue IrisPopover.
 */
export function IrisPopover(props: IrisPopoverProps): JSX.Element {
  const merged = mergeProps(
    { defaultOpen: false, placement: 'bottom-start' as Placement, offset: 8 },
    props,
  )

  const isControlled = (): boolean => props.open !== undefined

  const [state, send] = useMachine(() =>
    createFloatingMachine(merged.defaultOpen ? 'open' : 'closed'),
  )
  const internalOpen = (): boolean => state().value === 'open'

  createEffect(() => {
    if (!isControlled()) return
    const target = props.open ? 'open' : 'closed'
    if (state().value !== target) send({ type: props.open ? 'OPEN' : 'CLOSE' })
  })

  const open = (): boolean => (isControlled() ? Boolean(props.open) : internalOpen())
  const setOpen = (next: boolean): void => {
    if (!isControlled()) send({ type: next ? 'OPEN' : 'CLOSE' })
    merged.onOpenChange?.(next)
  }

  const [trigger, setTrigger] = createSignal<HTMLElement | undefined>()
  const [content, setContent] = createSignal<HTMLElement | undefined>()
  const contentId = createUniqueId()

  return (
    <PopoverContext.Provider
      value={{
        open,
        setOpen,
        trigger,
        setTrigger,
        content,
        setContent,
        contentId,
        get placement() {
          return merged.placement
        },
        get offset() {
          return merged.offset
        },
      }}
    >
      {props.children}
    </PopoverContext.Provider>
  )
}
