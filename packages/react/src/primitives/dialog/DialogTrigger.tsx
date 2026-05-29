import * as React from 'react'
import { composeEventHandlers } from '@iris-ui/core'
import { IrisSlot } from '../slot/Slot'
import { useDialogContext } from './context'

export interface IrisDialogTriggerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** Use the single child as the trigger instead of rendering a `<button>`. */
  asChild?: boolean
  children?: React.ReactNode
}

/**
 * The element the user clicks to open the dialog. Renders a
 * `<button type="button">` by default; pass `asChild` to attach behavior
 * to any single element.
 */
export const IrisDialogTrigger = React.forwardRef<HTMLElement, IrisDialogTriggerProps>(
  function IrisDialogTrigger({ asChild = false, onClick, children, ...rest }, forwardedRef) {
    const ctx = useDialogContext('IrisDialogTrigger')

    const captureRef = React.useCallback(
      (el: HTMLElement | null) => {
        ctx.triggerRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef)
          (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = el
      },
      [ctx, forwardedRef],
    )

    const handleClick = composeEventHandlers(
      onClick as ((e: React.MouseEvent<HTMLElement>) => void) | undefined,
      () => ctx.setOpen(true),
    )

    const triggerProps = {
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': ctx.open,
      'aria-controls': ctx.contentId,
      'data-state': ctx.open ? 'open' : 'closed',
      onClick: handleClick,
    }

    if (asChild) {
      if (!React.isValidElement(children)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[iris-ui] IrisDialogTrigger asChild requires a single React element')
        }
        return null
      }
      return (
        <IrisSlot ref={captureRef as React.Ref<unknown>} {...rest} {...triggerProps}>
          {children}
        </IrisSlot>
      )
    }

    return (
      <button
        type="button"
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...triggerProps}
        ref={captureRef as React.Ref<HTMLButtonElement>}
      >
        {children}
      </button>
    )
  },
)
