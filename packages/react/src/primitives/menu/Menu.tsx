import * as React from 'react'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { MenuContext } from './context'

export interface IrisMenuProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (next: boolean) => void
  placement?: Placement
  offset?: number
  children?: React.ReactNode
}

/**
 * Root of a (potentially nested) menu. Provides the "close everything"
 * channel so picking a leaf in a deeply nested branch closes the whole tree.
 *
 * Use `IrisMenuSub` inside the content to declare nested submenus.
 */
export function IrisMenu({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  offset = 6,
  children,
}: IrisMenuProps): React.ReactElement {
  const isControlled = openProp !== undefined
  const [state, send] = useMachine(() =>
    createFloatingMachine(defaultOpen ? 'open' : 'closed'),
  )
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

  const closeRoot = React.useCallback(() => setOpen(false), [setOpen])

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId,
      placement,
      offset,
      closeRoot,
    }),
    [open, setOpen, contentId, placement, offset, closeRoot],
  )

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}
