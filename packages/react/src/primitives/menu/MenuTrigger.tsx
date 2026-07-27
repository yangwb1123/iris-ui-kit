import * as React from 'react'
import { composeEventHandlers } from '@iris-ui-kit/core'
import { IrisSlot } from '../slot/Slot'
import { useMenuContext } from './context'

export interface IrisMenuTriggerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  asChild?: boolean
  children?: React.ReactNode
}

/**
 * The trigger that toggles the menu open/closed. Renders as a `<button>` (or
 * custom via `asChild`) with `aria-haspopup="menu"`. Opens on click,
 * ArrowDown, Enter, or Space.
 */
export const IrisMenuTrigger = React.forwardRef<HTMLElement, IrisMenuTriggerProps>(
  function IrisMenuTrigger(
    { asChild = false, onClick, onKeyDown, children, ...rest },
    forwardedRef,
  ) {
    const ctx = useMenuContext('IrisMenuTrigger')

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

    // Keyboard open: ArrowDown/Enter/Space open the menu (which then focuses
    // its first item). Matches the Vue/Solid/Svelte triggers.
    const handleKeyDown = composeEventHandlers(
      onKeyDown as ((e: React.KeyboardEvent<HTMLElement>) => void) | undefined,
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          ctx.setOpen(true)
        }
      },
    )

    const triggerProps = {
      'aria-haspopup': 'menu' as const,
      'aria-expanded': ctx.open,
      'aria-controls': ctx.contentId,
      'data-state': ctx.open ? 'open' : 'closed',
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    }

    if (asChild) {
      if (!React.isValidElement(children)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[iris-ui] IrisMenuTrigger asChild requires a single React element')
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
