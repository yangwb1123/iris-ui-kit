import { splitProps, type JSX } from 'solid-js'
import { useDropdownContext } from './context'

export interface IrisDropdownTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: JSX.Element
}

/**
 * Dropdown trigger button. Toggles the menu on click and wires the ARIA
 * relationship. (The React/Vue `asChild` polymorphism relies on cloneElement,
 * which Solid lacks — deferred; use the native button.)
 */
export function IrisDropdownTrigger(props: IrisDropdownTriggerProps): JSX.Element {
  const ctx = useDropdownContext('IrisDropdownTrigger')
  const [local, others] = splitProps(props, ['onClick', 'onKeyDown', 'children'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    ctx.setOpen(!ctx.open())
  }

  // ArrowDown/Enter/Space open the menu (which focuses its first item), matching
  // the Vue trigger + the WAI-ARIA menu-button pattern.
  const handleKeyDown: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = (e) => {
    if (typeof local.onKeyDown === 'function') local.onKeyDown(e)
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ctx.setOpen(true)
    }
  }

  return (
    <button
      type="button"
      {...others}
      ref={ctx.setTrigger}
      aria-haspopup="menu"
      aria-expanded={ctx.open()}
      aria-controls={ctx.contentId}
      data-state={ctx.open() ? 'open' : 'closed'}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {local.children}
    </button>
  )
}
