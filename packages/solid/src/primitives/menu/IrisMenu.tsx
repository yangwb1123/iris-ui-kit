import { createEffect, createSignal, createUniqueId, mergeProps, type JSX } from 'solid-js'
import { createFloatingMachine, type Placement } from '@iris-ui-kit/core'
import { useMachine } from '../../useMachine'
import { MenuContext } from './context'

export interface IrisMenuProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: Placement
  offset?: number
  children?: JSX.Element
}

/**
 * Root of a (potentially nested) menu. Provides the close-everything channel
 * to submenus so picking a leaf in a deeply nested branch closes the whole tree.
 * The root itself behaves like IrisDropdown. Solid port of the Vue IrisMenu.
 */
export function IrisMenu(props: IrisMenuProps): JSX.Element {
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
  const closeRoot = (): void => setOpen(false)

  const [trigger, setTrigger] = createSignal<HTMLElement | undefined>()
  const [content, setContent] = createSignal<HTMLElement | undefined>()
  const contentId = createUniqueId()

  return (
    <MenuContext.Provider
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
        closeRoot,
      }}
    >
      {props.children}
    </MenuContext.Provider>
  )
}
