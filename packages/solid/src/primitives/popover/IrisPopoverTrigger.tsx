import { splitProps, type JSX } from 'solid-js'
import { usePopoverContext } from './context'
import { IrisSlot } from '../slot/IrisSlot'

export interface IrisPopoverTriggerProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'ref'
> {
  /** Render the single child as the trigger instead of a wrapper `<button>`. */
  asChild?: boolean
  children?: JSX.Element
  ref?: HTMLElement | ((element: HTMLElement) => void)
}

/**
 * Popover trigger button. Toggles the popover on click. `asChild` merges the
 * trigger contract onto the single child element and emits no wrapper.
 * Solid port of the Vue IrisPopoverTrigger.
 */
export function IrisPopoverTrigger(props: IrisPopoverTriggerProps): JSX.Element {
  const ctx = usePopoverContext('IrisPopoverTrigger')
  const [local, others] = splitProps(props, ['asChild', 'onClick', 'children', 'ref'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    if (e.defaultPrevented) return
    ctx.setOpen(!ctx.open())
  }

  const setTriggerRef = (element: HTMLElement): void => {
    ctx.setTrigger(element)
    if (typeof local.ref === 'function') local.ref(element)
  }

  const triggerProps = {
    'aria-haspopup': 'dialog' as const,
    get 'aria-expanded'() {
      return ctx.open()
    },
    'aria-controls': ctx.contentId,
    get 'data-state'() {
      return ctx.open() ? ('open' as const) : ('closed' as const)
    },
    onClick: handleClick as JSX.EventHandler<HTMLElement, MouseEvent>,
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
