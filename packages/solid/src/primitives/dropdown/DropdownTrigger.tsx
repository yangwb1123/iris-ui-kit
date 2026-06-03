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
  const [local, others] = splitProps(props, ['onClick', 'children'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    ctx.setOpen(!ctx.open())
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
    >
      {local.children}
    </button>
  )
}
