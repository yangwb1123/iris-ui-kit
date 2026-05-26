import * as React from 'react'
import { createFloatingMachine } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { DrawerContext, type IrisDrawerSide } from './context'

export interface IrisDrawerProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  side?: IrisDrawerSide
  /** Width (for left/right) or height (for top/bottom). Any CSS length. */
  size?: string
  closeOnOutsideClick?: boolean
  closeOnEscape?: boolean
  children?: React.ReactNode
}

/**
 * Slide-in overlay. Mirrors `IrisDialog`'s composition but anchors to a
 * screen edge with a transform-based open animation. Defaults to the right.
 *
 * ```tsx
 *   <IrisDrawer>
 *     <IrisDrawerTrigger>Open</IrisDrawerTrigger>
 *     <IrisDrawerContent>
 *       <IrisDrawerTitle>Settings</IrisDrawerTitle>
 *       <p>…</p>
 *       <IrisDrawerClose>Close</IrisDrawerClose>
 *     </IrisDrawerContent>
 *   </IrisDrawer>
 * ```
 */
export function IrisDrawer({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = 'right',
  size = '320px',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  children,
}: IrisDrawerProps): React.ReactElement {
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
      if (!isControlled) {
        send({ type: next ? 'OPEN' : 'CLOSE' })
      }
      onOpenChange?.(next)
    },
    [isControlled, send, onOpenChange],
  )

  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)
  const id = React.useId()
  const contentId = `${id}-content`
  const titleId = `${id}-title`

  const titleCountRef = React.useRef(0)
  const [hasTitle, setHasTitle] = React.useState(false)
  const registerTitle = React.useCallback(() => {
    titleCountRef.current += 1
    setHasTitle(true)
    return () => {
      titleCountRef.current -= 1
      if (titleCountRef.current <= 0) setHasTitle(false)
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
      side,
      size,
      hasTitle,
      registerTitle,
      closeOnOutsideClick,
      closeOnEscape,
    }),
    [
      open,
      setOpen,
      contentId,
      titleId,
      side,
      size,
      hasTitle,
      registerTitle,
      closeOnOutsideClick,
      closeOnEscape,
    ],
  )

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}
