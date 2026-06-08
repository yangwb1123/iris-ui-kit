import { createEffect, createSignal, createUniqueId, mergeProps, type JSX } from 'solid-js'
import { createFloatingMachine } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { DrawerContext, type IrisDrawerSide } from './context'

export interface IrisDrawerProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Which side the drawer slides in from. */
  side?: IrisDrawerSide
  /** Width (left/right) or height (top/bottom). */
  size?: string
  /** Close on backdrop click. Default `true`. */
  closeOnOutsideClick?: boolean
  /** Close on Escape key. Default `true`. */
  closeOnEscape?: boolean
  children?: JSX.Element
}

/**
 * Drawer root. Wraps Trigger + Content and provides state through context.
 * Solid port of the Vue IrisDrawer.
 */
export function IrisDrawer(props: IrisDrawerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultOpen: false,
      side: 'right' as IrisDrawerSide,
      size: '320px',
      closeOnOutsideClick: true,
      closeOnEscape: true,
    },
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

  const [triggerRef, setTriggerRef] = createSignal<HTMLElement | undefined>()
  const [contentRef, setContentRef] = createSignal<HTMLElement | null | undefined>()
  const contentId = createUniqueId()
  const titleId = createUniqueId()
  const [hasTitle, setHasTitle] = createSignal(false)

  return (
    <DrawerContext.Provider
      value={{
        open,
        setOpen,
        triggerRef,
        setTriggerRef,
        contentRef,
        setContentRef,
        contentId,
        titleId,
        side: () => merged.side,
        size: () => merged.size,
        hasTitle,
        setHasTitle,
        get closeOnOutsideClick() {
          return merged.closeOnOutsideClick
        },
        get closeOnEscape() {
          return merged.closeOnEscape
        },
      }}
    >
      {props.children}
    </DrawerContext.Provider>
  )
}
