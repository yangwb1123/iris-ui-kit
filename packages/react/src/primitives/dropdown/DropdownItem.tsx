import * as React from 'react'
import { composeEventHandlers } from '@iris-ui-kit/core'
import { useDropdownContext } from './context'

export interface IrisDropdownItemProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  disabled?: boolean
  /** When true, selecting does NOT close the dropdown. */
  keepOpen?: boolean
  /** Emitted on click or Enter/Space. */
  onSelect?: (event: React.SyntheticEvent) => void
}

/**
 * A single selectable menu item. Calls `onSelect` and auto-closes the
 * parent dropdown after selection (unless `keepOpen`). Disabled items are
 * skipped by arrow-key navigation in the parent menu.
 */
export const IrisDropdownItem = React.forwardRef<HTMLDivElement, IrisDropdownItemProps>(
  function IrisDropdownItem(
    { disabled = false, keepOpen = false, onSelect, onClick, onKeyDown, style, children, ...rest },
    ref,
  ) {
    const ctx = useDropdownContext('IrisDropdownItem')
    const [hovered, setHovered] = React.useState(false)

    const fire = (event: React.SyntheticEvent) => {
      if (disabled) return
      onSelect?.(event)
      if (!keepOpen) ctx.setOpen(false)
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
        data-iris-dropdown-item=""
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
          padding: '6px var(--iris-padding-md, 12px)',
          borderRadius: 'var(--iris-radius-sm, 4px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          background: hovered && !disabled ? 'var(--iris-surface-hover)' : 'transparent',
          color: 'inherit',
          outline: 'none',
          fontSize: 14,
          transition: 'background-color 80ms ease',
          ...style,
        }}
      >
        {children}
      </div>
    )
  },
)

export type IrisDropdownSeparatorProps = React.HTMLAttributes<HTMLDivElement>

/**
 * A visual separator (horizontal rule) within a dropdown menu. Renders a
 * `role="separator"` `<div>` styled with the theme's border colour.
 */
export const IrisDropdownSeparator = React.forwardRef<HTMLDivElement, IrisDropdownSeparatorProps>(
  function IrisDropdownSeparator({ style, ...rest }, ref) {
    return (
      <div
        {...rest}
        ref={ref}
        role="separator"
        data-iris-dropdown-separator=""
        style={{
          height: 1,
          background: 'var(--iris-border)',
          margin: '4px 0',
          ...style,
        }}
      />
    )
  },
)
