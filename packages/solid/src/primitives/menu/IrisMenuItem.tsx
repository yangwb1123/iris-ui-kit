import { splitProps, type JSX } from 'solid-js'
import { useMenuContext } from './context'

export interface IrisMenuItemProps extends JSX.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
  /** Close the root menu after selection (default true). */
  closeOnSelect?: boolean
  children?: JSX.Element
}

/**
 * An individual menu item. Calls `closeRoot` after being selected unless
 * selection is canceled or `closeOnSelect={false}`. Solid port of the Vue
 * IrisMenuItem.
 */
export function IrisMenuItem(props: IrisMenuItemProps): JSX.Element {
  const ctx = useMenuContext('IrisMenuItem')
  const [local, others] = splitProps(props, ['disabled', 'closeOnSelect', 'onClick', 'children'])

  const select = (event: MouseEvent | KeyboardEvent, suppressNativeDefault = false): void => {
    if (local.disabled) {
      if (suppressNativeDefault) event.preventDefault()
      return
    }
    if (typeof local.onClick === 'function')
      local.onClick(
        event as unknown as MouseEvent & { currentTarget: HTMLDivElement; target: Element },
      )
    const selectionCanceled = event.defaultPrevented
    if (suppressNativeDefault) event.preventDefault()
    if (local.closeOnSelect !== false && !selectionCanceled) ctx.closeRoot()
  }

  const handleClick: JSX.EventHandler<HTMLDivElement, MouseEvent> = (e) => {
    select(e)
  }

  const handleKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') select(e, true)
  }

  return (
    <div
      {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
      role="menuitem"
      tabindex={local.disabled ? -1 : 0}
      aria-disabled={local.disabled ? 'true' : undefined}
      data-iris-menu-item=""
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
        'font-size': 'var(--iris-font-size-md, 14px)',
        'border-radius': 'var(--iris-radius-sm, 4px)',
        cursor: local.disabled ? 'not-allowed' : 'pointer',
        color: local.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
        outline: 'none',
        ...((others.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </div>
  )
}

export type IrisMenuSeparatorProps = JSX.HTMLAttributes<HTMLDivElement>

/** Visual separator between menu items. */
export function IrisMenuSeparator(props: IrisMenuSeparatorProps): JSX.Element {
  return (
    <div
      {...props}
      role="separator"
      data-iris-menu-separator=""
      style={{
        height: '1px',
        background: 'var(--iris-border)',
        margin: '4px 0',
        ...((props.style as JSX.CSSProperties) ?? {}),
      }}
    />
  )
}
