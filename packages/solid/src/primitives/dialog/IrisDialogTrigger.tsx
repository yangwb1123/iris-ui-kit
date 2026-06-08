import { splitProps, type JSX } from 'solid-js'
import { useDialogContext } from './context'

export interface IrisDialogTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: JSX.Element
}

/**
 * Dialog trigger button. Opens the dialog on click.
 * Solid port of the Vue IrisDialogTrigger.
 */
export function IrisDialogTrigger(props: IrisDialogTriggerProps): JSX.Element {
  const ctx = useDialogContext('IrisDialogTrigger')
  const [local, others] = splitProps(props, ['onClick', 'children'])

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof local.onClick === 'function') local.onClick(e)
    ctx.setOpen(true)
  }

  return (
    <button
      type="button"
      {...others}
      ref={ctx.setTriggerRef}
      aria-haspopup="dialog"
      aria-controls={ctx.contentId}
      data-state={ctx.open() ? 'open' : 'closed'}
      onClick={handleClick}
    >
      {local.children}
    </button>
  )
}
