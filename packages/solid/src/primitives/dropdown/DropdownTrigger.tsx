import { splitProps, type JSX } from 'solid-js'
import { useDropdownContext } from './context'
import { IrisSlot } from '../slot/IrisSlot'

export interface IrisDropdownTriggerProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'ref'
> {
  asChild?: boolean
  children?: JSX.Element
  ref?: HTMLElement | ((element: HTMLElement) => void)
}

/**
 * Dropdown trigger button. Toggles the menu on click and wires the ARIA
 * relationship. `asChild` merges the trigger contract onto the single child
 * element and emits no wrapper.
 */
export function IrisDropdownTrigger(props: IrisDropdownTriggerProps): JSX.Element {
  const ctx = useDropdownContext('IrisDropdownTrigger')
  const [local, others] = splitProps(props, ['asChild', 'onClick', 'onKeyDown', 'children', 'ref'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    if (e.defaultPrevented) return
    ctx.setOpen(!ctx.open())
  }

  // ArrowDown/Enter/Space open the menu (which focuses its first item), matching
  // the Vue trigger + the WAI-ARIA menu-button pattern.
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
      return ctx.open() ? 'open' : 'closed'
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
