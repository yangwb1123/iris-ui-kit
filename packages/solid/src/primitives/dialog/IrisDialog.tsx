import { createEffect, createSignal, createUniqueId, mergeProps, type JSX } from 'solid-js'
import { createFloatingMachine } from '@iris-ui/core'
import { useMachine } from '../../useMachine'
import { DialogContext } from './context'

export interface IrisDialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Close on backdrop click. Default `true`. */
  closeOnOutsideClick?: boolean
  /** Close on Escape key. Default `true`. */
  closeOnEscape?: boolean
  children?: JSX.Element
}

/**
 * Modal dialog root. Threads state machine + DOM refs + IDs through context.
 * Supports controlled (open + onOpenChange) and uncontrolled (defaultOpen) modes.
 * Solid port of the Vue IrisDialog.
 */
export function IrisDialog(props: IrisDialogProps): JSX.Element {
  const merged = mergeProps(
    { defaultOpen: false, closeOnOutsideClick: true, closeOnEscape: true },
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
  const descriptionId = createUniqueId()
  const [hasTitle, setHasTitle] = createSignal(false)
  const [hasDescription, setHasDescription] = createSignal(false)

  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
        triggerRef,
        setTriggerRef,
        contentRef,
        setContentRef,
        contentId,
        titleId,
        descriptionId,
        hasTitle,
        setHasTitle,
        hasDescription,
        setHasDescription,
        get closeOnOutsideClick() {
          return merged.closeOnOutsideClick
        },
        get closeOnEscape() {
          return merged.closeOnEscape
        },
      }}
    >
      {props.children}
    </DialogContext.Provider>
  )
}
