import * as React from 'react'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { DropdownContext } from './context'

export interface IrisDropdownProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: Placement
  offset?: number
  children?: React.ReactNode
}

/**
 * Dropdown menu root. Composes `createFloatingMachine` (state) with
 * `useFloating` (positioning) used in `IrisDropdownMenu`. The dropdown
 * panel's semantics differ from a popover: it uses `role="menu"`, supports
 * arrow-key navigation, and items auto-close the menu on select.
 *
 * @example
 *   <IrisDropdown placement="bottom-end">
 *     <IrisDropdownTrigger>Actions</IrisDropdownTrigger>
 *     <IrisDropdownMenu>
 *       <IrisDropdownItem onSelect={onCopy}>Copy</IrisDropdownItem>
 *       <IrisDropdownItem onSelect={onDelete}>Delete</IrisDropdownItem>
 *     </IrisDropdownMenu>
 *   </IrisDropdown>
 */
export function IrisDropdown({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  offset = 6,
  children,
}: IrisDropdownProps): React.ReactElement {
  const isControlled = openProp !== undefined

  const [state, send] = useMachine(() => createFloatingMachine(defaultOpen ? 'open' : 'closed'))
  const internalOpen = state.value === 'open'

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
      if (!isControlled) send({ type: next ? 'OPEN' : 'CLOSE' })
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

  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>
}
