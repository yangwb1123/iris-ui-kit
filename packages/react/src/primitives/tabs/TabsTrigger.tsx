import * as React from 'react'
import { composeEventHandlers } from '@iris-ui/core'
import { IrisSlot } from '../slot/Slot'
import { useTabsContext } from './context'

export interface IrisTabsTriggerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'children'
> {
  value: string
  asChild?: boolean
  children?: React.ReactNode
}

/**
 * A single tab button. Registers with the parent `IrisTabs` so arrow keys
 * can navigate among triggers in registration order. Sets `aria-selected`
 * and `aria-controls`; uses roving tabindex.
 */
export const IrisTabsTrigger = React.forwardRef<HTMLElement, IrisTabsTriggerProps>(
  function IrisTabsTrigger(
    { value, asChild = false, disabled, onClick, onKeyDown, style, children, ...rest },
    forwardedRef,
  ) {
    const ctx = useTabsContext('IrisTabsTrigger')

    const isDisabled = Boolean(disabled) || ctx.disabled
    const isActive = ctx.value === value

    // Hold isDisabled in a ref so the registry's predicate sees the latest value
    // without forcing a re-register on every disabled-flip.
    const isDisabledRef = React.useRef(isDisabled)
    isDisabledRef.current = isDisabled

    const register = ctx.registerTrigger
    React.useEffect(() => {
      return register(value, () => isDisabledRef.current)
    }, [register, value])

    const handleClick = composeEventHandlers(
      onClick as ((e: React.MouseEvent<HTMLElement>) => void) | undefined,
      () => {
        if (isDisabled) return
        ctx.setValue(value)
      },
    )

    const handleKeyDown = composeEventHandlers(
      onKeyDown as ((e: React.KeyboardEvent<HTMLElement>) => void) | undefined,
      (e: React.KeyboardEvent<HTMLElement>) => {
        const horizontal = ctx.orientation === 'horizontal'
        switch (e.key) {
          case horizontal ? 'ArrowRight' : 'ArrowDown':
            e.preventDefault()
            ctx.moveFocus(value, 1)
            break
          case horizontal ? 'ArrowLeft' : 'ArrowUp':
            e.preventDefault()
            ctx.moveFocus(value, -1)
            break
          case 'Home':
            e.preventDefault()
            ctx.moveFocus(value, 'home')
            break
          case 'End':
            e.preventDefault()
            ctx.moveFocus(value, 'end')
            break
        }
      },
    )

    const triggerProps = {
      role: 'tab' as const,
      'aria-selected': isActive,
      'aria-controls': `iris-tabs-content-${value}`,
      id: `iris-tabs-trigger-${value}`,
      tabIndex: isActive ? 0 : -1,
      'data-iris-tabs-trigger': '',
      'data-value': value,
      'data-state': isActive ? 'active' : 'inactive',
      'data-orientation': ctx.orientation,
      'data-disabled': isDisabled ? '' : undefined,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    }

    if (asChild) {
      if (!React.isValidElement(children)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[iris-ui] IrisTabsTrigger asChild requires a single React element')
        }
        return null
      }
      return (
        <IrisSlot ref={forwardedRef as React.Ref<unknown>} {...rest} {...triggerProps}>
          {children}
        </IrisSlot>
      )
    }

    const horizontal = ctx.orientation === 'horizontal'

    return (
      <button
        type="button"
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...triggerProps}
        ref={forwardedRef as React.Ref<HTMLButtonElement>}
        disabled={isDisabled ? true : undefined}
        style={{
          padding: '8px var(--iris-padding-md, 12px)',
          fontSize: 14,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: isActive ? 'var(--iris-primary)' : 'var(--iris-muted)',
          marginBottom: horizontal ? -1 : undefined,
          marginInlineEnd: horizontal ? undefined : -1,
          borderBottom: horizontal
            ? `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}`
            : undefined,
          borderInlineEnd: !horizontal
            ? `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}`
            : undefined,
          transition: 'color 120ms ease, border-color 120ms ease',
          ...style,
        }}
      >
        {children}
      </button>
    )
  },
)
