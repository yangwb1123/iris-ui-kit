import { createEffect, splitProps, Show, type JSX } from 'solid-js'
import { installFloatingAnimations, ANIM_POPOVER } from '../../floating/animations'
import { Portal } from 'solid-js/web'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { usePopoverContext } from './context'

export interface IrisPopoverContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Portal target; `false` renders in place. Default `document.body`. */
  portalTarget?: HTMLElement | false
  /** Focus the panel when it opens. Default `true`. */
  autoFocus?: boolean
  /** Restore focus to the trigger when it closes. Default `true`. */
  restoreFocus?: boolean
  children?: JSX.Element
}

/**
 * The popover floating panel. Positioned via useFloating, dismissed on outside
 * click or Escape. Solid port of the Vue IrisPopoverContent.
 */
export function IrisPopoverContent(props: IrisPopoverContentProps): JSX.Element {
  const ctx = usePopoverContext('IrisPopoverContent')
  const [local, others] = splitProps(props, [
    'portalTarget',
    'autoFocus',
    'restoreFocus',
    'style',
    'children',
  ])

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

  // Focus the panel on open; restore focus to the trigger on close (mirrors
  // React/Vue; defaults on).
  let wasOpen = false
  let lastFocused: HTMLElement | null = null
  createEffect(() => {
    installFloatingAnimations()
    const isOpen = ctx.open()
    if (isOpen && !wasOpen) {
      lastFocused = (document.activeElement as HTMLElement | null) ?? ctx.trigger() ?? null
      if (local.autoFocus ?? true) queueMicrotask(() => ctx.content()?.focus())
    } else if (!isOpen && wasOpen) {
      if (local.restoreFocus ?? true) (ctx.trigger() ?? lastFocused)?.focus()
    }
    wasOpen = isOpen
  })

  const panel = (): JSX.Element => (
    <div
      {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
      ref={ctx.setContent}
      id={ctx.contentId}
      role="dialog"
      tabindex={-1}
      data-state="open"
      data-iris-popover-content=""
      style={{
        ...floatingStyles(),
        background: 'var(--iris-surface-floating)',
        animation: ANIM_POPOVER,
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        padding: 'var(--iris-padding-md)',
        'box-shadow': 'var(--iris-shadow-lg)',
        'min-width': '160px',
        outline: 'none',
        'z-index': 'var(--iris-z-popover, 1000)',
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
