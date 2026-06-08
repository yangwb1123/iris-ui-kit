import { splitProps, Show, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { usePopoverContext } from './context'

export interface IrisPopoverContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Portal target; `false` renders in place. Default `document.body`. */
  portalTarget?: HTMLElement | false
  children?: JSX.Element
}

/**
 * The popover floating panel. Positioned via useFloating, dismissed on outside
 * click or Escape. Solid port of the Vue IrisPopoverContent.
 */
export function IrisPopoverContent(props: IrisPopoverContentProps): JSX.Element {
  const ctx = usePopoverContext('IrisPopoverContent')
  const [local, others] = splitProps(props, ['portalTarget', 'style', 'children'])

  const { floatingStyles } = useFloating({
    anchor: ctx.trigger,
    floating: ctx.content,
    open: ctx.open,
    placement: ctx.placement,
    offset: ctx.offset,
  })

  useDismiss({
    enabled: ctx.open,
    exclude: [ctx.trigger, ctx.content],
    onDismiss: () => ctx.setOpen(false),
  })

  const panel = (): JSX.Element => (
    <div
      {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
      ref={ctx.setContent}
      id={ctx.contentId}
      role="dialog"
      data-state="open"
      data-iris-popover-content=""
      style={{
        ...floatingStyles(),
        background: 'var(--iris-surface)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        padding: 'var(--iris-padding-md)',
        'box-shadow': '0 8px 24px -8px rgba(0,0,0,0.16), 0 4px 8px -2px rgba(0,0,0,0.08)',
        'min-width': '160px',
        outline: 'none',
        'z-index': 1000,
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </div>
  )

  return (
    <Show when={ctx.open()}>
      <Show when={local.portalTarget !== false} fallback={panel()}>
        <Portal mount={local.portalTarget instanceof HTMLElement ? local.portalTarget : undefined}>
          {panel()}
        </Portal>
      </Show>
    </Show>
  )
}
