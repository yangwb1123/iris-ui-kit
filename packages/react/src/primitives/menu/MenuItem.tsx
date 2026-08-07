import * as React from 'react'
import { composeEventHandlers } from '@iris-ui-kit/core'
import { useMenuContext } from './context'

export interface IrisMenuItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  disabled?: boolean
  /** Skip closing the menu on select (e.g. for sub-actions). */
  keepOpen?: boolean
  /** Triggered on click or Enter/Space. */
  onSelect?: (event: React.SyntheticEvent) => void
}

/**
 * An individual selectable item in a menu. Renders as a `role="menuitem"` `<div>`.
 * Calls `onSelect`, then closes the root menu (unless `keepOpen`). Disabled
 * items are skipped by keyboard navigation.
 */
export const IrisMenuItem = React.forwardRef<HTMLDivElement, IrisMenuItemProps>(
  function IrisMenuItem(
    { disabled = false, keepOpen = false, onSelect, onClick, onKeyDown, style, children, ...rest },
    ref,
  ) {
    const ctx = useMenuContext('IrisMenuItem')
    const [hovered, setHovered] = React.useState(false)

    const fire = (event: React.SyntheticEvent) => {
      if (disabled) return
      onSelect?.(event)
      if (!keepOpen) ctx.closeRoot()
    }

    const handleClick = composeEventHandlers(
      onClick as ((e: React.MouseEvent<HTMLDivElement>) => void) | undefined,
      (e: React.MouseEvent<HTMLDivElement>) => fire(e),
    )
    const handleKeyDown = composeEventHandlers(
      onKeyDown as ((e: React.KeyboardEvent<HTMLDivElement>) => void) | undefined,
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          fire(e)
        }
      },
    )

    return (
      <div
        {...rest}
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? 'true' : undefined}
        data-iris-menu-item=""
        data-disabled={disabled ? '' : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--iris-gap-sm, 6px)',
          padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
          borderRadius: 'var(--iris-radius-sm, 4px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          background: hovered && !disabled ? 'var(--iris-surface-hover)' : 'transparent',
          color: 'inherit',
          outline: 'none',
          fontSize: 'var(--iris-font-size-md, 14px)',
          transition: 'background-color 80ms ease',
          ...style,
        }}
      >
        {children}
      </div>
    )
  },
)

export type IrisMenuSeparatorProps = React.HTMLAttributes<HTMLDivElement>

/**
 * A visual separator within a menu — renders a `role="separator"` `<div>`.
 */
export const IrisMenuSeparator = React.forwardRef<HTMLDivElement, IrisMenuSeparatorProps>(
  function IrisMenuSeparator({ style, ...rest }, ref) {
    return (
      <div
        {...rest}
        ref={ref}
        role="separator"
        data-iris-menu-separator=""
        style={{ height: 1, background: 'var(--iris-border)', margin: '4px 0', ...style }}
      />
    )
  },
)
