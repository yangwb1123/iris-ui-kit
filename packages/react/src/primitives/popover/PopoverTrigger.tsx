import * as React from 'react'
import { composeEventHandlers } from '@iris-ui/core'
import { IrisSlot } from '../slot/Slot'
import { usePopoverContext } from './context'

export interface IrisPopoverTriggerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** Use the single child as the trigger instead of rendering a `<button>`. */
  asChild?: boolean
  children?: React.ReactNode
}

/**
 * The element the user interacts with to toggle the Popover. Renders a
 * `<button type="button">` by default; pass `asChild` to attach behavior to
 * any single element (e.g. `<IrisButton>` or `<a>`).
 *
 * a11y attributes wired automatically:
 *   - `aria-haspopup="dialog"`
 *   - `aria-expanded="true|false"` driven by the open state
 *   - `aria-controls` pointing at the content's id
 */
export const IrisPopoverTrigger = React.forwardRef<HTMLElement, IrisPopoverTriggerProps>(
  function IrisPopoverTrigger({ asChild = false, onClick, children, ...rest }, forwardedRef) {
    const ctx = usePopoverContext('IrisPopoverTrigger')

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
      () => ctx.setOpen(!ctx.open),
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
          console.warn('[iris-ui] IrisPopoverTrigger asChild requires a single React element')
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
