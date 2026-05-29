import * as React from 'react'
import { createFloatingMachine } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { DialogContext } from './context'

export interface IrisDialogProps {
  /** Controlled open value. Combine with `onOpenChange`. */
  open?: boolean
  /** Initial open value in uncontrolled mode. */
  defaultOpen?: boolean
  /** Emitted whenever the open state changes. */
  onOpenChange?: (open: boolean) => void
  /** Close on backdrop click. Default `true`. */
  closeOnOutsideClick?: boolean
  /** Close on Escape key. Default `true`. */
  closeOnEscape?: boolean
  children?: React.ReactNode
}

/**
 * Modal dialog root. Wraps a Trigger + Content (+ optional Title /
 * Description / Close) and threads a state machine + DOM refs + IDs through
 * React context. Supports controlled (`open` + `onOpenChange`) and
 * uncontrolled (`defaultOpen`) modes.
 *
 * Unlike `IrisPopover`, Dialog:
 *   - centers content with no anchor positioning,
 *   - locks body scroll while open,
 *   - traps Tab focus inside the content,
 *   - renders a backdrop overlay that dismisses on click.
 */
export function IrisDialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  children,
}: IrisDialogProps): React.ReactElement {
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
  const titleId = React.useId()
  const descriptionId = React.useId()

  // Title/Description registration via refcount — multiple children possible
  // (rare, but allowed); aria-labelledby is wired iff at least one is mounted.
  const titleCountRef = React.useRef(0)
  const descCountRef = React.useRef(0)
  const [hasTitle, setHasTitle] = React.useState(false)
  const [hasDescription, setHasDescription] = React.useState(false)

  const registerTitle = React.useCallback(() => {
    titleCountRef.current += 1
    setHasTitle(true)
    return () => {
      titleCountRef.current -= 1
      if (titleCountRef.current <= 0) setHasTitle(false)
    }
  }, [])
  const registerDescription = React.useCallback(() => {
    descCountRef.current += 1
    setHasDescription(true)
    return () => {
      descCountRef.current -= 1
      if (descCountRef.current <= 0) setHasDescription(false)
    }
  }, [])

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId,
      titleId,
      descriptionId,
      hasTitle,
      hasDescription,
      registerTitle,
      registerDescription,
      closeOnOutsideClick,
      closeOnEscape,
    }),
    [
      open,
      setOpen,
      contentId,
      titleId,
      descriptionId,
      hasTitle,
      hasDescription,
      registerTitle,
      registerDescription,
      closeOnOutsideClick,
      closeOnEscape,
    ],
  )

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}
