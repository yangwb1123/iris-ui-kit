import { createSignal, mergeProps, splitProps, type JSX } from 'solid-js'
import { useDropdownContext } from './context'

export interface IrisDropdownItemProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  disabled?: boolean
  /** When true, selecting does NOT close the dropdown. */
  keepOpen?: boolean
  /** Emitted on click or Enter/Space. */
  onSelect?: (event: Event) => void
}

/**
 * A selectable menu item. Calls `onSelect` and auto-closes the parent dropdown
 * (unless `keepOpen`). Disabled items are skipped by arrow-key nav. Solid port
 * of the React/Vue dropdown item.
 */
export function IrisDropdownItem(props: IrisDropdownItemProps): JSX.Element {
  const ctx = useDropdownContext('IrisDropdownItem')
  const merged = mergeProps({ disabled: false, keepOpen: false }, props)
  const [local, others] = splitProps(merged, [
    'disabled',
    'keepOpen',
    'onSelect',
    'style',
    'children',
  ])
  const [hovered, setHovered] = createSignal(false)

  const fire = (event: Event): void => {
    if (local.disabled) return
    local.onSelect?.(event)
    if (!local.keepOpen) ctx.setOpen(false)
  }

  return (
    <div
      {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
      role="menuitem"
      tabindex={local.disabled ? -1 : 0}
      aria-disabled={local.disabled ? 'true' : undefined}
      data-iris-dropdown-item=""
      data-disabled={local.disabled ? '' : undefined}
      onClick={(e) => fire(e)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          fire(e)
        }
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        display: 'flex',
        'align-items': 'center',
        gap: 'var(--iris-gap-sm, 6px)',
        padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
        'border-radius': 'var(--iris-radius-sm, 4px)',
        cursor: local.disabled ? 'not-allowed' : 'pointer',
        opacity: local.disabled ? 0.5 : 1,
        background: hovered() && !local.disabled ? 'var(--iris-surface-hover)' : 'transparent',
        color: 'inherit',
        outline: 'none',
        'font-size': 'var(--iris-font-size-md, 14px)',
        transition: 'background-color 80ms ease',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </div>
  )
}

export type IrisDropdownSeparatorProps = JSX.HTMLAttributes<HTMLDivElement>

export function IrisDropdownSeparator(props: IrisDropdownSeparatorProps): JSX.Element {
  const [local, others] = splitProps(props, ['style'])
  return (
    <div
      {...others}
      role="separator"
      data-iris-dropdown-separator=""
      style={{
        height: '1px',
        background: 'var(--iris-border)',
        margin: '4px 0',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    />
  )
}
