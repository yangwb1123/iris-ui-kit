import { splitProps, type JSX } from 'solid-js'
import { usePopoverContext } from './context'

export interface IrisPopoverTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: JSX.Element
}

/**
 * Popover trigger button. Toggles the popover on click.
 * Solid port of the Vue IrisPopoverTrigger.
 */
export function IrisPopoverTrigger(props: IrisPopoverTriggerProps): JSX.Element {
  const ctx = usePopoverContext('IrisPopoverTrigger')
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
      aria-haspopup="dialog"
      aria-expanded={ctx.open()}
      aria-controls={ctx.contentId}
      data-state={ctx.open() ? 'open' : 'closed'}
      onClick={handleClick}
    >
      {local.children}
    </button>
  )
}
