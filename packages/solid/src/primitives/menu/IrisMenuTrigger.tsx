import { splitProps, type JSX } from 'solid-js'
import { useMenuContext } from './context'

export interface IrisMenuTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: JSX.Element
}

/**
 * Menu trigger button. Toggles the menu on click.
 * Solid port of the Vue IrisMenuTrigger.
 */
export function IrisMenuTrigger(props: IrisMenuTriggerProps): JSX.Element {
  const ctx = useMenuContext('IrisMenuTrigger')
  const [local, others] = splitProps(props, ['onClick', 'onKeyDown', 'children'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    ctx.setOpen(!ctx.open())
  }

  // Keyboard open: ArrowDown/Enter/Space open the menu (which then focuses
  // its first item). Matches the Vue/React/Svelte triggers.
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
