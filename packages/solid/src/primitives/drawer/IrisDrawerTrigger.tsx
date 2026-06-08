import { splitProps, type JSX } from 'solid-js'
import { useDrawerContext } from './context'

export interface IrisDrawerTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: JSX.Element
}

/**
 * Drawer trigger button. Opens the drawer on click.
 * Solid port of the Vue IrisDrawerTrigger.
 */
export function IrisDrawerTrigger(props: IrisDrawerTriggerProps): JSX.Element {
  const ctx = useDrawerContext('IrisDrawerTrigger')
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
