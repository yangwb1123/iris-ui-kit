import { createEffect, splitProps, Show, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { nextEnabledIndex } from '@iris-ui/core'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { useMenuContext } from './context'

export interface IrisMenuContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Portal target; `false` renders in place. Default renders to body. */
  portalTarget?: HTMLElement | false
  children?: JSX.Element
}

/**
 * The menu surface (`role="menu"`). Positioned via useFloating, dismissed via
 * useDismiss (Escape + outside pointerdown), with arrow-key navigation.
 * Solid port of the Vue IrisMenuContent.
 */
export function IrisMenuContent(props: IrisMenuContentProps): JSX.Element {
  const ctx = useMenuContext('IrisMenuContent')
  const [local, others] = splitProps(props, ['portalTarget', 'style', 'onKeyDown', 'children'])

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

  // Focus first item on open; restore focus to the trigger on close.
  let wasOpen = false
  createEffect(() => {
    const open = ctx.open()
    if (open && !wasOpen) {
      queueMicrotask(() => {
        ctx.content()?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
      })
    } else if (!open && wasOpen) {
      ctx.trigger()?.focus?.()
    }
    wasOpen = open
  })

  const handleKeyDown = (e: KeyboardEvent & { currentTarget: HTMLDivElement }): void => {
    if (typeof local.onKeyDown === 'function') {
      ;(local.onKeyDown as (ev: typeof e) => void)(e)
    }
    const root = ctx.content()
    if (!root) return
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    )
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        items[nextEnabledIndex(index, 1, items.length)]?.focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        items[nextEnabledIndex(index, -1, items.length)]?.focus()
        break
      case 'Home':
        e.preventDefault()
        items[0]?.focus()
        break
      case 'End':
        e.preventDefault()
        items[items.length - 1]?.focus()
        break
      case 'Tab':
        ctx.setOpen(false)
        break
    }
  }

  const menu = (): JSX.Element => (
    <div
      {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
      ref={ctx.setContent}
      id={ctx.contentId}
      role="menu"
      tabindex={-1}
      data-iris-menu-content=""
      data-state="open"
      onKeyDown={handleKeyDown}
      style={{
        ...floatingStyles(),
        background: 'var(--iris-surface)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        padding: 'var(--iris-padding-sm, 4px)',
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
      <Show when={local.portalTarget !== false} fallback={menu()}>
        <Portal mount={local.portalTarget instanceof HTMLElement ? local.portalTarget : undefined}>
          {menu()}
        </Portal>
      </Show>
    </Show>
  )
}
