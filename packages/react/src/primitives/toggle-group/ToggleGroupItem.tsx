import * as React from 'react'
import { useToggleGroupContext } from './context'

const SIZE_PADDING: Record<'sm' | 'md' | 'lg', string> = {
  sm: '4px 10px',
  md: '6px 14px',
  lg: '8px 18px',
}
const SIZE_FONT: Record<'sm' | 'md' | 'lg', string> = {
  sm: '12px',
  md: '13px',
  lg: '14px',
}

export interface IrisToggleGroupItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'type'
> {
  value: string
}

/**
 * One toggle in an `IrisToggleGroup`. Renders a `<button>` with the correct
 * `role` / `aria-checked` / `aria-pressed` for the group's type.
 */
export const IrisToggleGroupItem = React.forwardRef<HTMLButtonElement, IrisToggleGroupItemProps>(
  function IrisToggleGroupItem(
    { value, disabled, onClick, onKeyDown, style, children, ...rest },
    forwardedRef,
  ) {
    const ctx = useToggleGroupContext('IrisToggleGroupItem')
    const elRef = React.useRef<HTMLButtonElement | null>(null)

    const captureRef = React.useCallback(
      (el: HTMLButtonElement | null) => {
        elRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef)
          (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
      },
      [forwardedRef],
    )

    const register = ctx.registerItem
    React.useEffect(() => {
      return register(value, elRef)
    }, [register, value])

    const active = ctx.isActive(value)
    const isDisabled = Boolean(disabled) || ctx.disabled
    const isSingle = ctx.type === 'single'

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (isDisabled) return
      ctx.toggle(value)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e)
      if (isDisabled) return
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          ctx.toggle(value)
          break
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          ctx.moveFocus(value, 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
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
    }

    return (
      <button
        {...rest}
        ref={captureRef}
        type="button"
        role={isSingle ? 'radio' : undefined}
        aria-checked={isSingle ? active : undefined}
        aria-pressed={isSingle ? undefined : active}
        aria-disabled={isDisabled ? 'true' : undefined}
        disabled={isDisabled || undefined}
        tabIndex={active ? 0 : -1}
        data-iris-toggle-group-item=""
        data-state={active ? 'on' : 'off'}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: SIZE_PADDING[ctx.size],
          fontSize: SIZE_FONT[ctx.size],
          fontFamily: 'inherit',
          fontWeight: 500,
          lineHeight: 1,
          background: active ? 'var(--iris-primary)' : 'transparent',
          color: active ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
          border: 'none',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          transition: 'background-color 120ms ease, color 120ms ease',
          ...style,
        }}
      >
        {children}
      </button>
    )
  },
)
