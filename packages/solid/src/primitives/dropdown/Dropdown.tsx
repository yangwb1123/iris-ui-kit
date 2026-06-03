import { createEffect, createSignal, createUniqueId, mergeProps, type JSX } from 'solid-js'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { DropdownContext } from './context'

export interface IrisDropdownProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: Placement
  offset?: number
  children?: JSX.Element
}

/**
 * Dropdown menu root. Composes `createFloatingMachine` (state) with
 * `useFloating` (positioning, in `IrisDropdownMenu`). `role="menu"` semantics +
 * arrow-key nav + auto-close on select. Solid port of the React/Vue dropdown.
 */
export function IrisDropdown(props: IrisDropdownProps): JSX.Element {
  const merged = mergeProps(
    { defaultOpen: false, placement: 'bottom-start' as Placement, offset: 6 },
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
    <DropdownContext.Provider
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
    </DropdownContext.Provider>
  )
}
