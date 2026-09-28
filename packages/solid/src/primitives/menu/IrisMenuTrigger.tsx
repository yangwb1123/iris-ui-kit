import { splitProps, type JSX } from 'solid-js'
import { useMenuContext } from './context'
import { IrisSlot } from '../slot/IrisSlot'

export interface IrisMenuTriggerProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'ref'
> {
  /** Render the single child as the trigger instead of a wrapper `<button>`. */
  asChild?: boolean
  children?: JSX.Element
  ref?: HTMLElement | ((element: HTMLElement) => void)
}

/**
 * Menu trigger button. Toggles the menu on click. `asChild` merges the trigger
 * contract onto the single child element and emits no wrapper.
 * Solid port of the Vue IrisMenuTrigger.
 */
export function IrisMenuTrigger(props: IrisMenuTriggerProps): JSX.Element {
  const ctx = useMenuContext('IrisMenuTrigger')
  const [local, others] = splitProps(props, ['asChild', 'onClick', 'onKeyDown', 'children', 'ref'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    if (e.defaultPrevented) return
    ctx.setOpen(!ctx.open())
  }

  // Keyboard open: ArrowDown/Enter/Space open the menu (which then focuses
  // its first item). Matches the Vue/React/Svelte triggers.
  const handleKeyDown: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = (e) => {
    if (typeof local.onKeyDown === 'function') local.onKeyDown(e)
    if (e.defaultPrevented) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ctx.setOpen(true)
    }
  }

  const setTriggerRef = (element: HTMLElement): void => {
    ctx.setTrigger(element)
    if (typeof local.ref === 'function') local.ref(element)
  }

  const triggerProps = {
    'aria-haspopup': 'menu' as const,
    get 'aria-expanded'() {
      return ctx.open()
    },
    'aria-controls': ctx.contentId,
    get 'data-state'() {
      return ctx.open() ? ('open' as const) : ('closed' as const)
    },
    onClick: handleClick as JSX.EventHandler<HTMLElement, MouseEvent>,
    onKeyDown: handleKeyDown as JSX.EventHandler<HTMLElement, KeyboardEvent>,
    ref: setTriggerRef,
  }

  if (local.asChild) {
    return (
      <IrisSlot {...others} {...triggerProps}>
        {local.children}
      </IrisSlot>
    )
  }

  return (
    <button type="button" {...others} {...triggerProps}>
      {local.children}
    </button>
  )
}
