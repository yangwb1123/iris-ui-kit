import { splitProps, type JSX } from 'solid-js'
import { useDrawerContext } from './context'
import { IrisSlot } from '../slot/IrisSlot'

export interface IrisDrawerTriggerProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'ref'
> {
  /** Render the single child as the trigger instead of a wrapper `<button>`. */
  asChild?: boolean
  children?: JSX.Element
  ref?: HTMLElement | ((element: HTMLElement) => void)
}

/**
 * Drawer trigger button. Opens the drawer on click. `asChild` merges the
 * trigger contract onto the single child element and emits no wrapper.
 * Solid port of the Vue IrisDrawerTrigger.
 */
export function IrisDrawerTrigger(props: IrisDrawerTriggerProps): JSX.Element {
  const ctx = useDrawerContext('IrisDrawerTrigger')
  const [local, others] = splitProps(props, ['asChild', 'onClick', 'children', 'ref'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    if (e.defaultPrevented) return
    ctx.setOpen(true)
  }

  const setTriggerRef = (element: HTMLElement): void => {
    ctx.setTriggerRef(element)
    if (typeof local.ref === 'function') local.ref(element)
  }

  const triggerProps = {
    'aria-haspopup': 'dialog' as const,
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
