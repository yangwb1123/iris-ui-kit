import { splitProps, type JSX } from 'solid-js'
import { useDialogContext } from './context'
import { IrisSlot } from '../slot/IrisSlot'

export interface IrisDialogTriggerProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'ref'
> {
  /** Render the single child as the trigger instead of a wrapper `<button>`. */
  asChild?: boolean
  children?: JSX.Element
  ref?: HTMLElement | ((element: HTMLElement) => void)
}

/**
 * Dialog trigger button. Opens the dialog on click. `asChild` merges the
 * trigger contract onto the single child element and emits no wrapper, so the
 * trigger can be an `<IrisButton>` or an `<a>` without nesting interactive
 * elements.
 * Solid port of the Vue IrisDialogTrigger.
 */
export function IrisDialogTrigger(props: IrisDialogTriggerProps): JSX.Element {
  const ctx = useDialogContext('IrisDialogTrigger')
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
